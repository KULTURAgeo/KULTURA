"use client";

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

    setTarget(input.parentElement);

    const syncPreview = () => {
      const file = input.files?.[0] ?? null;
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return file ? URL.createObjectURL(file) : null;
      });
      setFileName(file?.name ?? "");
    };

    input.addEventListener("change", syncPreview);
    syncPreview();

    return () => {
      input.removeEventListener("change", syncPreview);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
    };
  }, []);

  if (!target || !previewUrl) return null;

  return createPortal(
    <div className={styles.previewBlock}>
      <div className={styles.previewFrame}>
        <img src={previewUrl} alt="Selected product preview" className={styles.previewImage} />
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
