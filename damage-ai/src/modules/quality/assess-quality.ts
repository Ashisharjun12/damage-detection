import sharp from "sharp";

export type QualityResult = {
  status: "OK" | "LOW_QUALITY" | "INVALID_IMAGE";
  reason?: string;
};

export async function assessQuality(buffer: Buffer): Promise<QualityResult> {
  const stats = await sharp(buffer).stats();
  const r = stats.channels[0];
  const mean = (r?.mean ?? 128) / 255;
  const stdev = (r?.stdev ?? 30) / 255;

  if (mean < 0.08) return { status: "LOW_QUALITY", reason: "too_dark" };
  if (mean > 0.95) return { status: "LOW_QUALITY", reason: "overexposed" };
  if (stdev < 0.03) {
    return { status: "LOW_QUALITY", reason: "low_contrast_or_blur" };
  }

  return { status: "OK" };
}
