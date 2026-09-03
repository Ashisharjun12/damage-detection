import sharp from "sharp";
import type { DamageInstance } from "@/types/m02.v1.js";
import { buildDamageOverlaySvg } from "@/modules/annotation/annotation.styles.js";
import { logger } from "@/shared/logger.js";

async function resolveDimensions(
  imageBuffer: Buffer,
  width: number,
  height: number,
): Promise<{ width: number; height: number }> {
  const meta = await sharp(imageBuffer).metadata();
  const bufW = meta.width ?? 0;
  const bufH = meta.height ?? 0;

  if (!width || !height) {
    return { width: bufW, height: bufH };
  }

  if (bufW && bufH && (bufW !== width || bufH !== height)) {
    logger.warn(
      { passed: { width, height }, buffer: { width: bufW, height: bufH } },
      "annotation dimensions mismatch — using buffer metadata",
    );
    return { width: bufW, height: bufH };
  }

  return { width, height };
}

export async function renderAnnotation(
  imageBuffer: Buffer,
  damages: DamageInstance[],
  width: number,
  height: number,
): Promise<Buffer> {
  if (damages.length === 0) return imageBuffer;

  const dims = await resolveDimensions(imageBuffer, width, height);
  if (!dims.width || !dims.height) {
    throw new Error("Cannot annotate image: missing dimensions");
  }

  const svg = buildDamageOverlaySvg(damages, dims.width, dims.height);

  return sharp(imageBuffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer();
}
