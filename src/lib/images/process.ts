import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel Hobby request limit is 4.5 MB.
const MAIN_EDGE = 1600;
const THUMB_EDGE = 400;
const ACCEPTED_FORMATS: Record<string, true> = { jpeg: true, png: true, webp: true };
// Refuse decompression bombs: a small file that expands to a huge bitmap.
const MAX_INPUT_PIXELS = 40_000_000;

export class InvalidImageError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "InvalidImageError";
  }
}

export type ProcessedImage = {
  main: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
};

/**
 * Checks that the bytes are really a JPEG, PNG or WebP picture, then
 * re-encodes it. Re-encoding drops every metadata block (GPS location, camera,
 * owner), applies the camera's rotation first, and shrinks to 1600 px. A
 * 400 px thumbnail is written alongside.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  if (input.length === 0 || input.length > MAX_UPLOAD_BYTES) {
    throw new InvalidImageError("image is empty or too large");
  }
  const decode = () => sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });

  let format: string | undefined;
  try {
    format = (await decode().metadata()).format;
  } catch {
    throw new InvalidImageError("not a readable image");
  }
  if (!format || !ACCEPTED_FORMATS[format]) {
    throw new InvalidImageError("only JPEG, PNG and WebP pictures are accepted");
  }

  try {
    // No .withMetadata(): sharp omits all metadata from the output by default.
    const upright = () => decode().rotate();
    const main = await upright()
      .resize(MAIN_EDGE, MAIN_EDGE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    const thumb = await upright()
      .resize(THUMB_EDGE, THUMB_EDGE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();
    return {
      main: main.data,
      thumb,
      width: main.info.width,
      height: main.info.height,
    };
  } catch {
    throw new InvalidImageError("image could not be processed");
  }
}
