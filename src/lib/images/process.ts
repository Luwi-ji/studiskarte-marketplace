import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel Hobby request limit is 4.5 MB.

// "photo": post photos keep their shape. "avatar": profile pictures are
// cropped to a centred square.
export type ImageShape = "photo" | "avatar";
const SHAPES: Record<ImageShape, { main: number; thumb: number; fit: "inside" | "cover" }> = {
  photo: { main: 1600, thumb: 400, fit: "inside" },
  avatar: { main: 512, thumb: 128, fit: "cover" },
};
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
 * owner), applies the camera's rotation first, and resizes per `shape`
 * (photo: 1600 px plus a 400 px thumbnail; avatar: 512 px square plus 128 px).
 */
export async function processImage(input: Buffer, shape: ImageShape = "photo"): Promise<ProcessedImage> {
  const size = SHAPES[shape];
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
      .resize(size.main, size.main, { fit: size.fit, withoutEnlargement: size.fit === "inside" })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    const thumb = await upright()
      .resize(size.thumb, size.thumb, { fit: size.fit, withoutEnlargement: size.fit === "inside" })
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
