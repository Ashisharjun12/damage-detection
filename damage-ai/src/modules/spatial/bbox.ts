import type { DamageInstance, NormalizedBBox, ViewAngle } from "@/types/m02.v1.js";
import { box2dToNormalized, clampBBox, bboxArea } from "@/infrastructure/gemini/bbox.adapter.js";
import {
  bboxCentroidY,
  getPartZone,
  isCentroidOutsidePartZone,
} from "@/modules/spatial/part-zones.js";

const MAX_Y_MAX = 0.88;
const MAX_AREA = 0.4;
const GROUND_BAND_Y_MIN = 0.68;
const GROUND_BAND_Y_MAX = 0.72;
const GROUND_CENTROID_Y_MAX = 0.74;
const VEHICLE_CENTROID_MARGIN = 0.01;

export { bboxCentroidY };

export function bboxCentroid(bbox: NormalizedBBox): { x: number; y: number } {
  return {
    x: (bbox.x_min + bbox.x_max) / 2,
    y: bboxCentroidY(bbox),
  };
}

export function isCentroidInsideBBox(
  bbox: NormalizedBBox,
  container: NormalizedBBox,
  margin = VEHICLE_CENTROID_MARGIN,
): boolean {
  const { x, y } = bboxCentroid(bbox);
  return (
    x >= container.x_min + margin &&
    x <= container.x_max - margin &&
    y >= container.y_min + margin &&
    y <= container.y_max - margin
  );
}

export function isGroundSurfaceBox(bbox: NormalizedBBox): boolean {
  if (bbox.y_min >= GROUND_BAND_Y_MIN && bbox.y_max >= GROUND_BAND_Y_MAX) {
    return true;
  }
  if (bboxCentroidY(bbox) >= GROUND_CENTROID_Y_MAX) return true;
  return false;
}

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

export function isRoadBandBox(bbox: NormalizedBBox, partName: string): boolean {
  if (!/Bumper/i.test(partName)) return false;
  return bbox.y_min >= GROUND_BAND_Y_MIN && bbox.y_max >= GROUND_BAND_Y_MAX;
}

export function isPartSpatialAnomaly(
  partName: string,
  bbox: NormalizedBBox,
  viewAngle: ViewAngle,
): boolean {
  if (isGroundSurfaceBox(bbox)) return true;

  const cy = bboxCentroidY(bbox);
  if (isCentroidOutsidePartZone(partName, cy, viewAngle)) return true;
  if (isRoadBandBox(bbox, partName)) return true;

  const zone = getPartZone(viewAngle, partName);
  if (zone && /Bumper/i.test(partName) && bbox.y_max > zone.yMax) return true;

  return false;
}

export function filterPartSpatialSanity(
  instances: DamageInstance[],
  viewAngle: ViewAngle,
): DamageInstance[] {
  return instances.filter(
    (inst) => !isPartSpatialAnomaly(inst.part_name, inst.bounding_box, viewAngle),
  );
}

function damageInsideVehicleRatio(
  damage: NormalizedBBox,
  vehicle: NormalizedBBox,
): number {
  const xMin = Math.max(damage.x_min, vehicle.x_min);
  const yMin = Math.max(damage.y_min, vehicle.y_min);
  const xMax = Math.min(damage.x_max, vehicle.x_max);
  const yMax = Math.min(damage.y_max, vehicle.y_max);
  const inter = Math.max(0, xMax - xMin) * Math.max(0, yMax - yMin);
  const damageArea = bboxArea(damage);
  return damageArea > 0 ? inter / damageArea : 0;
}

export function shrinkVehicleBBoxBottom(
  vehicle: NormalizedBBox,
  trimRatio: number,
): NormalizedBBox {
  if (trimRatio <= 0) return vehicle;
  const height = vehicle.y_max - vehicle.y_min;
  const trimmedYMax = vehicle.y_max - height * trimRatio;
  if (trimmedYMax <= vehicle.y_min) return vehicle;
  return { ...vehicle, y_max: trimmedYMax };
}

export function filterOutsideVehicleBBox(
  instances: DamageInstance[],
  vehicleBbox: number[] | undefined,
  minInsideRatio = 0.75,
  trimBottom = 0.08,
): DamageInstance[] {
  if (!vehicleBbox || vehicleBbox.length !== 4) return instances;
  const vehicle = shrinkVehicleBBoxBottom(
    clampBBox(box2dToNormalized(vehicleBbox)),
    trimBottom,
  );
  return instances.filter((inst) => {
    const damage = inst.bounding_box;
    if (!isCentroidInsideBBox(damage, vehicle)) return false;
    return damageInsideVehicleRatio(damage, vehicle) >= minInsideRatio;
  });
}

/** Boxes low on the image that may be ground-adjacent false positives. */
export function isBorderlineGroundAdjacentBox(bbox: NormalizedBBox): boolean {
  return bbox.y_min >= 0.65;
}
