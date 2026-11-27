"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import {
  MAX_UPLOAD_BYTES, UPLOAD_SIZE_MESSAGE, MAX_PRODUCT_PHOTOS, MAX_PRODUCT_PHOTO_BATCH_BYTES,
  PRODUCT_PHOTO_COUNT_MESSAGE, PRODUCT_PHOTO_BATCH_MESSAGE,
} from "@/lib/upload-limits";

const MAX_FRAME_WIDTH = 1600;
const MAX_FRAME_HEIGHT = 2000;

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new window.Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("This image cannot be opened."));
      image.src = url;
    });
    return image;
  } finally {
    // Revoking after load does not invalidate the decoded image.
    URL.revokeObjectURL(url);
  }
}

async function encodeWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== "image/webp") {
        reject(new Error("Your browser could not prepare this image as WebP."));
      } else {
        resolve(blob);
      }
    }, "image/webp", quality);
  });
}

async function preparePhoto(file: File): Promise<File> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPEG, PNG or WebP photograph.");
  }
  if (!file.size || file.size > MAX_UPLOAD_BYTES) {
    throw new Error(UPLOAD_SIZE_MESSAGE);
  }

  const image = await loadImage(file);
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  if (!sourceWidth || !sourceHeight || sourceWidth * sourceHeight > 25_000_000) {
    throw new Error("Image size is invalid or exceeds 25 megapixels.");
  }

  // The canvas is 4:5, with every source pixel in frame; never crop, stretch,
  // or enlarge a smaller source photograph.
  const fullFrameWidth = Math.max(sourceWidth, Math.ceil(sourceHeight * 4 / 5));
  const frameWidth = Math.max(
    4,
    Math.floor(Math.min(fullFrameWidth, MAX_FRAME_WIDTH, MAX_FRAME_HEIGHT * 4 / 5) / 4) * 4,
  );
  const frameHeight = frameWidth * 5 / 4;
  const scale = Math.min(1, frameWidth / sourceWidth, frameHeight / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const canvas = document.createElement("canvas");
  canvas.width = frameWidth;
  canvas.height = frameHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image preview is unavailable in this browser.");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // A consistent white studio background eliminates the dark preview bands;
  // transparent pixels are also composited onto white.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, frameWidth, frameHeight);
  ctx.drawImage(
    image,
    (frameWidth - drawWidth) / 2,
    (frameHeight - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );

  for (const quality of [0.95, 0.92, 0.88, 0.85]) {
    const blob = await encodeWebp(canvas, quality);
    if (blob.size <= MAX_UPLOAD_BYTES) {
      return new File(
        [blob],
        file.name.replace(/\.[^.]+$/, "") + "-kultura-4x5.webp",
        { type: "image/webp", lastModified: Date.now() },
      );
    }
  }
  throw new Error("The converted image exceeds 3 MB. Try a less complex photograph.");
}

type PreviewImageInputProps = {
  name: string;
  label: string;
  required?: boolean;
} & (
  { multiple?: false; onPreview: (url: string | null) => void }
  | { multiple: true; onPreview: (urls: string[]) => void }
);

export function PreviewImageInput(props: PreviewImageInputProps) {
  const { name, label, required, multiple } = props;
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef(0);
  const urlRef = useRef<string[]>([]);
  const [state, setState] = useState<"idle" | "processing" | "ready" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => () => {
    selectionRef.current++;
    for (const url of urlRef.current) URL.revokeObjectURL(url);
  }, []);

  function showPreviews(urls: string[]) {
    urlRef.current = urls;
    if (props.multiple) props.onPreview(urls);
    else props.onPreview(urls[0] ?? null);
  }

  function clearPreview() {
    for (const url of urlRef.current) URL.revokeObjectURL(url);
    showPreviews([]);
  }

  function clearSelection() {
    selectionRef.current++;
    clearPreview();
    const input = inputRef.current;
    if (input) {
      input.value = "";
      input.setCustomValidity("");
    }
    setMessage("");
    setState("idle");
  }

  async function changePhotos(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const sources = Array.from(input.files ?? []);
    if (!sources.length) {
      clearSelection();
      return;
    }
    const selection = ++selectionRef.current;
    clearPreview();
    const waiting = "Wait for the preview before saving.";
    input.setCustomValidity(waiting);
    setMessage(waiting);
    setState("processing");
    try {
      if (multiple && sources.length > MAX_PRODUCT_PHOTOS)
        throw new Error(PRODUCT_PHOTO_COUNT_MESSAGE);
      const prepared: File[] = [];
      for (const source of sources) {
        prepared.push(await preparePhoto(source));
        if (selection !== selectionRef.current) return;
      }
      // Product batches that fit can send originals. The generated files still
      // supply the framed previews and keep larger batches within the request limit.
      const uploads = multiple && sources.reduce((sum, file) => sum + file.size, 0) <= MAX_PRODUCT_PHOTO_BATCH_BYTES
        ? sources
        : prepared;
      if (multiple && uploads.reduce((sum, file) => sum + file.size, 0) > MAX_PRODUCT_PHOTO_BATCH_BYTES)
        throw new Error(PRODUCT_PHOTO_BATCH_MESSAGE);
      const transfer = new DataTransfer();
      for (const file of uploads) transfer.items.add(file);
      input.files = transfer.files;
      showPreviews(prepared.map((file) => URL.createObjectURL(file)));
      input.setCustomValidity("");
      setMessage(prepared.length === 1 ? "Preview ready. Save to upload this photo." : `${prepared.length} previews ready. Save to upload these photos.`);
      setState("ready");
    } catch (error) {
      if (selection !== selectionRef.current) return;
      const failure = error instanceof Error ? error.message : "The photo could not be prepared.";
      input.value = "";
      input.setCustomValidity(failure);
      setMessage(failure);
      setState("error");
    }
  }

  return (
    <div>
      <label className="k-field" htmlFor={inputId}>
        <span>{label}</span>
        <input ref={inputRef} id={inputId} name={name} type="file" accept="image/jpeg,image/png,image/webp"
          required={required} multiple={multiple} onChange={changePhotos} aria-describedby={message ? inputId + "-status" : undefined} />
      </label>
      {message && <p id={inputId + "-status"} role={state === "error" ? "alert" : "status"}
        className={state === "error" ? "form-error" : "muted"}>{message}</p>}
      {state !== "idle" && <button type="button" className="button secondary" onClick={clearSelection}>
        {multiple ? "CLEAR SELECTED PHOTOS" : "CLEAR SELECTED PHOTO"}
      </button>}
    </div>
  );
}
