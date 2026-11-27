// Leave room for multipart overhead beneath Vercel's 4.5 MB request limit.
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export const UPLOAD_SIZE_MESSAGE = "Choose an image no larger than 3 MB.";
export const MAX_PRODUCT_PHOTOS = 10;
// Leave room for the product fields and multipart framing below Next's 4 MB limit.
export const MAX_PRODUCT_PHOTO_BATCH_BYTES = 3.5 * 1024 * 1024;
export const PRODUCT_PHOTO_COUNT_MESSAGE = "Choose up to 10 photos at a time.";
export const PRODUCT_PHOTO_BATCH_MESSAGE = "These photos are over 3.5 MB together. Upload them in smaller batches.";
