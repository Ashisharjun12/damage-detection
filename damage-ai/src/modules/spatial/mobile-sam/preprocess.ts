import sharp from "sharp";
import type { SamTransform } from "@/modules/spatial/mobile-sam/types.js";

const SAM_SIZE = 1024;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

export async function preprocessForSam(imageBuffer: Buffer): Promise<{
  tensorData: Float32Array;
  transform: SamTransform;
}> {
  const meta = await sharp(imageBuffer).metadata();
  const originalWidth = meta.width ?? 0;
  const originalHeight = meta.height ?? 0;
  if (!originalWidth || !originalHeight) {
    throw new Error("Cannot preprocess image: missing dimensions");
  }

  const scale = SAM_SIZE / Math.max(originalWidth, originalHeight);
  const resizedWidth = Math.round(originalWidth * scale);
  const resizedHeight = Math.round(originalHeight * scale);

  const { data } = await sharp(imageBuffer)
    .resize(resizedWidth, resizedHeight, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const tensorData = new Float32Array(SAM_SIZE * SAM_SIZE * 3);

  for (let y = 0; y < resizedHeight; y++) {
    for (let x = 0; x < resizedWidth; x++) {
      const srcIdx = (y * resizedWidth + x) * 3;
      const r = data[srcIdx] / 255;
      const g = data[srcIdx + 1] / 255;
      const b = data[srcIdx + 2] / 255;
      const dst = (y * SAM_SIZE + x) * 3;
      tensorData[dst] = (r - MEAN[0]) / STD[0];
      tensorData[dst + 1] = (g - MEAN[1]) / STD[1];
      tensorData[dst + 2] = (b - MEAN[2]) / STD[2];
    }
  }

  return {
    tensorData,
    transform: {
      originalWidth,
      originalHeight,
      resizedWidth,
      resizedHeight,
    },
  };
}

export function normalizedBoxToSamPixels(
  bbox: { x_min: number; y_min: number; x_max: number; y_max: number },
  transform: SamTransform,
): [number, number, number, number] {
  const x1 = bbox.x_min * transform.resizedWidth;
  const y1 = bbox.y_min * transform.resizedHeight;
  const x2 = bbox.x_max * transform.resizedWidth;
  const y2 = bbox.y_max * transform.resizedHeight;
  return [x1, y1, x2, y2];
}
