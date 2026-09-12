import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { envConfig } from "@/config/env.js";
import { logGeminiConfigOnStartup } from "@/infrastructure/gemini/gemini-config.js";
import { assertR2Configured } from "@/infrastructure/storage/r2.client.js";
import { runAssessment } from "@/pipeline/run-assessment.js";
import { logger } from "@/shared/logger.js";
import type { DamageAssessmentRequest } from "@/types/m02.v1.js";

if (!envConfig.REDIS_URL) {
  logger.warn("REDIS_URL not set — worker not started");
} else {
  logGeminiConfigOnStartup("damage-ai-worker");

  try {
    assertR2Configured();
    logger.info("R2 configured for annotated image uploads");
  } catch (r2Err) {
    logger.warn(
      { message: r2Err instanceof Error ? r2Err.message : r2Err },
      "R2 not configured — annotated uploads will fail",
    );
  }

  const connection = new Redis(envConfig.REDIS_URL, {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker(
    "m02-analysis",
    async (job) => {
      const data = job.data as DamageAssessmentRequest;
      await runAssessment(data);
    },
    { connection, concurrency: envConfig.MAX_CONCURRENT_GEMINI },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "assessment job failed");
  });

  logger.info("m02-analysis worker started");
}
