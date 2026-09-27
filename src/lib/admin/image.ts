import "server-only";
import sharp from "sharp";
import { InputError } from "../validation";
import { MAX_UPLOAD_BYTES, UPLOAD_SIZE_MESSAGE } from "../upload-limits";
export { MAX_UPLOAD_BYTES } from "../upload-limits";
export async function processProductImage(file: File): Promise<Buffer> {
    if (file.size < 1 || file.size > MAX_UPLOAD_BYTES)
        throw new InputError(UPLOAD_SIZE_MESSAGE);
    const formats: Record<string, string> = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };
    const expected = formats[file.type];
    if (!expected)
        throw new InputError("Only JPEG, PNG and WebP images are accepted.");
    try {
        const bytes = Buffer.from(await file.arrayBuffer());
        const image = sharp(bytes, { limitInputPixels: 25000000, failOn: "warning", animated: false });
        const metadata = await image.metadata();
        if (metadata.format !== expected || (metadata.pages ?? 1) > 1)
            throw new InputError("Choose a valid, non-animated JPEG, PNG or WebP image.");
        const output = await image.rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
        if (output.length > MAX_UPLOAD_BYTES)
            throw new InputError("The processed image is too large.");
        return output;
    }
    catch (error) {
        if (error instanceof InputError)
            throw error;
        throw new InputError("This image could not be decoded. Choose a valid image under 25 megapixels.");
    }
}
