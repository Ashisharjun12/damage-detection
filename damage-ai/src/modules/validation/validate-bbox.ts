import type { DamageInstance, NormalizedBBox } from "@/types/m02.v1.js";
import { bboxArea } from "@/infrastructure/gemini/bbox.adapter.js";
import { isCosmeticMinorDamage } from "@/infrastructure/gemini/prompts/damage-detection.js";
import { bboxIoU } from "@/modules/spatial/iou.js";
import { recommendForSeverity } from "@/modules/scoring/repair-replace-rules.js";
import { envConfig } from "@/config/env.js";

const SCRATCH_PAINT_MAX_AREA = 0.25;
const SCRATCH_MAX_WIDTH = 0.55;
const SEVERE_CAP_MAX_AREA = 0.05;

export function isOversizedScratchPaintBox(
  bbox: NormalizedBBox,
  damageType: string,
): boolean {
  const area = bboxArea(bbox);
  const width = bbox.x_max - bbox.x_min;
  if (damageType === "Scratch" && width > SCRATCH_MAX_WIDTH) return true;
  if (
    (damageType === "Scratch" || damageType === "Paint Damage") &&
    area > SCRATCH_PAINT_MAX_AREA
  ) {
    return true;
  }
  return false;
}

export function filterBboxSanity(instances: DamageInstance[]): DamageInstance[] {
  return instances.filter(
    (inst) => !isOversizedScratchPaintBox(inst.bounding_box, inst.damage_type),
  );
}

export function filterCosmeticMinor(instances: DamageInstance[]): {
  instances: DamageInstance[];
  flags: string[];
} {
  const flags: string[] = [];
  const kept = instances.filter((inst) => {
    if (isCosmeticMinorDamage(inst.severity, inst.damage_type)) {
      flags.push(`cosmetic_minor_dropped:${inst.instance_id}`);
      return false;
    }
    return true;
  });
  return { instances: kept, flags };
}

export function applySeveritySanity(instances: DamageInstance[]): {
  instances: DamageInstance[];
  flags: string[];
} {
  const flags: string[] = [];
  const adjusted = instances.map((inst) => {
    if (
      inst.damage_type === "Deformation" &&
      inst.severity === "Severe" &&
      bboxArea(inst.bounding_box) < SEVERE_CAP_MAX_AREA
    ) {
      flags.push(`severity_capped:${inst.instance_id}`);
      const severity = "Moderate" as const;
      return {
        ...inst,
        severity,
        recommendation: recommendForSeverity(severity, inst.part_name),
      };
    }
    return inst;
  });
  return { instances: adjusted, flags };
}

export function dedupeInstances(instances: DamageInstance[]): DamageInstance[] {
  const threshold = envConfig.BBOX_MERGE_IOU_THRESHOLD;
  const kept: DamageInstance[] = [];

  for (const inst of instances) {
    const duplicate = kept.some(
      (k) =>
        k.part_name === inst.part_name &&
        k.damage_type === inst.damage_type &&
        bboxIoU(k.bounding_box, inst.bounding_box) >= threshold,
    );
    if (!duplicate) kept.push(inst);
  }

  return kept;
}

export function applyConfidenceGate(instances: DamageInstance[]): string[] {
  const flags: string[] = [];
  const threshold = envConfig.CONFIDENCE_REVIEW_THRESHOLD;
  for (const inst of instances) {
    if (inst.confidence < threshold) {
      flags.push(`low_confidence:${inst.instance_id}`);
    }
  }
  return flags;
}
