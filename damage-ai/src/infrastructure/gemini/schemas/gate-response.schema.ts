import { z } from "zod";
import { VIEW_ANGLES } from "@/types/m02.v1.js";

function normalizeUnitInterval(n: number): number {
  const scaled = n > 1 && n <= 100 ? n / 100 : n;
  return Math.min(1, Math.max(0, scaled));
}

const unitInterval = z.preprocess(
  (v) => (typeof v === "number" ? normalizeUnitInterval(v) : v),
  z.number().min(0).max(1).optional(),
);

export const gateResponseSchema = z.object({
  is_vehicle: z.boolean(),
  view_angle: z.enum(VIEW_ANGLES),
  view_confidence: unitInterval,
  image_quality: z.enum(["OK", "LOW_QUALITY", "LOW_RESOLUTION", "INVALID_IMAGE"]),
  vehicle_visible_pct: unitInterval,
  vehicle_bbox: z.array(z.number()).length(4).optional(),
});

export type GateParsedResponse = z.infer<typeof gateResponseSchema>;
