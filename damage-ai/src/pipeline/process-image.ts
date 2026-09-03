import { envConfig } from "@/config/env.js";
import {
  buildAnnotatedKey,
  uploadAnnotatedImage,
} from "@/infrastructure/storage/r2.client.js";
import { GeminiUsageTracker } from "@/infrastructure/gemini/usage.js";
import { GeminiCallError } from "@/infrastructure/gemini/retry-policy.js";
import { downloadImage } from "@/modules/ingest/download-image.js";
import { upscaleImage } from "@/modules/ingest/resize-image.js";
import {
  computeQualityScore,
  findDuplicate,
  shouldSkipNearDuplicate,
  type DuplicateRecord,
} from "@/modules/duplicate/find-duplicate.js";
import { assessQuality } from "@/modules/quality/assess-quality.js";
import {
  detectDamage,
  isClusterEligible,
  verifyDamageFinding,
} from "@/modules/detection/detect-damage.js";
import { runImageGate } from "@/modules/inspection/gate-image.js";
import { outcomeMessage } from "@/modules/inspection/image-outcomes.js";
import {
  filterGroundReject,
  filterOutsideVehicleBBox,
  filterPartSpatialSanity,
  isBorderlineGroundAdjacentBox,
} from "@/modules/spatial/bbox.js";
import {
  applyConfidenceGate,
  applySeveritySanity,
  dedupeInstances,
  filterBboxSanity,
} from "@/modules/validation/validate-bbox.js";
import { renderAnnotation } from "@/modules/annotation/render-annotation.js";
import type {
  DamageAssessmentRequest,
  DamageInstance,
  ImageErrorCode,
  ImageResult,
} from "@/types/m02.v1.js";
import { logger } from "@/shared/logger.js";

export type ProcessImageResult = {
  imageResult: ImageResult;
  instances: DamageInstance[];
  confidenceFlags: string[];
  verificationCalls: number;
  annotationStyle: "bbox_overlay";
  geminiInputTokens: number;
  geminiOutputTokens: number;
};

function emptyUsageResult(
  base: ImageResult,
  overrides: Partial<ProcessImageResult> = {},
): ProcessImageResult {
  return {
    imageResult: base,
    instances: [],
    confidenceFlags: [],
    verificationCalls: 0,
    annotationStyle: "bbox_overlay",
    geminiInputTokens: 0,
    geminiOutputTokens: 0,
    ...overrides,
  };
}

function withOutcome(
  base: ImageResult,
  code: ImageErrorCode,
  status: string,
  overrides: Partial<ProcessImageResult> = {},
): ProcessImageResult {
  return emptyUsageResult(
    {
      ...base,
      processing_status: status,
      error_code: code,
      user_message: outcomeMessage(code),
    },
    overrides,
  );
}

