import { z } from "zod";
import {
  DAMAGE_TYPES,
  SEVERITIES,
  VIEW_ANGLES,
} from "@/types/m02.v1.js";

export const groundedResponseSchema = z.object({
  is_damage: z.boolean(),
  false_positive_reason: z.string().optional(),
  part_name: z.string().optional(),
  damage_type: z.enum(DAMAGE_TYPES).optional(),
  severity: z.enum(SEVERITIES).optional(),
  confidence: z.number().min(0).max(1).optional(),
  visibility: z.enum(["FULL", "PARTIAL", "OCCLUDED"]).optional(),
  location_on_part: z.string().optional(),
  side: z.string().optional(),
});

export type GroundedParsedResponse = z.infer<typeof groundedResponseSchema>;

export const viewDetectionSchema = z.object({
  view_angle: z.enum(VIEW_ANGLES),
  view_confidence: z.number().min(0).max(1).optional(),
  image_quality: z
    .enum(["OK", "LOW_QUALITY", "LOW_RESOLUTION", "INVALID_IMAGE"])
    .optional(),
});

export type ViewDetectionResponse = z.infer<typeof viewDetectionSchema>;
