import { z } from "zod";
import { VIEW_ANGLES } from "@/types/m02.v1.js";

export const gateResponseSchema = z.object({
  is_vehicle: z.boolean(),
  view_angle: z.enum(VIEW_ANGLES),
  view_confidence: z.number().min(0).max(1).optional(),
  image_quality: z.enum(["OK", "LOW_QUALITY", "LOW_RESOLUTION", "INVALID_IMAGE"]),
  vehicle_visible_pct: z.number().min(0).max(1).optional(),
  vehicle_bbox: z.array(z.number()).length(4).optional(),
});

export type GateParsedResponse = z.infer<typeof gateResponseSchema>;
