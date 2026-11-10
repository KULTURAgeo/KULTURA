import "server-only";
import sharp from "sharp";
import { InputError } from "../validation";
import { MAX_UPLOAD_BYTES, UPLOAD_SIZE_MESSAGE } from "../upload-limits";
export { MAX_UPLOAD_BYTES } from "../upload-limits";

/**
 * Keep the full product photograph (no crop, stretch or forced upscaling).
 * Only downscale originals exceeding 2400 px on either edge, then encode a
 * high-quality WebP. Fall back progressively if output exceeds upload limit.
 * The shop's 4:5 product frame is handled by CSS object-fit: contain.
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
    // EXIF orientation is corrected; aspect ratio and transparency are retained.
    const normalized = await input
      .rotate()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .toBuffer();

    for (const quality of [95, 92, 88, 85]) {
      const output = await sharp(normalized).webp({ quality, effort: 5 }).toBuffer();
      if (output.length <= MAX_UPLOAD_BYTES) return output;
    }
    throw new InputError("This image is too complex to optimize within the 3 MB upload limit.");
  } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError("This image could not be decoded. Choose a valid image under 25 megapixels.");
  }
}
