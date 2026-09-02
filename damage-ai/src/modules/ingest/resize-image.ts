import sharp from "sharp";
import { envConfig } from "@/config/env.js";

/** Resize a copy for Gemini vision API (lower token cost). */
export async function resizeForGemini(buffer: Buffer): Promise<Buffer> {
  const maxEdge = envConfig.GEMINI_IMAGE_MAX_EDGE;
  const meta = await sharp(buffer).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const longEdge = Math.max(w, h);

  if (longEdge <= maxEdge) return buffer;

  return sharp(buffer)
    .resize({
      width: w >= h ? maxEdge : undefined,
      height: h > w ? maxEdge : undefined,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();
}
