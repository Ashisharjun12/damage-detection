import {
  box2dToNormalized,
  clampBBox,
} from "@/infrastructure/gemini/bbox.adapter.js";
import type { GeminiParsedResponse } from "@/infrastructure/gemini/schemas/damage-response.schema.js";
import type { GeminiUsage } from "@/infrastructure/gemini/usage.js";
import { normalizePartName } from "@/modules/normalization/normalize-damage.js";
import { normalizeLocationOnPart } from "@/modules/spatial/location.js";
import { isValidBboxArea } from "@/modules/spatial/iou.js";
import { recommendForSeverity } from "@/modules/scoring/repair-replace-rules.js";
import type { DamageInstance, ViewAngle } from "@/types/m02.v1.js";
import { classifyViewFromDetection } from "@/modules/inspection/classify-view.js";
import { buildViewAwarePartHint } from "@/modules/detection/view-aware-parts.js";
import { resizeForGemini } from "@/modules/ingest/resize-image.js";
import {
  geminiDamageProvider,
  type DamageDetectionInput,
} from "@/infrastructure/gemini/damage-provider.js";

export type DetectionResult = {
  instances: DamageInstance[];
  view_angle: ViewAngle;
  view_confidence?: number;
  view_conflict?: boolean;
  image_quality?: string;
  usage: GeminiUsage;
};

function mapGeminiToInstances(
  gemini: GeminiParsedResponse,
  imageId: string,
  declaredView?: string,
): Omit<DetectionResult, "usage"> {
  const viewInfo = classifyViewFromDetection(
    gemini.view_angle,
    gemini.view_confidence,
    declaredView,
  );

  const instances: DamageInstance[] = [];
  let idx = 0;

  for (const d of gemini.damages) {
    const partName = normalizePartName(d.part_name);
    if (!partName) continue;

    const bbox = clampBBox(box2dToNormalized(d.box_2d));
    if (!isValidBboxArea(bbox)) continue;

    instances.push({
      instance_id: `${imageId}_D${String(++idx).padStart(3, "0")}`,
      image_id: imageId,
      part_name: partName,
      damage_type: d.damage_type,
      severity: d.severity,
      recommendation: recommendForSeverity(d.severity, partName),
      bounding_box: bbox,
      location_on_part: d.location_on_part
        ? normalizeLocationOnPart(d.location_on_part)
        : undefined,
      side: d.side,
      confidence: d.confidence,
      visibility: d.visibility ?? "FULL",
      view_angle: viewInfo.view_angle,
    });
  }

  return {
    instances,
    view_angle: viewInfo.view_angle,
    view_confidence: viewInfo.view_confidence,
    view_conflict: viewInfo.view_conflict,
    image_quality: gemini.image_quality,
  };
}

export async function detectDamage(
  imageBytes: Buffer,
  mimeType: string,
  imageId: string,
  declaredView?: string,
): Promise<DetectionResult> {
  const geminiBytes = await resizeForGemini(imageBytes);
  const viewHint = declaredView ? declaredView : "Unknown";
  const viewAwareParts = buildViewAwarePartHint(viewHint as ViewAngle);

  const input: DamageDetectionInput = {
    imageBytes: geminiBytes,
    mimeType: "image/jpeg",
    declaredView,
    viewAwareParts,
  };

  const { data: gemini, usage } = await geminiDamageProvider.detect(input);
  return { ...mapGeminiToInstances(gemini, imageId, declaredView), usage };
}

export async function verifyDamageFinding(
  imageBytes: Buffer,
  instance: DamageInstance,
): Promise<{ confirmed: boolean; confidence: number; usage: GeminiUsage }> {
  const geminiBytes = await resizeForGemini(imageBytes);
  const summary = `${instance.part_name} ${instance.damage_type} ${instance.severity} at ${instance.location_on_part ?? "unknown location"}`;

  const { data: gemini, usage } = await geminiDamageProvider.detect({
    imageBytes: geminiBytes,
    mimeType: "image/jpeg",
    verificationSummary: summary,
  });

  const confirmed = gemini.damages.some(
    (d) =>
      normalizePartName(d.part_name) === instance.part_name &&
      d.damage_type === instance.damage_type,
  );

  return {
    confirmed,
    confidence: confirmed
      ? Math.max(instance.confidence, gemini.damages[0]?.confidence ?? 0)
      : instance.confidence,
    usage,
  };
}
