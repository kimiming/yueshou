import sharp from "sharp";

import { MAX_MEDIA_UPLOAD_BYTES, type AllowedMediaType } from "./schemas";

export const MAX_MEDIA_IMAGE_PIXELS = 40_000_000;
export const MAX_MEDIA_IMAGE_DIMENSION = 8_192;

export class ImageValidationError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

function matchesMagic(bytes: Uint8Array, mimeType: AllowedMediaType) {
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    return signature.every((value, index) => bytes[index] === value);
  }
  if (mimeType === "image/webp") {
    return Buffer.from(bytes.subarray(0, 4)).toString("ascii") === "RIFF"
      && Buffer.from(bytes.subarray(8, 12)).toString("ascii") === "WEBP";
  }
  if (bytes.length < 16 || Buffer.from(bytes.subarray(4, 8)).toString("ascii") !== "ftyp") return false;
  const brand = Buffer.from(bytes.subarray(8, 12)).toString("ascii");
  return brand === "avif" || brand === "avis";
}

function decodedMimeType(format: string | undefined): AllowedMediaType | null {
  if (format === "jpeg") return "image/jpeg";
  if (format === "png") return "image/png";
  if (format === "webp") return "image/webp";
  if (format === "heif" || format === "avif") return "image/avif";
  return null;
}

export async function inspectAndSanitizeImage(input: {
  bytes: Uint8Array;
  declaredMimeType: AllowedMediaType;
  maxBytes?: number;
  maxPixels?: number;
  maxDimension?: number;
}) {
  const maxBytes = input.maxBytes ?? MAX_MEDIA_UPLOAD_BYTES;
  const maxPixels = input.maxPixels ?? MAX_MEDIA_IMAGE_PIXELS;
  const maxDimension = input.maxDimension ?? MAX_MEDIA_IMAGE_DIMENSION;
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > maxBytes) {
    throw new ImageValidationError("media_byte_size", "Image bytes exceed the allowed size");
  }
  if (!matchesMagic(input.bytes, input.declaredMimeType)) {
    throw new ImageValidationError("media_byte_type_mismatch", "Image magic does not match the declared media type");
  }

  try {
    const image = sharp(input.bytes, {
      failOn: "error",
      limitInputPixels: Math.max(1, MAX_MEDIA_IMAGE_PIXELS),
      sequentialRead: true,
    });
    const metadata = await image.metadata();
    const mimeType = decodedMimeType(metadata.format);
    if (mimeType !== input.declaredMimeType) {
      throw new ImageValidationError("media_byte_type_mismatch", "Decoded image type does not match the declared media type");
    }
    if (!metadata.width || !metadata.height) {
      throw new ImageValidationError("media_decode_failed", "Decoded image dimensions are unavailable");
    }
    if (metadata.pages && metadata.pages > 1) {
      throw new ImageValidationError("media_animation_unsupported", "Animated images are not supported");
    }
    if (
      metadata.width > maxDimension
      || metadata.height > maxDimension
      || metadata.width * metadata.height > maxPixels
    ) {
      throw new ImageValidationError("media_pixel_limit", "Decoded image exceeds the pixel or dimension ceiling");
    }

    let sanitizer = sharp(input.bytes, {
      failOn: "error",
      limitInputPixels: Math.max(1, MAX_MEDIA_IMAGE_PIXELS),
      sequentialRead: true,
    }).rotate();
    if (mimeType === "image/jpeg") sanitizer = sanitizer.jpeg({ quality: 90, mozjpeg: true });
    else if (mimeType === "image/png") sanitizer = sanitizer.png({ compressionLevel: 9 });
    else if (mimeType === "image/webp") sanitizer = sanitizer.webp({ quality: 90 });
    else sanitizer = sanitizer.avif({ quality: 75 });

    const sanitized = await sanitizer.toBuffer({ resolveWithObject: true });
    if (sanitized.data.byteLength > maxBytes) {
      throw new ImageValidationError("media_byte_size", "Sanitized image exceeds the allowed size");
    }
    if (
      sanitized.info.width > maxDimension
      || sanitized.info.height > maxDimension
      || sanitized.info.width * sanitized.info.height > maxPixels
    ) {
      throw new ImageValidationError("media_pixel_limit", "Sanitized image exceeds the pixel or dimension ceiling");
    }
    return {
      bytes: Uint8Array.from(sanitized.data),
      mimeType,
      width: sanitized.info.width,
      height: sanitized.info.height,
    };
  } catch (error) {
    if (error instanceof ImageValidationError) throw error;
    throw new ImageValidationError("media_decode_failed", "Image bytes could not be decoded safely");
  }
}
