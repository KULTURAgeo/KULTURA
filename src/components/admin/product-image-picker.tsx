"use client";

import { useEffect, useState } from "react";
import styles from "./product-image-picker.module.css";

export function ProductImagePicker() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className={styles.wrap}>
      <label className="k-field">
        <span>MAIN PRODUCT IMAGE · OPTIONAL</span>
        <input
          type="file"
          name="image"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0] ?? null;
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            if (!file) {
              setPreviewUrl(null);
              setFileName("");
              return;
            }
            setPreviewUrl(URL.createObjectURL(file));
            setFileName(file.name);
          }}
        />
      </label>

      {previewUrl ? (
        <div className={styles.previewBlock}>
          <div className={styles.previewFrame}>
            <img src={previewUrl} alt="Selected product preview" className={styles.previewImage} />
          </div>
          <div className={styles.previewMeta}>
            <span>PREVIEW · NOT SAVED YET</span>
            <strong>{fileName}</strong>
          </div>
        </div>
      ) : (
        <div className={styles.emptyPreview}>
          <span>IMAGE PREVIEW</span>
          <p>Your selected image will appear here before you create the product.</p>
        </div>
      )}
    </div>
  );
}
