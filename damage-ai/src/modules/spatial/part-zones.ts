import type { ViewAngle } from "@/types/m02.v1.js";

export type PartZone = {
  yMin: number;
  yMax: number;
};

/** Normalized Y centroid range per view + part (heuristic for Indian survey photos). */
export const PART_ZONES_BY_VIEW: Partial<
  Record<ViewAngle, Partial<Record<string, PartZone>>>
> = {
  Front: {
    "Front Bumper": { yMin: 0.45, yMax: 0.76 },
    "Hood / Bonnet": { yMin: 0.2, yMax: 0.55 },
    "Front Grille": { yMin: 0.35, yMax: 0.65 },
    "Front Windshield": { yMin: 0.1, yMax: 0.45 },
    "Headlamp (L)": { yMin: 0.35, yMax: 0.65 },
    "Headlamp (R)": { yMin: 0.35, yMax: 0.65 },
    "Fog Lamp (L)": { yMin: 0.5, yMax: 0.75 },
    "Fog Lamp (R)": { yMin: 0.5, yMax: 0.75 },
    "Front Fender (L)": { yMin: 0.35, yMax: 0.7 },
    "Front Fender (R)": { yMin: 0.35, yMax: 0.7 },
  },
  Rear: {
    "Rear Bumper": { yMin: 0.45, yMax: 0.76 },
    "Dicky / Boot Lid": { yMin: 0.25, yMax: 0.55 },
    "Tail Lamp (L)": { yMin: 0.35, yMax: 0.65 },
    "Tail Lamp (R)": { yMin: 0.35, yMax: 0.65 },
    "Rear Windshield": { yMin: 0.1, yMax: 0.45 },
    "Number Plate Panel": { yMin: 0.5, yMax: 0.74 },
    "Rear Fender (L)": { yMin: 0.35, yMax: 0.72 },
    "Rear Fender (R)": { yMin: 0.35, yMax: 0.72 },
    "Rear Door (L)": { yMin: 0.35, yMax: 0.72 },
    "Rear Door (R)": { yMin: 0.35, yMax: 0.72 },
  },
  Left: {
    "Front Fender (L)": { yMin: 0.3, yMax: 0.65 },
    "Front Door (L)": { yMin: 0.3, yMax: 0.65 },
    "Rear Door (L)": { yMin: 0.35, yMax: 0.72 },
    "Rear Fender (L)": { yMin: 0.35, yMax: 0.72 },
    "Rocker Panel (L)": { yMin: 0.45, yMax: 0.72 },
    "Side Mirror (L)": { yMin: 0.25, yMax: 0.5 },
  },
  Right: {
    "Front Fender (R)": { yMin: 0.3, yMax: 0.65 },
    "Front Door (R)": { yMin: 0.3, yMax: 0.65 },
    "Rear Door (R)": { yMin: 0.35, yMax: 0.72 },
    "Rear Fender (R)": { yMin: 0.35, yMax: 0.72 },
    "Rocker Panel (R)": { yMin: 0.45, yMax: 0.72 },
    "Side Mirror (R)": { yMin: 0.25, yMax: 0.5 },
  },
};

export function getPartZone(
  viewAngle: ViewAngle,
  partName: string,
): PartZone | undefined {
  return PART_ZONES_BY_VIEW[viewAngle]?.[partName];
}

export function bboxCentroidY(bbox: { y_min: number; y_max: number }): number {
  return (bbox.y_min + bbox.y_max) / 2;
}

export function isCentroidOutsidePartZone(
  partName: string,
  centroidY: number,
  viewAngle: ViewAngle,
): boolean {
  const zone = getPartZone(viewAngle, partName);
  if (!zone) return false;
  return centroidY < zone.yMin || centroidY > zone.yMax;
}
