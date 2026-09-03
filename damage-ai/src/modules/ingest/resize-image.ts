import sharp from "sharp";
import { envConfig } from "@/config/env.js";

export type VisionImage = {
  buffer: Buffer;
  width: number;
  height: number;
};

/** Canonical vision buffer sent to Gemini (lower token cost). */
export async function prepareVisionImage(
  buffer: Buffer,
  maxEdge = envConfig.GEMINI_IMAGE_MAX_EDGE,
): Promise<VisionImage> {
  const meta = await sharp(buffer).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const longEdge = Math.max(w, h);

  if (longEdge <= maxEdge) {
    return { buffer, width: w, height: h };
  }

  const resized = await sharp(buffer)
    .resize({
      width: w >= h ? maxEdge : undefined,
      height: h > w ? maxEdge : undefined,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();

  const outMeta = await sharp(resized).metadata();
  return {
    buffer: resized,
    width: outMeta.width ?? 0,
    height: outMeta.height ?? 0,
  };
}

/** Resize a copy for Gemini vision API (lower token cost). */
export async function resizeForGemini(buffer: Buffer): Promise<Buffer> {
  const vision = await prepareVisionImage(buffer);
  return vision.buffer;
}

/** Uniform upscale of annotated composite for full-res R2 storage. */
export async function upscaleImage(
  buffer: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  return sharp(buffer)
    .resize({ width, height, fit: "fill" })
    .jpeg({ quality: 92 })
    .toBuffer();
}
