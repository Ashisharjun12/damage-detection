import type { GenerateContentResponse } from "@google/genai";

export type GeminiUsage = {
  inputTokens: number;
  outputTokens: number;
};

export function extractGeminiUsage(
  response: GenerateContentResponse,
): GeminiUsage {
  const meta = response.usageMetadata;
  return {
    inputTokens: meta?.promptTokenCount ?? 0,
    outputTokens: meta?.candidatesTokenCount ?? 0,
  };
}

export class GeminiUsageTracker {
  inputTokens = 0;
  outputTokens = 0;

  add(usage: GeminiUsage): void {
    this.inputTokens += usage.inputTokens;
    this.outputTokens += usage.outputTokens;
  }

  totals(): GeminiUsage {
    return { inputTokens: this.inputTokens, outputTokens: this.outputTokens };
  }
}

export type GeminiCallResult<T> = {
  data: T;
  usage: GeminiUsage;
};
