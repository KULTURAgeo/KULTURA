"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./product-image-picker.module.css";

export function ProductImagePicker() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>('input[type="file"][name="image"]');
    if (!input) return;

    let currentUrl: string | null = null;
    const frame = window.requestAnimationFrame(() => setTarget(input.parentElement));

    const syncPreview = () => {
      const file = input.files?.[0] ?? null;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentUrl = file ? URL.createObjectURL(file) : null;
      setPreviewUrl(currentUrl);
      setFileName(file?.name ?? "");
    };

    input.addEventListener("change", syncPreview);

    return () => {
      window.cancelAnimationFrame(frame);
      input.removeEventListener("change", syncPreview);
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, []);

  if (!target || !previewUrl) return null;

  return createPortal(
    <div className={styles.previewBlock}>
      <div className={styles.previewFrame}>
        <Image
          src={previewUrl}
          alt="Selected product preview"
          fill
          unoptimized
          sizes="(max-width: 720px) 100vw, 320px"
          className={styles.previewImage}
        />
      </div>
      <div className={styles.previewMeta}>
        <span>PREVIEW · NOT SAVED YET</span>
        <strong>{fileName}</strong>
        <p>This is how the selected file looks before the product is created.</p>
      </div>
    </div>,
    target,
  );
}
