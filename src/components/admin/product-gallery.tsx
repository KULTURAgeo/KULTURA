"use client";

import Image from "next/image";
import { useEffect, useId, useOptimistic, useRef, useState, useTransition } from "react";
import { removeImage } from "@/app/admin/actions";
import { reorderGalleryPhotos, saveGalleryPhotoDetails } from "@/app/admin/products/gallery-actions";
import type { ActionState } from "@/lib/actions";
import { ProductGalleryUpload } from "./product-gallery-upload";
import styles from "./product-gallery.module.css";

type Photo = {
  id: string;
  src: string;
  alt: string;
  colorId: string;
  updatedAt: string;
};
type Color = { id: string; name: string };
type PhotoDetails = Pick<Photo, "alt" | "colorId">;

export function ProductGallery({ productId, name, photos, colors }: {
  productId: string;
  name: string;
  photos: Photo[];
  colors: Color[];
}) {
  const [displayed, showOrder] = useOptimistic(photos);
  const [feedback, setFeedback] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ id: string; editAlt: boolean } | null>(null);
  const activePhoto = displayed.find((photo) => photo.id === preview?.id);
  const colorNames = new Map(colors.map((color) => [color.id, color.name]));

  function move(from: number, to: number) {
    if (pending || from < 0 || to < 0 || from === to || to >= photos.length) return;
    const picked = photos[from];
    if (!picked) return;
    const ordered = [...photos];
    ordered.splice(from, 1);
    ordered.splice(to, 0, picked);
    const data = new FormData();
    data.set("product_id", productId);
    ordered.forEach((photo) => data.append("photo_id", photo.id));
    photos.forEach((photo) => data.append("expected_id", photo.id));
    setFeedback({});
    startTransition(async () => {
      showOrder(ordered);
      try {
        setFeedback(await reorderGalleryPhotos(data));
      } catch {
        setFeedback({ ok: false, message: "The order could not be verified. Reload before trying again." });
      }
    });
  }

  function remove(photo: Photo, index: number) {
    if (pending || !window.confirm(`Remove photo ${index + 1} from this product?`)) return;
    const data = new FormData();
    data.set("product_id", productId);
    data.set("id", photo.id);
    data.set("updated_at", photo.updatedAt);
    setFeedback({});
    startTransition(async () => {
      try {
        setFeedback(await removeImage({}, data));
      } catch {
        setFeedback({ ok: false, message: "Removal could not be verified. Reload before trying again." });
      }
    });
  }

  return (
    <>
      {displayed.length ? (
        <ol className={styles.grid} aria-label="Product photo order" aria-busy={pending}>
          {displayed.map((photo, index) => (
            <li key={photo.id} className={styles.tile} data-drop-target={dropTarget === photo.id || undefined}
              onDragOver={(event) => {
                if (!dragging || dragging === photo.id) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropTarget(photo.id);
              }}
              onDrop={(event) => {
                if (!dragging) return;
                event.preventDefault();
                move(photos.findIndex((item) => item.id === dragging), index);
                setDragging(null);
                setDropTarget(null);
              }}>
              <button type="button" className={styles.thumbnail} aria-label={`Enlarge photo ${index + 1}`}
                draggable={!pending}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", photo.id);
                  setDragging(photo.id);
                }}
                onDragEnd={() => { setDragging(null); setDropTarget(null); }}
                onClick={() => setPreview({ id: photo.id, editAlt: false })}>
                <Image src={photo.src} alt={photo.alt || `${name} — photo ${index + 1}`}
                  fill sizes="(max-width: 550px) 45vw, 230px" draggable={false} />
              </button>
              {index === 0 && <span className={styles.cover}>Cover</span>}
              <div className={styles.tileActions}>
                <button type="button" aria-label={`Edit alt text for photo ${index + 1}`}
                  title={photo.alt || "Alt text missing"}
                  onClick={() => setPreview({ id: photo.id, editAlt: true })}>
                  Alt{!photo.alt.trim() && <span className={styles.missingAlt} aria-label="missing" />}
                </button>
                <button type="button" disabled={pending || index === 0} title="Move earlier"
                  aria-label={`Move photo ${index + 1} earlier`} onClick={() => move(index, index - 1)}>↑</button>
                <button type="button" disabled={pending || index === displayed.length - 1} title="Move later"
                  aria-label={`Move photo ${index + 1} later`} onClick={() => move(index, index + 1)}>↓</button>
                <button type="button" disabled={pending} title="Remove photo"
                  aria-label={`Remove photo ${index + 1}`} onClick={() => remove(photo, index)}>×</button>
              </div>
              <div className={styles.tileCaption}>
                <span>{colorNames.get(photo.colorId) ?? "All colors"}</span>
                {index > 0 && <button type="button" disabled={pending} onClick={() => move(index, 0)}>Set as cover</button>}
              </div>
            </li>
          ))}
        </ol>
      ) : <p className="muted">No product photos yet.</p>}
      {(feedback.message || pending) && (
        <p className={feedback.ok === false ? "form-error" : "muted"} role={feedback.ok === false ? "alert" : "status"}>
          {pending ? "Saving gallery…" : feedback.message}
        </p>
      )}
      <ProductGalleryUpload productId={productId} photoCount={photos.length} />
      {preview && activePhoto && (
        <PhotoDetailsDialog key={activePhoto.id} photo={activePhoto} colors={colors} name={name}
          productId={productId} editAlt={preview.editAlt} onClose={() => setPreview(null)} />
      )}
    </>
  );
}

