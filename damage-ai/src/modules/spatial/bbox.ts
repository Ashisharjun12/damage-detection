import type { NormalizedBBox } from "@/types/m02.v1.js";
import { bboxArea } from "@/infrastructure/gemini/bbox.adapter.js";

const MAX_Y_MAX = 0.92;
const MAX_AREA = 0.4;

export function isGroundOrAnomalyBox(bbox: NormalizedBBox): boolean {
  if (bbox.y_max > MAX_Y_MAX) return true;
  if (bboxArea(bbox) > MAX_AREA) return true;
  return false;
}

export function filterGroundReject<T extends { bounding_box: NormalizedBBox }>(
  items: T[],
): T[] {
  return items.filter((item) => !isGroundOrAnomalyBox(item.bounding_box));
}
