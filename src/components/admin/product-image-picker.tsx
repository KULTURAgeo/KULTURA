"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MAX_UPLOAD_BYTES, UPLOAD_SIZE_MESSAGE } from "@/lib/upload-limits";
import styles from "./product-image-picker.module.css";

type PreviewState = "idle" | "processing" | "ready" | "error";
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

export function ProductImagePicker() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [state, setState] = useState<PreviewState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>('input[type="file"][name="image"]');
    if (!input) return;
    const form = input.closest("form");
    let currentUrl: string | null = null;
    let changeId = 0;
    let currentStatus: PreviewState = "idle";
    const frame = window.requestAnimationFrame(() => setTarget(input.parentElement));

    const setStatus = (next: PreviewState) => {
      currentStatus = next;
      setState(next);
    };

    const changePhoto = async () => {
      const id = ++changeId;
      const source = input.files?.[0] ?? null;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentUrl = null;
      setPreviewUrl(null);
      setErrorMessage("");
      setFileName(source?.name ?? "");
      if (!source) {
        setStatus("idle");
        return;
      }
      setStatus("processing");
      try {
        const processed = await preparePhoto(source);
        if (id !== changeId) return;
        const transfer = new DataTransfer();
        transfer.items.add(processed);
        input.files = transfer.files; // This is the file the form actually submits.
        currentUrl = URL.createObjectURL(processed);
        setPreviewUrl(currentUrl);
        setStatus("ready");
      } catch (error) {
        if (id !== changeId) return;
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "Image conversion failed.");
        input.value = ""; // Never submit an unprocessed photo by mistake.
      }
    };

    // Prevent form submission while converting or after a conversion failure.
    const guardSubmit = (event: Event) => {
      if (currentStatus === "processing" || currentStatus === "error") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setErrorMessage(
          currentStatus === "processing"
            ? "Image is still being prepared. Submit after the preview appears."
            : "Choose a valid photograph before saving.",
        );
      }
    };
    input.addEventListener("change", changePhoto);
    form?.addEventListener("submit", guardSubmit, true);
    return () => {
      ++changeId;
      window.cancelAnimationFrame(frame);
      input.removeEventListener("change", changePhoto);
      form?.removeEventListener("submit", guardSubmit, true);
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, []);

  if (!target || state === "idle") return null;

  return createPortal(
    <div className={styles.previewBlock} aria-live="polite">
      <div className={styles.previewFrame}>
        {previewUrl && (
          <Image
            src={previewUrl}
            alt="Processed 4:5 product preview"
            fill
            unoptimized
            sizes="(max-width: 720px) 100vw, 320px"
            className={styles.previewImage}
          />
        )}
        {state === "processing" && <span className={styles.loading}>PREPARING 4:5 IMAGE…</span>}
      </div>
      <div className={styles.previewMeta}>
        <span>{state === "ready" ? "4:5 READY · NOT SAVED YET" : "IMAGE PREPARATION"}</span>
        <strong>{fileName}</strong>
        {state === "ready" ? (
          <p>This is the converted image that will be uploaded when you save the product.</p>
        ) : (
          <p role={state === "error" ? "alert" : undefined}>{errorMessage || "Preparing a full-size image without cropping the product."}</p>
        )}
      </div>
    </div>,
    target,
  );
}
