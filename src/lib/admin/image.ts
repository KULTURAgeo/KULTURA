import "server-only";
import sharp from "sharp";
import { InputError } from "../validation";
import { MAX_UPLOAD_BYTES, UPLOAD_SIZE_MESSAGE } from "../upload-limits";
export { MAX_UPLOAD_BYTES } from "../upload-limits";

const FRAME_WIDTH = 1600;
const FRAME_HEIGHT = 2000;

/**
 * Store an entire product photograph in a 4:5 canvas. The object is never
 * cropped, distorted or upscaled. Empty space is filled with the input image's
 * corner background color, which avoids grey bars for studio product shots.
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

    // Normalize image orientation before measuring it.
    const normalized = await input.rotate().toBuffer();
    const oriented = sharp(normalized);
    const dimensions = await oriented.metadata();
    const width = dimensions.width ?? 0;
    const height = dimensions.height ?? 0;
    if (!width || !height) throw new InputError("Image dimensions are invalid.");

    // Sample the unobstructed top-left studio background. Transparent images
    // receive a white backdrop, without changing or recoloring the garment.
    const sampleSize = Math.min(12, width, height);
    const corner = await sharp(normalized)
      .extract({ left: 0, top: 0, width: sampleSize, height: sampleSize })
      .ensureAlpha()
      .stats();
    const alpha = corner.channels[3]?.mean ?? 255;
    const background = alpha < 240
      ? { r: 255, g: 255, b: 255, alpha: 1 }
      : {
          r: Math.round(corner.channels[0].mean),
          g: Math.round(corner.channels[1].mean),
          b: Math.round(corner.channels[2].mean),
          alpha: 1,
        };

    // Build the smallest 4:5 frame that contains every original pixel,
    // scaling down only if a side exceeds the optimized frame limit.
    const frameWidth = Math.max(width, Math.ceil(height * 4 / 5));
    const frameHeight = Math.ceil(frameWidth * 5 / 4);
    const scale = Math.min(1, FRAME_WIDTH / frameWidth, FRAME_HEIGHT / frameHeight);
    // Enforce a strict 4:5 ratio even after rounding.
    const canvasWidth = Math.max(4, Math.floor(frameWidth * scale / 4) * 4);
    const canvasHeight = canvasWidth * 5 / 4;
    const fit = Math.min(1, canvasWidth / width, canvasHeight / height);
    const imageWidth = Math.max(1, Math.floor(width * fit));
    const imageHeight = Math.max(1, Math.floor(height * fit));
    const resized = await sharp(normalized)
      .resize(imageWidth, imageHeight, { fit: "fill" })
      .toBuffer();

    const padded = sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 4,
        background,
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
