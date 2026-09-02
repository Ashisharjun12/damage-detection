import type { NormalizedBBox } from "@/types/m02.v1.js";
import { bboxArea } from "@/infrastructure/gemini/bbox.adapter.js";

export function bboxIoU(a: NormalizedBBox, b: NormalizedBBox): number {
  const x1 = Math.max(a.x_min, b.x_min);
  const y1 = Math.max(a.y_min, b.y_min);
  const x2 = Math.min(a.x_max, b.x_max);
  const y2 = Math.min(a.y_max, b.y_max);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = bboxArea(a) + bboxArea(b) - inter;
  return union <= 0 ? 0 : inter / union;
}

export function isValidBboxArea(bbox: NormalizedBBox): boolean {
  const area = bboxArea(bbox);
  return area >= 0.001 && area <= 0.95;
}
