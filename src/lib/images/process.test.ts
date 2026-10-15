import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { InvalidImageError, processImage } from "./process";

async function jpegWithGps(width: number, height: number) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 30, b: 30 } },
  })
    .withExif({
      IFD0: { Make: "SecretCameraCo" },
      IFD3: {
        GPSLatitudeRef: "N",
        GPSLatitude: "14/1 35/1 0/1",
        GPSLongitudeRef: "E",
        GPSLongitude: "121/1 0/1 0/1",
      },
    })
    .jpeg()
    .toBuffer();
}

describe("processImage", () => {
  it("strips GPS and camera metadata", async () => {
    const input = await jpegWithGps(800, 600);
    // Precondition: the test image really carries the metadata.
    const before = await sharp(input).metadata();
    expect(before.exif).toBeDefined();
    expect(input.includes(Buffer.from("SecretCameraCo"))).toBe(true);

    const { main, thumb } = await processImage(input);
    for (const output of [main, thumb]) {
      expect((await sharp(output).metadata()).exif).toBeUndefined();
      expect(output.includes(Buffer.from("SecretCameraCo"))).toBe(false);
      expect(output.includes(Buffer.from("GPS"))).toBe(false);
    }
  });

  it("applies camera rotation before dropping it", async () => {
    // Orientation 6 means "rotate 90° to display": stored 800x600 shows as 600x800.
    const input = await sharp({
      create: { width: 800, height: 600, channels: 3, background: "#c81e1e" },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    expect((await sharp(input).metadata()).orientation).toBe(6);
    const { width, height } = await processImage(input);
    expect({ width, height }).toEqual({ width: 600, height: 800 });
  });

  it("shrinks large pictures to 1600 px and writes a 400 px thumbnail", async () => {
    const input = await sharp({
      create: { width: 3200, height: 2400, channels: 3, background: "#336699" },
    })
      .png()
      .toBuffer();
    const { main, thumb, width, height } = await processImage(input);
    expect({ width, height }).toEqual({ width: 1600, height: 1200 });
    expect((await sharp(thumb).metadata()).width).toBe(400);
    expect((await sharp(main).metadata()).format).toBe("webp");
  });

  it("does not enlarge small pictures", async () => {
    const input = await jpegWithGps(100, 80);
    const { width, height } = await processImage(input);
    expect({ width, height }).toEqual({ width: 100, height: 80 });
  });
  it.each([
    ["text", async () => Buffer.from("not an image")],
    ["empty", async () => Buffer.alloc(0)],
    [
      "svg",
      async () => Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'),
    ],
    ["truncated jpeg", async () => (await jpegWithGps(50, 50)).subarray(0, 200)],
  ])("rejects %s", async (_label, build) => {
    await expect(processImage(await build())).rejects.toBeInstanceOf(InvalidImageError);
  });

  it("rejects a gif even though sharp can read it", async () => {
    const gif = await sharp({
      create: { width: 10, height: 10, channels: 3, background: "#000" },
    })
      .gif()
      .toBuffer();
    await expect(processImage(gif)).rejects.toBeInstanceOf(InvalidImageError);
  });

  it("rejects files over the upload limit", async () => {
    await expect(processImage(Buffer.alloc(4 * 1024 * 1024 + 1))).rejects.toBeInstanceOf(
      InvalidImageError,
    );
  });
});
