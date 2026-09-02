import { envConfig } from "@/config/env.js";
import { sendWebhook } from "@/infrastructure/webhook/webhook.client.js";
import {
  getIdempotentResult,
  setIdempotentResult,
} from "@/infrastructure/queue/redis.js";
import { processImage } from "@/pipeline/process-image.js";
import { clusterDamages } from "@/modules/aggregation/cluster-damages.js";
import { enrichClusterEvidence } from "@/modules/aggregation/build-evidence.js";
import { computeCoverage } from "@/modules/inspection/coverage.js";
import {
  buildSummary,
  computeOverallScore,
} from "@/modules/scoring/damage-score.js";
import { computeGeminiCost } from "@/modules/scoring/gemini-cost.js";
import { buildReviewFlags } from "@/modules/review/review-flags.js";
import type { DuplicateRecord } from "@/modules/duplicate/find-duplicate.js";
import type { DamageAssessmentRequest, M02Report } from "@/types/m02.v1.js";
import { DAMAGE_DETECTION_PROMPT_VERSION } from "@/infrastructure/gemini/damage-provider.js";
import { GROUNDED_DAMAGE_PROMPT_VERSION } from "@/infrastructure/gemini/prompts/grounded-damage.js";
import { logger } from "@/shared/logger.js";

async function runPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const idx = next++;
      if (idx >= items.length) break;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

export async function runAssessment(
  request: DamageAssessmentRequest,
): Promise<M02Report> {
  const start = Date.now();
  const cached = await getIdempotentResult<M02Report>(request.idempotency_key);
  if (cached) return cached;

  const dupRegistry: DuplicateRecord[] = [];
  const imageResults = await runPool(
    request.images,
    envConfig.MAX_CONCURRENT_GEMINI,
    (img) => processImage(img, request.survey_id, dupRegistry),
  );

  const images = imageResults.map((r) => r.imageResult);
  const allInstances = imageResults.flatMap((r) => r.instances);
  const extraFlags = imageResults.flatMap((r) => r.confidenceFlags);
  const totalVerificationCalls = imageResults.reduce(
    (sum, r) => sum + r.verificationCalls,
    0,
  );
  const totalGeminiRegionCalls = imageResults.reduce(
    (sum, r) => sum + r.geminiRegionCalls,
    0,
  );
  const totalRegionProposals = imageResults.reduce(
    (sum, r) => sum + r.regionProposals,
    0,
  );
  const totalGeminiInputTokens = imageResults.reduce(
    (sum, r) => sum + r.geminiInputTokens,
    0,
  );
  const totalGeminiOutputTokens = imageResults.reduce(
    (sum, r) => sum + r.geminiOutputTokens,
    0,
  );
  const annotationStyle = envConfig.SEG_ENABLED
    ? "mask_overlay"
    : imageResults[0]?.annotationStyle ?? "bbox_overlay";

  const latencyMs = Date.now() - start;
  const latencySec = Math.round(latencyMs / 100) / 10;
  const tokenUsage = {
    inputTokens: totalGeminiInputTokens,
    outputTokens: totalGeminiOutputTokens,
  };
  const cost =
    tokenUsage.inputTokens > 0 || tokenUsage.outputTokens > 0
      ? computeGeminiCost(tokenUsage)
      : undefined;

  const clusters = enrichClusterEvidence(clusterDamages(allInstances));
  const coverage = computeCoverage(
    images.map((i) => i.view_angle).filter((v) => v !== "Unknown"),
  );
  const summary = buildSummary(clusters);
  const overall = computeOverallScore(clusters);
  const review = buildReviewFlags(images, allInstances, extraFlags);

  const failed_images = images
    .filter((i) => i.processing_status === "FAILED" || i.error_code)
    .map((i) => ({
      image_id: i.image_id,
      error_code: i.error_code ?? "FAILED",
    }));

  let status: M02Report["status"] = "COMPLETED";
  if (failed_images.length > 0 && failed_images.length < images.length) {
    status = "PARTIAL";
  } else if (failed_images.length === images.length) {
    status = "FAILED";
  } else if (review.requires_human_review || coverage.status === "INCOMPLETE") {
    status = "REVIEW_REQUIRED";
  }

  const report: M02Report = {
    schema_version: "m02.v1",
    request_id: request.request_id,
    survey_id: request.survey_id,
    status,
    images,
    damage_clusters: clusters,
    vehicle_damage_summary: summary,
    survey_coverage: coverage,
    overall_damage_score: overall,
    review,
    processing: {
      model: envConfig.AI_MODEL,
      prompt_version: envConfig.SEG_ENABLED
        ? GROUNDED_DAMAGE_PROMPT_VERSION
        : DAMAGE_DETECTION_PROMPT_VERSION,
      latency_ms: latencyMs,
      latency_sec: latencySec,
      images_processed: images.filter((i) => i.processing_status === "COMPLETED").length,
      images_skipped: images.filter((i) => i.processing_status === "SKIPPED_DUPLICATE").length,
      idempotency_key: request.idempotency_key,
      spatial_model: envConfig.SEG_ENABLED ? "mobile-sam-v1" : null,
      annotation_style: annotationStyle,
      gemini_image_max_edge: envConfig.GEMINI_IMAGE_MAX_EDGE,
      verification_calls: totalVerificationCalls,
      region_proposals: envConfig.SEG_ENABLED ? totalRegionProposals : undefined,
      gemini_region_calls: envConfig.SEG_ENABLED ? totalGeminiRegionCalls : undefined,
      gemini_input_tokens: totalGeminiInputTokens,
      gemini_output_tokens: totalGeminiOutputTokens,
      estimated_cost_usd: cost?.estimated_cost_usd,
      estimated_cost_inr: cost?.estimated_cost_inr,
    },
    failed_images: failed_images.length ? failed_images : undefined,
  };

  await setIdempotentResult(request.idempotency_key, report);

  try {
    await sendWebhook(report);
  } catch (webhookErr) {
    logger.error({ webhookErr }, "webhook delivery failed");
  }

  return report;
}
