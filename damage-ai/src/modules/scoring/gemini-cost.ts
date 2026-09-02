import { envConfig } from "@/config/env.js";
import type { GeminiUsage } from "@/infrastructure/gemini/usage.js";

export function computeGeminiCost(usage: GeminiUsage): {
  estimated_cost_usd: number;
  estimated_cost_inr: number;
} {
  const inputUsd =
    (usage.inputTokens / 1_000_000) * envConfig.GEMINI_USD_PER_M_INPUT;
  const outputUsd =
    (usage.outputTokens / 1_000_000) * envConfig.GEMINI_USD_PER_M_OUTPUT;
  const estimated_cost_usd =
    Math.round((inputUsd + outputUsd) * 1_000_000) / 1_000_000;
  const estimated_cost_inr =
    Math.round(estimated_cost_usd * envConfig.GEMINI_INR_PER_USD * 100) / 100;
  return { estimated_cost_usd, estimated_cost_inr };
}
