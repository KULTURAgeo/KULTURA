"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { uploadImage } from "@/app/admin/actions";
import { MAX_PRODUCT_PHOTOS, MAX_UPLOAD_BYTES } from "@/lib/upload-limits";
import styles from "./product-gallery.module.css";

type Upload = { file: File; preview: string };
const accepted = ["image/jpeg", "image/png", "image/webp"];

export function ProductGalleryUpload({ productId, photoCount }: { productId: string; photoCount: number }) {
  const inputId = useId();
  const [files, setFiles] = useState<Upload[]>([]);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const urls = useRef(new Set<string>());
  const uploading = useRef(false);
  const capacity = Math.min(MAX_PRODUCT_PHOTOS, 50 - photoCount);

  useEffect(() => {
    const previews = urls.current;
    return () => { previews.forEach((url) => URL.revokeObjectURL(url)); previews.clear(); };
  }, []);

  function removePreview(url: string) {
    URL.revokeObjectURL(url);
    urls.current.delete(url);
  }

  function choose(selection: FileList | null) {
    if (!selection?.length || uploading.current) return;
    const selected = Array.from(selection);
    const invalid = selected.find((file) => !accepted.includes(file.type) || file.size < 1 || file.size > MAX_UPLOAD_BYTES);
    if (invalid || selected.length + files.length > capacity) {
      setError(true);
      setMessage(invalid
        ? `${invalid.name} must be a JPEG, PNG or WebP image up to 3 MB.`
        : `You can queue up to ${capacity} photos for this upload.`);
      return;
    }
    const additions = selected.map((file) => {
      const preview = URL.createObjectURL(file);
      urls.current.add(preview);
      return { file, preview };
    });
    setFiles([...files, ...additions]);
    setError(false);
    setMessage("");
  }

  async function upload() {
    if (uploading.current || !files.length || files.length > capacity) return;
    uploading.current = true;
    setProgress({ completed: 0, total: files.length });
    setError(false);
    setMessage("");
    let completed = 0;
    try {
      for (const item of files) {
        const data = new FormData();
        data.set("product_id", productId);
        data.set("image", item.file);
        const result = await uploadImage({}, data);
        if (!result.ok) {
          setError(true);
          setMessage(`${item.file.name} · ${result.message ?? "Upload failed."} ${completed} of ${files.length} uploaded.`);
          return;
        }
        removePreview(item.preview);
        completed++;
        setFiles(files.slice(completed));
        setProgress({ completed, total: files.length });
      }
      setMessage(`${completed} ${completed === 1 ? "photo" : "photos"} uploaded.`);
    } catch {
      setError(true);
      setMessage(`${completed} of ${files.length} confirmed. Reload the gallery to check the last upload before retrying.`);
    } finally {
      uploading.current = false;
      setProgress(null);
    }
  }

  return (
    <div className={styles.upload}>
      {capacity > 0 && (
        <div className={styles.dropzone}
          onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }}
          onDrop={(event) => {
            if (!event.dataTransfer.types.includes("Files")) return;
            event.preventDefault();
            choose(event.dataTransfer.files);
          }}>
          <label htmlFor={inputId}>Drop photos here or choose files</label>
          <input id={inputId} type="file" accept={accepted.join(",")} multiple disabled={Boolean(progress)}
            onChange={(event) => { choose(event.currentTarget.files); event.currentTarget.value = ""; }} />
          <small>JPEG, PNG or WebP · up to 3 MB per photo</small>
        </div>
      )}
      {files.length > 0 && (
        <ul className={styles.queue} aria-label="Photos queued for upload">
          {files.map((item) => (
            <li key={item.preview}>
              <Image src={item.preview} alt="" width={45} height={56} unoptimized />
              <span>{item.file.name}</span>
              <button type="button" disabled={Boolean(progress)} aria-label={`Remove ${item.file.name} from upload`}
                onClick={() => {
                  removePreview(item.preview);
                  setFiles(files.filter((file) => file !== item));
                }}>×</button>
            </li>
          ))}
        </ul>
      )}
      {progress && <div className={styles.progress}>
        <progress value={progress.completed} max={progress.total} aria-label="Photo upload progress" />
        <p role="status">{progress.completed} of {progress.total} uploaded</p>
      </div>}
      {message && <p role={error ? "alert" : "status"} className={error ? "form-error" : "muted"}>{message}</p>}
      {files.length > 0 && (
        <button className="button primary" type="button" onClick={() => void upload()}
          disabled={Boolean(progress) || files.length > capacity}>Upload {files.length} {files.length === 1 ? "photo" : "photos"}</button>
      )}
    </div>
  );
}