function PhotoDetailsDialog({ photo, colors, name, productId, editAlt, onClose }: {
  photo: Photo;
  colors: Color[];
  name: string;
  productId: string;
  editAlt: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const altField = useRef<HTMLTextAreaElement>(null);
  const headingId = useId();
  const [alt, setAlt] = useState(photo.alt);
  const [colorId, setColorId] = useState(photo.colorId);
  const [feedback, setFeedback] = useState<ActionState>({});
  const [saving, setSaving] = useState(false);
  const saved = useRef({ alt: photo.alt, colorId: photo.colorId, updatedAt: photo.updatedAt });
  const queue = useRef(Promise.resolve(true));

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
    if (editAlt) altField.current?.focus();
  }, [editAlt]);

  function save(details: PhotoDetails) {
    const candidate = { ...details, alt: details.alt.trim() };
    const request = queue.current.then(async () => {
      if (candidate.alt === saved.current.alt && candidate.colorId === saved.current.colorId) return true;
      const data = new FormData();
      data.set("product_id", productId);
      data.set("id", photo.id);
      data.set("updated_at", saved.current.updatedAt);
      data.set("alt_text", candidate.alt);
      data.set("color_id", candidate.colorId);
      setSaving(true);
      try {
        const result = await saveGalleryPhotoDetails(data);
        setFeedback(result);
        if (!result.ok || !result.updatedAt) return false;
        saved.current = { ...candidate, updatedAt: result.updatedAt };
        return true;
      } catch {
        setFeedback({ ok: false, message: "The photo details could not be saved. Try again." });
        return false;
      } finally {
        setSaving(false);
      }
    });
    queue.current = request;
    return request;
  }

  async function close() {
    if (await save({ alt, colorId })) dialog.current?.close();
  }

  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={headingId} onClose={onClose}
      onCancel={(event) => { event.preventDefault(); void close(); }}>
      <div className={styles.largePhoto}>
        <Image src={photo.src} alt={alt.trim() || name} fill sizes="(max-width: 700px) 90vw, 530px" unoptimized />
      </div>
      <div className={styles.details}>
        <h3 id={headingId}>Photo details</h3>
        <label className="k-field">
          <span>Alt text {alt.trim() ? "" : "· missing"}</span>
          <textarea ref={altField} value={alt} rows={3} maxLength={500}
            placeholder="Describe what is visible in this photo"
            onBlur={() => void save({ alt, colorId })}
            onChange={(event) => setAlt(event.target.value)} />
        </label>
        {colors.length > 0 && (
          <label className="k-field">
            <span>Product color</span>
            <select value={colorId} onChange={(event) => {
              const selected = event.target.value;
              setColorId(selected);
              void save({ alt, colorId: selected });
            }}>
              <option value="">All colors</option>
              {colors.map((color) => <option key={color.id} value={color.id}>{color.name}</option>)}
            </select>
          </label>
        )}
        {(saving || feedback.message) && <p role={feedback.ok === false ? "alert" : "status"}
          className={feedback.ok === false ? "form-error" : "muted"}>{saving ? "Saving…" : feedback.message}</p>}
        <button className="button secondary" type="button" onClick={() => void close()}>Done</button>
        {feedback.ok === false && <button className="button secondary" type="button"
          onClick={() => dialog.current?.close()}>Close without saving draft</button>}
      </div>
    </dialog>
  );
}
