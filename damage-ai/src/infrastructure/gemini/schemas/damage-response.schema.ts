import { z } from "zod";
import {
  DAMAGE_TYPES,
  SEVERITIES,
  VIEW_ANGLES,
} from "@/types/m02.v1.js";
import { envConfig } from "@/config/env.js";

export const assessmentRequestSchema = z.object({
  request_id: z.string().min(1),
  survey_id: z.string().min(1),
  idempotency_key: z.string().min(1),
  images: z
    .array(
      z.object({
        image_id: z.string().min(1),
        url: z.string().url(),
        declared_view: z.string().optional(),
      }),
    )
    .min(1)
    .max(envConfig.MAX_IMAGES_PER_REQUEST),
});

export const geminiDamageItemSchema = z.object({
  part_name: z.string(),
  damage_type: z.enum(DAMAGE_TYPES),
  severity: z.enum(SEVERITIES),
  box_2d: z.array(z.number()).length(4),
  location_on_part: z.string().optional(),
  side: z.string().optional(),
  confidence: z.number().min(0).max(1),
  visibility: z.enum(["FULL", "PARTIAL", "OCCLUDED"]).optional(),
});

export const geminiResponseSchema = z.object({
  view_angle: z.enum(VIEW_ANGLES),
  view_confidence: z.number().min(0).max(1).optional(),
  vehicle_count: z.number().int().optional(),
  image_quality: z
    .enum(["OK", "LOW_QUALITY", "LOW_RESOLUTION", "INVALID_IMAGE"])
    .optional(),
  damages: z.array(geminiDamageItemSchema),
});

export type GeminiParsedResponse = z.infer<typeof geminiResponseSchema>;
