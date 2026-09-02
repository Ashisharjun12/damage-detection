import type { NormalizedBBox } from "@/types/m02.v1.js";

export function box2dToNormalized(box2d: number[]): NormalizedBBox {
  const [ymin, xmin, ymax, xmax] = box2d;
  const x_min = Math.max(0, Math.min(1, xmin / 1000));
  const y_min = Math.max(0, Math.min(1, ymin / 1000));
  const x_max = Math.max(0, Math.min(1, xmax / 1000));
  const y_max = Math.max(0, Math.min(1, ymax / 1000));
  return {
    x_min: Math.min(x_min, x_max),
    y_min: Math.min(y_min, y_max),
    x_max: Math.max(x_min, x_max),
    y_max: Math.max(y_min, y_max),
  };
}

export function clampBBox(bbox: NormalizedBBox): NormalizedBBox {
  return {
    x_min: Math.max(0, Math.min(1, bbox.x_min)),
    y_min: Math.max(0, Math.min(1, bbox.y_min)),
    x_max: Math.max(0, Math.min(1, bbox.x_max)),
    y_max: Math.max(0, Math.min(1, bbox.y_max)),
  };
}

export function bboxArea(bbox: NormalizedBBox): number {
  return Math.max(0, bbox.x_max - bbox.x_min) * Math.max(0, bbox.y_max - bbox.y_min);
}
