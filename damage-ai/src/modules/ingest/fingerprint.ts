import crypto from "node:crypto";
import sharp from "sharp";

export async function computeSha256(buffer: Buffer): Promise<string> {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function computePhash(buffer: Buffer): Promise<string> {
  const { data } = await sharp(buffer)
    .resize(8, 8, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = Array.from(data) as number[];
  const avg = pixels.reduce((a, b) => a + b, 0) / pixels.length;
  let bits = "";
  for (const p of pixels) bits += p >= avg ? "1" : "0";
  return bits;
}

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

export async function computeSharpnessScore(buffer: Buffer): Promise<number> {
  const stats = await sharp(buffer).stats();
  return stats.channels[0]?.stdev ?? 0;
}