export async function processImage(
  input: DamageAssessmentRequest["images"][0],
  surveyId: string,
  dupRegistry: DuplicateRecord[],
): Promise<ProcessImageResult> {
  const base: ImageResult = {
    image_id: input.image_id,
    url: input.url,
    declared_view: input.declared_view,
    view_angle: "Unknown",
    processing_status: "PENDING",
    damages: [],
  };

  let verificationCalls = 0;
  const confidenceFlags: string[] = [];
  const usageTracker = new GeminiUsageTracker();

  try {
    const processed = await downloadImage(input.url);
    const qualityScore = computeQualityScore(
      processed.width,
      processed.height,
      processed.sharpness,
    );

    const dup = findDuplicate(
      processed.sha256,
      processed.phash,
      qualityScore,
      dupRegistry,
    );

    if (shouldSkipNearDuplicate(dup.kind, dup.canonical)) {
      dupRegistry.push({
        sha256: processed.sha256,
        phash: processed.phash,
        image_id: input.image_id,
        qualityScore,
      });
      return emptyUsageResult({
        ...base,
        processing_status: "SKIPPED_DUPLICATE",
        duplicate_kind: dup.kind,
        canonical_image_id: dup.canonical?.image_id,
        view_angle: "Unknown",
      });
    }

    dupRegistry.push({
      sha256: processed.sha256,
      phash: processed.phash,
      image_id: input.image_id,
      qualityScore,
    });

    const quality = await assessQuality(processed.buffer);
    if (quality.status === "LOW_QUALITY") {
      return withOutcome(
        {
          ...base,
          image_quality: { status: "LOW_QUALITY", reason: quality.reason },
          view_angle: "Unknown",
        },
        "LOW_QUALITY",
        "REVIEW_REQUIRED",
      );
    }

    let gateViewAngle = input.declared_view as ImageResult["view_angle"] | undefined;
    let vehicleBbox: number[] | undefined;

    if (envConfig.IMAGE_GATE_ENABLED) {
      try {
        const gate = await runImageGate(
          processed.buffer,
          processed.mimeType,
          input.declared_view,
        );
        usageTracker.add(gate.usage);
        gateViewAngle = gate.view_angle;
        vehicleBbox = gate.vehicle_bbox;

        if (!gate.is_vehicle || gate.image_quality === "INVALID_IMAGE") {
          confidenceFlags.push(`image:${input.image_id}:NOT_VEHICLE`);
          return withOutcome(
            {
              ...base,
              view_angle: gate.view_angle,
              view_confidence: gate.view_confidence,
              image_quality: { status: "INVALID_IMAGE" },
            },
            gate.is_vehicle ? "UNREADABLE_DOCUMENT" : "NOT_VEHICLE",
            "INVALID_IMAGE",
            {
              confidenceFlags,
              geminiInputTokens: usageTracker.inputTokens,
              geminiOutputTokens: usageTracker.outputTokens,
            },
          );
        }

        if (gate.image_quality === "LOW_QUALITY" || gate.image_quality === "LOW_RESOLUTION") {
          return withOutcome(
            {
              ...base,
              view_angle: gate.view_angle,
              view_confidence: gate.view_confidence,
              image_quality: { status: gate.image_quality },
            },
            "LOW_QUALITY",
            "REVIEW_REQUIRED",
            {
              confidenceFlags,
              geminiInputTokens: usageTracker.inputTokens,
              geminiOutputTokens: usageTracker.outputTokens,
            },
          );
        }
      } catch (err) {
        if (err instanceof GeminiCallError) {
          logger.warn(
            { image_id: input.image_id, err },
            "image gate failed; continuing without gate",
          );
          confidenceFlags.push(`image:${input.image_id}:GATE_SKIPPED`);
          gateViewAngle = (input.declared_view as ImageResult["view_angle"]) ?? "Unknown";
          vehicleBbox = undefined;
        } else {
          throw err;
        }
      }
    }

    const mapped = await detectDamage(processed.buffer, processed.mimeType, input.image_id, {
      declaredView: input.declared_view,
      gateViewAngle: gateViewAngle,
    });
    usageTracker.add(mapped.usage);

    if (mapped.image_quality === "INVALID_IMAGE") {
      confidenceFlags.push(`image:${input.image_id}:UNREADABLE_DOCUMENT`);
      return withOutcome(
        {
          ...base,
          view_angle: mapped.view_angle,
          view_confidence: mapped.view_confidence,
          image_quality: { status: "INVALID_IMAGE" },
        },
        "UNREADABLE_DOCUMENT",
        "INVALID_IMAGE",
        {
          confidenceFlags,
          geminiInputTokens: usageTracker.inputTokens,
          geminiOutputTokens: usageTracker.outputTokens,
        },
      );
    }

    let instances = mapped.instances;
    instances = filterOutsideVehicleBBox(
      instances,
      vehicleBbox,
      envConfig.BBOX_MIN_VEHICLE_INSIDE_RATIO,
      envConfig.BBOX_VEHICLE_TRIM_BOTTOM,
    );
    instances = filterGroundReject(instances);
    instances = filterPartSpatialSanity(instances, mapped.view_angle);
    instances = filterBboxSanity(instances);
    const severityResult = applySeveritySanity(instances);
    instances = severityResult.instances;
    confidenceFlags.push(...severityResult.flags);
    instances = dedupeInstances(instances);

    if (instances.length === 0) {
      confidenceFlags.push(`image:${input.image_id}:NO_DAMAGE_FOUND`);
      return {
        imageResult: {
          ...base,
          view_angle: mapped.view_angle,
          view_confidence: mapped.view_confidence,
          view_conflict: mapped.view_conflict,
          processing_status: "REVIEW_REQUIRED",
          error_code: "NO_DAMAGE_FOUND",
          user_message: outcomeMessage("NO_DAMAGE_FOUND"),
          damages: [],
          annotated_image_url: null,
        },
        instances: [],
        confidenceFlags,
        verificationCalls,
        annotationStyle: "bbox_overlay",
        geminiInputTokens: usageTracker.inputTokens,
        geminiOutputTokens: usageTracker.outputTokens,
      };
    }

    const displayDamages: DamageInstance[] = [];
    const clusterInstances: DamageInstance[] = [];

    for (const inst of instances) {
      if (inst.confidence >= envConfig.CONFIDENCE_ACCEPT_MIN) {
        if (isBorderlineGroundAdjacentBox(inst.bounding_box)) {
          verificationCalls += 1;
          const result = await verifyDamageFinding(processed.buffer, inst);
          usageTracker.add(result.usage);
          if (result.confirmed) {
            const confirmed = {
              ...inst,
              confidence: result.confidence,
              verification_status: "confirmed" as const,
            };
            displayDamages.push(confirmed);
            clusterInstances.push(confirmed);
          } else {
            confidenceFlags.push(`verification_failed:${inst.instance_id}`);
            displayDamages.push({
              ...inst,
              verification_status: "pending_review" as const,
            });
          }
          continue;
        }
        displayDamages.push(inst);
        clusterInstances.push(inst);
        continue;
      }
      if (
        inst.confidence >= envConfig.CONFIDENCE_VERIFY_MIN &&
        inst.confidence < envConfig.CONFIDENCE_ACCEPT_MIN
      ) {
        verificationCalls += 1;
        const result = await verifyDamageFinding(processed.buffer, inst);
        usageTracker.add(result.usage);
        if (result.confirmed) {
          const confirmed = {
            ...inst,
            confidence: result.confidence,
            verification_status: "confirmed" as const,
          };
          displayDamages.push(confirmed);
          clusterInstances.push(confirmed);
        } else {
          confidenceFlags.push(`verification_failed:${inst.instance_id}`);
          const pending = {
            ...inst,
            verification_status: "pending_review" as const,
          };
          displayDamages.push(pending);
        }
        continue;
      }
      confidenceFlags.push(`low_confidence:${inst.instance_id}`);
      displayDamages.push({
        ...inst,
        verification_status: "pending_review",
      });
    }

    confidenceFlags.push(...applyConfidenceGate(displayDamages));

    let annotatedUrl: string | null = null;
    const annotatable = clusterInstances.filter(isClusterEligible);
    try {
      if (annotatable.length > 0) {
        const annotatedVision = await renderAnnotation(
          mapped.vision.buffer,
          annotatable,
          mapped.vision.width,
          mapped.vision.height,
        );
        const annotated =
          mapped.vision.width === processed.width &&
          mapped.vision.height === processed.height
            ? annotatedVision
            : await upscaleImage(
                annotatedVision,
                processed.width,
                processed.height,
              );
        const key = buildAnnotatedKey(surveyId, input.image_id);
        annotatedUrl = await uploadAnnotatedImage(key, annotated);
      }
    } catch (annErr) {
      logger.warn(
        {
          image_id: input.image_id,
          message: annErr instanceof Error ? annErr.message : annErr,
        },
        "annotation failed",
      );
    }

    if (clusterInstances.length === 0) {
      const processing_status = "REVIEW_REQUIRED";
      return {
        imageResult: {
          ...base,
          view_angle: mapped.view_angle,
          view_confidence: mapped.view_confidence,
          view_conflict: mapped.view_conflict,
          processing_status,
          damages: displayDamages,
          annotated_image_url: annotatedUrl,
        },
        instances: [],
        confidenceFlags,
        verificationCalls,
        annotationStyle: "bbox_overlay",
        geminiInputTokens: usageTracker.inputTokens,
        geminiOutputTokens: usageTracker.outputTokens,
      };
    }

    const processing_status = annotatedUrl ? "COMPLETED" : "PARTIAL";

    return {
      imageResult: {
        ...base,
        view_angle: mapped.view_angle,
        view_confidence: mapped.view_confidence,
        view_conflict: mapped.view_conflict,
        processing_status,
        damages: displayDamages,
        annotated_image_url: annotatedUrl,
      },
      instances: clusterInstances.filter(isClusterEligible),
      confidenceFlags,
      verificationCalls,
      annotationStyle: "bbox_overlay",
      geminiInputTokens: usageTracker.inputTokens,
      geminiOutputTokens: usageTracker.outputTokens,
    };
  } catch (err) {
    logger.error({ err, image_id: input.image_id }, "image processing failed");
    if (err instanceof GeminiCallError) {
      return withOutcome(
        { ...base, view_angle: "Unknown" },
        "GEMINI_CALL_FAILED",
        "FAILED",
        { confidenceFlags },
      );
    }
    return emptyUsageResult({
      ...base,
      processing_status: "FAILED",
      error_code: "GEMINI_CALL_FAILED",
      user_message: outcomeMessage("GEMINI_CALL_FAILED"),
      view_angle: "Unknown",
    }, { confidenceFlags });
  }
}
