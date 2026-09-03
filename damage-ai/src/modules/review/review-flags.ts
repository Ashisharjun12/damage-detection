import type { DamageInstance, ImageResult } from "@/types/m02.v1.js";
import {
  HIGH_RISK_PARTS,
  HIGH_RISK_TYPES,
} from "@/modules/scoring/repair-replace-rules.js";
import { envConfig } from "@/config/env.js";

export function buildReviewFlags(
  images: ImageResult[],
  instances: DamageInstance[],
  extraFlags: string[] = [],
): { flags: string[]; requires_human_review: boolean } {
  const flags: string[] = [...extraFlags];
  const threshold = envConfig.CONFIDENCE_REVIEW_THRESHOLD;

  for (const img of images) {
    if (img.processing_status === "REVIEW_REQUIRED") {
      flags.push(`image:${img.image_id}:quality`);
    }
    if (img.view_conflict) flags.push(`image:${img.image_id}:view_conflict`);
    if (img.error_code) {
      flags.push(`image:${img.image_id}:${img.error_code}`);
      if (
        img.error_code === "NO_DAMAGE_FOUND" ||
        img.error_code === "UNREADABLE_DOCUMENT" ||
        img.error_code === "NOT_VEHICLE" ||
        img.error_code === "LOW_QUALITY"
      ) {
        flags.push(`review_required:${img.image_id}`);
      }
    }
  }

  for (const d of instances) {
    if (d.confidence < threshold) {
      flags.push(`low_confidence:${d.instance_id}`);
    }
    if (
      d.severity === "Severe" ||
      HIGH_RISK_PARTS.includes(d.part_name) ||
      HIGH_RISK_TYPES.includes(d.damage_type)
    ) {
      flags.push(`high_risk:${d.instance_id}`);
    }
  }

  return {
    flags,
    requires_human_review: flags.length > 0,
  };
}
