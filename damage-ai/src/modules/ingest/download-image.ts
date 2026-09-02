import sharp from "sharp";
import { envConfig } from "@/config/env.js";
import { fetchImageBytes } from "@/infrastructure/storage/r2.client.js";
import {
  computePhash,
  computeSha256,
  computeSharpnessScore,
} from "@/modules/ingest/fingerprint.js";

const MIN_EDGE = 640;

export type ProcessedImage = {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  sha256: string;
  phash: string;
  sharpness: number;
};

export async function downloadImage(url: string): Promise<ProcessedImage> {
  const { buffer, mimeType } = await fetchImageBytes(url);
  const sha256 = await computeSha256(buffer);

  let pipeline = sharp(buffer).rotate();
  const meta = await pipeline.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const longEdge = Math.max(w, h);

  if (longEdge < MIN_EDGE) {
    throw new Error("LOW_RESOLUTION");
  }

  if (longEdge > envConfig.IMAGE_MAX_EDGE) {
    pipeline = pipeline.resize({
      width: w >= h ? envConfig.IMAGE_MAX_EDGE : undefined,
      height: h > w ? envConfig.IMAGE_MAX_EDGE : undefined,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  const outBuffer = await pipeline.jpeg({ quality: 90 }).toBuffer();
  const outMeta = await sharp(outBuffer).metadata();
  const phash = await computePhash(outBuffer);
  const sharpness = await computeSharpnessScore(outBuffer);

  return {
    buffer: outBuffer,
    mimeType: "image/jpeg",
    width: outMeta.width ?? 0,
    height: outMeta.height ?? 0,
    sha256,
    phash,
    sharpness,
  };
}
