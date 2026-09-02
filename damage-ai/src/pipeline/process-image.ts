import { envConfig } from "@/config/env.js";
import {
  buildAnnotatedKey,
  uploadAnnotatedImage,
} from "@/infrastructure/storage/r2.client.js";
import { GeminiUsageTracker } from "@/infrastructure/gemini/usage.js";
import { downloadImage } from "@/modules/ingest/download-image.js";
import {
  computeQualityScore,
  findDuplicate,
  shouldSkipNearDuplicate,
  type DuplicateRecord,
} from "@/modules/duplicate/find-duplicate.js";
import { assessQuality } from "@/modules/quality/assess-quality.js";
import { detectDamage, verifyDamageFinding } from "@/modules/detection/detect-damage.js";
import {
  judgeRegion,
  type MaskAnnotatedDamage,
} from "@/modules/detection/judge-region.js";
import { detectView } from "@/modules/inspection/detect-view.js";
import { filterGroundReject } from "@/modules/spatial/bbox.js";
import { encodeImage } from "@/modules/spatial/mobile-sam/encode.js";
import { decodeMask } from "@/modules/spatial/mobile-sam/decode.js";
import {
  filterSegmentationMasks,
  proposeRegions,
} from "@/modules/spatial/region-proposals.js";
import type { SegmentationMask } from "@/modules/spatial/mobile-sam/types.js";
import {
  applyConfidenceGate,
  applySeveritySanity,
  dedupeInstances,
  filterBboxSanity,
} from "@/modules/validation/validate-bbox.js";
import {
  renderAnnotation,
  renderMaskAnnotation,
} from "@/modules/annotation/render-annotation.js";
import type {
  DamageAssessmentRequest,
  DamageInstance,
  ImageResult,
} from "@/types/m02.v1.js";
import { logger } from "@/shared/logger.js";

export type ProcessImageResult = {
  imageResult: ImageResult;
  instances: DamageInstance[];
  confidenceFlags: string[];
  verificationCalls: number;
  geminiRegionCalls: number;
  regionProposals: number;
  annotationStyle: "bbox_overlay" | "mask_overlay";
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
    geminiRegionCalls: 0,
    regionProposals: 0,
    annotationStyle: envConfig.SEG_ENABLED ? "mask_overlay" : "bbox_overlay",
    geminiInputTokens: 0,
    geminiOutputTokens: 0,
    ...overrides,
  };
}

