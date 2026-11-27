import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { InputError } from "../validation";
import {
  MAX_UPLOAD_BYTES, UPLOAD_SIZE_MESSAGE, MAX_PRODUCT_PHOTOS, MAX_PRODUCT_PHOTO_BATCH_BYTES,
  PRODUCT_PHOTO_COUNT_MESSAGE, PRODUCT_PHOTO_BATCH_MESSAGE,
} from "../upload-limits";
import type { requireActionActor } from "../auth/guards";
export { MAX_UPLOAD_BYTES } from "../upload-limits";

const FRAME_WIDTH = 1600;
const FRAME_HEIGHT = 2000;

export async function prepareProductPhotos(data: FormData, required = false): Promise<Buffer[]> {
  const files = data.getAll("image").flatMap((entry) => {
    if (!(entry instanceof File)) throw new InputError("Choose valid image files.");
    return entry.name === "" && entry.size === 0 ? [] : [entry];
  });
  if (required && files.length === 0) throw new InputError("Choose at least one photo.");
  if (files.length > MAX_PRODUCT_PHOTOS) throw new InputError(PRODUCT_PHOTO_COUNT_MESSAGE);
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_PRODUCT_PHOTO_BATCH_BYTES)
    throw new InputError(PRODUCT_PHOTO_BATCH_MESSAGE);

  const photos: Buffer[] = [];
  for (const file of files) photos.push(await processProductImage(file));
  return photos;
}

type AdminClient = Awaited<ReturnType<typeof requireActionActor>>["client"];

export async function attachProductPhotos(
  client: AdminClient, productId: string, photos: Buffer[], alt: string,
): Promise<{ uploaded: number; error?: unknown }> {
  const bucket = client.storage.from("product-images");
  let uploaded = 0;
  for (const photo of photos) {
    try {
      const path = `${productId}/${randomUUID()}.webp`;
      const stored = await bucket.upload(path, photo, {
        contentType: "image/webp",
        upsert: false,
        cacheControl: "3600",
      });
      if (stored.error) throw stored.error;

      const attached = await client.rpc("admin_attach_image", {
        p_product_id: productId,
        p_storage_path: path,
        p_alt_text: alt || null,
      });
      if (attached.error) {
        await bucket.remove([path]);
        throw attached.error;
      }
      uploaded++;
    } catch (error) {
      return { uploaded, error };
    }
  }
  return { uploaded };
}

/**
 * Store an entire product photograph in a 4:5 canvas. The object is never
 * cropped, distorted or upscaled. The white matte matches the upload preview.
 */
export async function processProductImage(file: File): Promise<Buffer> {
  if (file.size < 1 || file.size > MAX_UPLOAD_BYTES) {
    throw new InputError(UPLOAD_SIZE_MESSAGE);
  }

  const formats: Record<string, string> = {
    "image/jpeg": "jpeg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const expected = formats[file.type];
  if (!expected) {
    throw new InputError("Only JPEG, PNG and WebP images are accepted.");
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const input = sharp(bytes, {
      limitInputPixels: 25_000_000,
      failOn: "warning",
      animated: false,
    });
    const metadata = await input.metadata();
    if (metadata.format !== expected || (metadata.pages ?? 1) > 1) {
      throw new InputError("Choose a valid, non-animated JPEG, PNG or WebP image.");
    }

    const { width, height } = metadata.autoOrient;
    if (!width || !height) throw new InputError("Image dimensions are invalid.");

    // Size the 4:5 canvas using the oriented dimensions. All intermediate
    // pixels stay lossless until the final WebP is encoded.
    const frameWidth = Math.max(width, Math.ceil(height * 4 / 5));
    const frameHeight = Math.ceil(frameWidth * 5 / 4);
    const scale = Math.min(1, FRAME_WIDTH / frameWidth, FRAME_HEIGHT / frameHeight);
    const canvasWidth = Math.max(4, Math.floor(frameWidth * scale / 4) * 4);
    const canvasHeight = canvasWidth * 5 / 4;
    const fit = Math.min(1, canvasWidth / width, canvasHeight / height);
    const imageWidth = Math.max(1, Math.floor(width * fit));
    const imageHeight = Math.max(1, Math.floor(height * fit));
    const resized = await input.autoOrient().resize(imageWidth, imageHeight, { fit: "fill" }).png().toBuffer();

    const padded = sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 4,
        background: "#ffffff",
      },
    }).composite([{
      input: resized,
      left: Math.floor((canvasWidth - imageWidth) / 2),
      top: Math.floor((canvasHeight - imageHeight) / 2),
    }]);

    const paddedBuffer = await padded.png().toBuffer();
    for (const quality of [95, 92, 88, 85]) {
      const output = await sharp(paddedBuffer).webp({ quality, effort: 5 }).toBuffer();
      if (output.length <= MAX_UPLOAD_BYTES) return output;
    }
    throw new InputError("The processed photograph exceeds 3 MB. Try a cleaner source image.");
  } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError("This image could not be decoded. Choose a valid image under 25 megapixels.");
  }
}
