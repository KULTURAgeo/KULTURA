// Leave room for multipart overhead beneath Vercel's 4.5 MB request limit.
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export const UPLOAD_SIZE_MESSAGE = "Choose an image no larger than 3 MB.";