async function processImageSegPath(
  processed: Awaited<ReturnType<typeof downloadImage>>,
  input: DamageAssessmentRequest["images"][0],
  surveyId: string,
  base: ImageResult,
): Promise<ProcessImageResult> {
  const confidenceFlags: string[] = [];
  const usageTracker = new GeminiUsageTracker();
  let geminiRegionCalls = 0;

  const viewResult = await detectView(
    processed.buffer,
    processed.mimeType,
    input.declared_view,
  );
  usageTracker.add(viewResult.usage);
  geminiRegionCalls += 1;

  if (viewResult.image_quality === "INVALID_IMAGE") {
    return emptyUsageResult(
      {
        ...base,
        processing_status: "INVALID_IMAGE",
        image_quality: { status: "INVALID_IMAGE" },
        view_angle: viewResult.view_angle,
        damages: [],
      },
      {
        confidenceFlags,
        geminiRegionCalls: 1,
        annotationStyle: "mask_overlay",
        geminiInputTokens: usageTracker.inputTokens,
        geminiOutputTokens: usageTracker.outputTokens,
      },
    );
  }

  const embedding = await encodeImage(processed.buffer);
  const proposals = await proposeRegions(
    processed.buffer,
    processed.width,
    processed.height,
  );

  const decoded: SegmentationMask[] = [];
  for (const proposal of proposals) {
    const decodedMask = await decodeMask(embedding, proposal);
    decoded.push({
      proposal,
      mask: decodedMask.mask,
      width: decodedMask.width,
      height: decodedMask.height,
      samIoU: decodedMask.samIoU,
      envelope: decodedMask.envelope,
    });
  }

  const filteredMasks = filterSegmentationMasks(decoded);

  const maskDamages: MaskAnnotatedDamage[] = [];
  let instanceIndex = 0;
  for (const segMask of filteredMasks) {
    geminiRegionCalls += 1;
    const judged = await judgeRegion(
      processed.buffer,
      processed.width,
      processed.height,
      segMask,
      input.image_id,
      ++instanceIndex,
      viewResult.view_angle,
      input.declared_view,
    );
    usageTracker.add(judged.usage);
    if (judged.damage) maskDamages.push(judged.damage);
  }

  let instances: DamageInstance[] = maskDamages;
  instances = filterGroundReject(instances);
  instances = filterBboxSanity(instances);
  const severityResult = applySeveritySanity(instances);
  instances = severityResult.instances;
  confidenceFlags.push(...severityResult.flags);
  instances = dedupeInstances(instances);

  confidenceFlags.push(...applyConfidenceGate(instances));

  const maskInstances = maskDamages.filter((m) =>
    instances.some((i) => i.instance_id === m.instance_id),
  );

  let annotatedUrl: string | null = null;
  try {
    if (maskInstances.length > 0) {
      const annotated = await renderMaskAnnotation(
        processed.buffer,
        maskInstances,
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
      "mask annotation failed",
    );
  }

  const processing_status =
    instances.length === 0
      ? "COMPLETED"
      : annotatedUrl
        ? "COMPLETED"
        : "PARTIAL";

  return {
    imageResult: {
      ...base,
      view_angle: viewResult.view_angle,
      view_confidence: viewResult.view_confidence,
      view_conflict: viewResult.view_conflict,
      processing_status,
      damages: instances,
      annotated_image_url: annotatedUrl,
    },
    instances,
    confidenceFlags,
    verificationCalls: 0,
    geminiRegionCalls,
    regionProposals: proposals.length,
    annotationStyle: "mask_overlay",
    geminiInputTokens: usageTracker.inputTokens,
    geminiOutputTokens: usageTracker.outputTokens,
  };
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
      return emptyUsageResult({
        ...base,
        processing_status: "REVIEW_REQUIRED",
        image_quality: { status: "LOW_QUALITY", reason: quality.reason },
        view_angle: "Unknown",
        damages: [],
      });
    }

    if (envConfig.SEG_ENABLED) {
      return processImageSegPath(processed, input, surveyId, base);
    }

    const mapped = await detectDamage(
      processed.buffer,
      processed.mimeType,
      input.image_id,
      input.declared_view,
    );
    usageTracker.add(mapped.usage);

    if (mapped.image_quality === "INVALID_IMAGE") {
      return emptyUsageResult({
        ...base,
        processing_status: "INVALID_IMAGE",
        image_quality: { status: "INVALID_IMAGE" },
        view_angle: mapped.view_angle,
        damages: [],
      }, {
        confidenceFlags,
        annotationStyle: "bbox_overlay",
        geminiInputTokens: usageTracker.inputTokens,
        geminiOutputTokens: usageTracker.outputTokens,
      });
    }

    let instances = mapped.instances;
    instances = filterGroundReject(instances);
    instances = filterBboxSanity(instances);
    const severityResult = applySeveritySanity(instances);
    instances = severityResult.instances;
    confidenceFlags.push(...severityResult.flags);
    instances = dedupeInstances(instances);

    const verified: DamageInstance[] = [];
    for (const inst of instances) {
      if (inst.confidence >= envConfig.CONFIDENCE_ACCEPT_MIN) {
        verified.push(inst);
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
          verified.push({
            ...inst,
            confidence: result.confidence,
            verification_status: "confirmed",
          });
        } else {
          confidenceFlags.push(`verification_failed:${inst.instance_id}`);
          verified.push({
            ...inst,
            verification_status: "pending_review",
          });
        }
        continue;
      }
      confidenceFlags.push(`low_confidence:${inst.instance_id}`);
      verified.push(inst);
    }
    instances = verified;

    confidenceFlags.push(...applyConfidenceGate(instances));

    let annotatedUrl: string | null = null;
    try {
      if (instances.length > 0) {
        const annotated = await renderAnnotation(
          processed.buffer,
          instances,
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

    const processing_status =
      instances.length === 0
        ? "COMPLETED"
        : annotatedUrl
          ? "COMPLETED"
          : "PARTIAL";

    return {
      imageResult: {
        ...base,
        view_angle: mapped.view_angle,
        view_confidence: mapped.view_confidence,
        view_conflict: mapped.view_conflict,
        processing_status,
        damages: instances,
        annotated_image_url: annotatedUrl,
      },
      instances,
      confidenceFlags,
      verificationCalls,
      geminiRegionCalls: 0,
      regionProposals: 0,
      annotationStyle: "bbox_overlay",
      geminiInputTokens: usageTracker.inputTokens,
      geminiOutputTokens: usageTracker.outputTokens,
    };
  } catch (err) {
    logger.error({ err, image_id: input.image_id }, "image processing failed");
    return emptyUsageResult({
      ...base,
      processing_status: "FAILED",
      error_code: err instanceof Error ? err.message : "ANALYSIS_FAILED",
      view_angle: "Unknown",
    }, { confidenceFlags });
  }
}
