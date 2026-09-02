import sharp from "sharp";
import type { DamageInstance } from "@/types/m02.v1.js";
import type { MaskAnnotatedDamage } from "@/modules/detection/judge-region.js";
import {
  buildDamageOverlaySvg,
  boxColor,
  buildLabel,
} from "@/modules/annotation/annotation.styles.js";

function buildMaskLabelSvg(
  damages: MaskAnnotatedDamage[],
  width: number,
  height: number,
): string {
  const overlays: string[] = [];
  for (let i = 0; i < damages.length; i++) {
    const d = damages[i];
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (let y = 0; y < d.maskHeight; y++) {
      for (let x = 0; x < d.maskWidth; x++) {
        if (d.mask[y * d.maskWidth + x]) {
          sumX += x;
          sumY += y;
          count++;
        }
      }
    }
    const cx = count ? sumX / count : width / 2;
    const cy = count ? sumY / count : height / 2;
    const color = boxColor(d);
    const label = buildLabel(d, i);
    const labelX = Math.min(Math.round(cx), width - 220);
    const labelY = cy > 36 ? cy - 8 : cy + 20;
    overlays.push(
      `<rect x="${labelX}" y="${labelY - 18}" width="220" height="22" fill="${color}" opacity="0.85"/>`,
      `<text x="${labelX + 4}" y="${labelY}" fill="#ffffff" font-size="14" font-family="Arial, sans-serif">${label}</text>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${overlays.join("")}</svg>`;
}

function buildMaskFillBuffer(
  damages: MaskAnnotatedDamage[],
  width: number,
  height: number,
): Buffer {
  const overlay = Buffer.alloc(width * height * 4);
  for (const d of damages) {
    const color = boxColor(d);
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (!d.mask[idx]) continue;
        const out = idx * 4;
        overlay[out] = r;
        overlay[out + 1] = g;
        overlay[out + 2] = b;
        overlay[out + 3] = 110;
      }
    }
  }
  return overlay;
}

export async function renderAnnotation(
  imageBuffer: Buffer,
  damages: DamageInstance[],
  width: number,
  height: number,
): Promise<Buffer> {
  if (damages.length === 0) return imageBuffer;

  if (!width || !height) {
    const meta = await sharp(imageBuffer).metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
  }
  if (!width || !height) {
    throw new Error("Cannot annotate image: missing dimensions");
  }

  const svg = buildDamageOverlaySvg(damages, width, height);

  return sharp(imageBuffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer();
}

export async function renderMaskAnnotation(
  imageBuffer: Buffer,
  damages: MaskAnnotatedDamage[],
  width: number,
  height: number,
): Promise<Buffer> {
  if (damages.length === 0) return imageBuffer;

  if (!width || !height) {
    const meta = await sharp(imageBuffer).metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
  }
  if (!width || !height) {
    throw new Error("Cannot annotate image: missing dimensions");
  }

  const maskFill = buildMaskFillBuffer(damages, width, height);
  const labelSvg = buildMaskLabelSvg(damages, width, height);

  return sharp(imageBuffer)
    .composite([
      {
        input: maskFill,
        raw: { width, height, channels: 4 },
        blend: "over",
      },
      { input: Buffer.from(labelSvg), top: 0, left: 0 },
    ])
    .jpeg({ quality: 92 })
    .toBuffer();
}
