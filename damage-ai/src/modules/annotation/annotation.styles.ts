import type { DamageInstance } from "@/types/m02.v1.js";
import type { MaskAnnotatedDamage } from "@/modules/detection/judge-region.js";

export const COLORS = {
  Repair: "#22c55e",
  Replace: "#ef4444",
  Moderate: "#f97316",
  MaskFill: "rgba(34, 197, 94, 0.35)",
  MaskStroke: "#22c55e",
};

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function boxColor(d: DamageInstance): string {
  if (d.recommendation === "Replace") return COLORS.Replace;
  if (d.severity === "Moderate") return COLORS.Moderate;
  return COLORS.Repair;
}

export function maskStrokeColor(d: DamageInstance): string {
  return boxColor(d);
}

export function buildLabel(d: DamageInstance, index: number): string {
  const text = `${d.part_name} - ${d.damage_type} - ${d.severity} - ${d.recommendation}`;
  const truncated = text.length > 72 ? `${text.slice(0, 69)}...` : text;
  return escapeXml(`${index + 1}. ${truncated}`);
}

function bboxOverlay(
  d: DamageInstance,
  index: number,
  width: number,
  height: number,
): string[] {
  const x = Math.round(d.bounding_box.x_min * width);
  const y = Math.round(d.bounding_box.y_min * height);
  const w = Math.round((d.bounding_box.x_max - d.bounding_box.x_min) * width);
  const h = Math.round((d.bounding_box.y_max - d.bounding_box.y_min) * height);
  const color = boxColor(d);
  const label = buildLabel(d, index);
  const labelY = y > 36 ? y - 8 : y + h + 20;
  const labelX = Math.min(x, width - 220);

  return [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${color}" stroke-width="3"/>`,
    `<rect x="${labelX}" y="${labelY - 18}" width="220" height="22" fill="${color}" opacity="0.85"/>`,
    `<text x="${labelX + 4}" y="${labelY}" fill="#ffffff" font-size="14" font-family="Arial, sans-serif">${label}</text>`,
  ];
}

function maskCentroid(
  mask: Uint8Array,
  width: number,
  height: number,
): { x: number; y: number } {
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        sumX += x;
        sumY += y;
        count++;
      }
    }
  }
  if (!count) return { x: width / 2, y: height / 2 };
  return { x: sumX / count, y: sumY / count };
}

function maskOverlay(
  d: MaskAnnotatedDamage,
  index: number,
  width: number,
  height: number,
): string[] {
  const color = maskStrokeColor(d);
  const label = buildLabel(d, index);
  const centroid = maskCentroid(d.mask, d.maskWidth, d.maskHeight);
  const labelX = Math.min(Math.round(centroid.x), width - 220);
  const labelY = centroid.y > 36 ? centroid.y - 8 : centroid.y + 20;

  return [
    `<rect x="${labelX}" y="${labelY - 18}" width="220" height="22" fill="${color}" opacity="0.85"/>`,
    `<text x="${labelX + 4}" y="${labelY}" fill="#ffffff" font-size="14" font-family="Arial, sans-serif">${label}</text>`,
  ];
}

export function buildDamageOverlaySvg(
  damages: DamageInstance[],
  width: number,
  height: number,
): string {
  const overlays = damages.flatMap((d, i) => bboxOverlay(d, i, width, height));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${overlays.join("")}</svg>`;
}

export function buildMaskOverlaySvg(
  damages: MaskAnnotatedDamage[],
  width: number,
  height: number,
): string {
  const overlays = damages.flatMap((d, i) => maskOverlay(d, i, width, height));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${overlays.join("")}</svg>`;
}
