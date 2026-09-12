import { envConfig } from "@/config/env.js";
import { logger } from "@/shared/logger.js";

export type GeminiConfigSummary = {
  configured: boolean;
  keyPrefix: string | null;
  keyLength: number;
  model: string;
  fallbackModel: string;
  gateEnabled: boolean;
  timeoutMs: number;
  maxRetries: number;
  imageMaxEdge: number;
};

export function getGeminiConfigSummary(): GeminiConfigSummary {
  const key = envConfig.AI_API_KEY;
  return {
    configured: Boolean(key),
    keyPrefix: key ? `${key.slice(0, 4)}…` : null,
    keyLength: key.length,
    model: envConfig.AI_MODEL,
    fallbackModel: envConfig.AI_FALLBACK_MODEL,
    gateEnabled: envConfig.IMAGE_GATE_ENABLED,
    timeoutMs: envConfig.GEMINI_TIMEOUT_MS,
    maxRetries: envConfig.GEMINI_MAX_RETRIES,
    imageMaxEdge: envConfig.GEMINI_IMAGE_MAX_EDGE,
  };
}

export function logGeminiConfigOnStartup(context: string): void {
  const gemini = getGeminiConfigSummary();
  if (!gemini.configured) {
    logger.warn(
      { gemini, context },
      "AI_API_KEY not set — Gemini calls will fail",
    );
    return;
  }
  logger.info({ gemini, context }, "gemini config");
}
