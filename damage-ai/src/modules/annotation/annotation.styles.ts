import type { DamageInstance } from "@/types/m02.v1.js";

export const COLORS = {
  Repair: "#22c55e",
  Replace: "#ef4444",
  Moderate: "#f97316",
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

export function buildDamageOverlaySvg(
  damages: DamageInstance[],
  width: number,
  height: number,
): string {
  const overlays = damages.flatMap((d, i) => bboxOverlay(d, i, width, height));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${overlays.join("")}</svg>`;
}

/** Pixel rect for a normalized bbox (for tests). */
export function bboxToPixelRect(
  bbox: DamageInstance["bounding_box"],
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  return {
    x: Math.round(bbox.x_min * width),
    y: Math.round(bbox.y_min * height),
    w: Math.round((bbox.x_max - bbox.x_min) * width),
    h: Math.round((bbox.y_max - bbox.y_min) * height),
  };
}
