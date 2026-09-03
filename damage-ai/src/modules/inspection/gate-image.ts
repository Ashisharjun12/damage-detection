import { envConfig } from "@/config/env.js";
import { prepareVisionImage } from "@/modules/ingest/resize-image.js";
import { gateImageWithGemini } from "@/infrastructure/gemini/gate-provider.js";
import type { GateParsedResponse } from "@/infrastructure/gemini/schemas/gate-response.schema.js";
import type { GeminiUsage } from "@/infrastructure/gemini/usage.js";
import type { ViewAngle } from "@/types/m02.v1.js";

export type ImageGateResult = {
  passed: boolean;
  is_vehicle: boolean;
  view_angle: ViewAngle;
  view_confidence?: number;
  image_quality: GateParsedResponse["image_quality"];
  vehicle_visible_pct?: number;
  vehicle_bbox?: number[];
  usage: GeminiUsage;
};

export async function runImageGate(
  imageBytes: Buffer,
  mimeType: string,
  declaredView?: string,
): Promise<ImageGateResult> {
  const vision = await prepareVisionImage(
    imageBytes,
    envConfig.GEMINI_GATE_MAX_EDGE,
  );

  const { data, usage } = await gateImageWithGemini({
    imageBytes: vision.buffer,
    mimeType,
    declaredView,
  });

  const passed =
    data.is_vehicle &&
    data.image_quality === "OK" &&
    (data.vehicle_visible_pct ?? 1) >= 0.25;

  return {
    passed,
    is_vehicle: data.is_vehicle,
    view_angle: data.view_angle,
    view_confidence: data.view_confidence,
    image_quality: data.image_quality,
    vehicle_visible_pct: data.vehicle_visible_pct,
    vehicle_bbox: data.vehicle_bbox,
    usage,
  };
}
