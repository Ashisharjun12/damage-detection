import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { envConfig } from "@/config/env.js";

let assessmentQueue: Queue | null = null;

export function getAssessmentQueue(): Queue | null {
  if (!envConfig.REDIS_URL) return null;
  if (!assessmentQueue) {
    const connection = new Redis(envConfig.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
    assessmentQueue = new Queue("m02-analysis", { connection });
  }
  return assessmentQueue;
}
