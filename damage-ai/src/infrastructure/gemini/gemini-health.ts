import { getGeminiClient } from "@/infrastructure/gemini/client.js";
import { getGeminiConfigSummary } from "@/infrastructure/gemini/gemini-config.js";
import {
  classifyGeminiError,
  withGeminiTimeout,
} from "@/infrastructure/gemini/retry-policy.js";
import { envConfig } from "@/config/env.js";

export type GeminiPingResult = {
  ok: boolean;
  latencyMs: number;
  model: string;
  error?: string;
  errorType?: string;
};

export async function pingGemini(): Promise<GeminiPingResult> {
  const model = envConfig.AI_MODEL;
  const config = getGeminiConfigSummary();

  if (!config.configured) {
    return {
      ok: false,
      latencyMs: 0,
      model,
      error: "AI_API_KEY not set",
      errorType: "missing_key",
    };
  }

  const start = Date.now();
  try {
    const client = getGeminiClient();
    await withGeminiTimeout(
      client.models.generateContent({
        model,
        contents: "Reply with exactly: ok",
        config: { maxOutputTokens: 8, temperature: 0 },
      }),
      10_000,
    );
    return { ok: true, latencyMs: Date.now() - start, model };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      model,
      error: err instanceof Error ? err.message : String(err),
      errorType: classifyGeminiError(err),
    };
  }
}
