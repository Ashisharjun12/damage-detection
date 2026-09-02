import CircuitBreaker from "opossum";
import {
  getGeminiClient,
  GEMINI_DAMAGE_RESPONSE_SCHEMA,
  withRetry,
} from "@/infrastructure/gemini/client.js";
import {
  buildDamageUserPrompt,
  buildVerificationPrompt,
  DAMAGE_DETECTION_PROMPT_VERSION,
  DAMAGE_DETECTION_SYSTEM,
} from "@/infrastructure/gemini/prompts/damage-detection.js";
import {
  geminiResponseSchema,
  type GeminiParsedResponse,
} from "@/infrastructure/gemini/schemas/damage-response.schema.js";
import {
  extractGeminiUsage,
  type GeminiCallResult,
} from "@/infrastructure/gemini/usage.js";
import { envConfig } from "@/config/env.js";
import type { ViewAngle } from "@/types/m02.v1.js";

export type DamageDetectionInput = {
  imageBytes: Buffer;
  mimeType: string;
  declaredView?: string;
  viewHint?: ViewAngle;
  viewAwareParts?: string;
  verificationSummary?: string;
};

export interface DamageDetectionProvider {
  detect(input: DamageDetectionInput): Promise<GeminiCallResult<GeminiParsedResponse>>;
}

const BREAKER_OPTIONS = {
  timeout: 90000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
};

async function callGemini(
  input: DamageDetectionInput,
): Promise<GeminiCallResult<GeminiParsedResponse>> {
  const client = getGeminiClient();
  const userText = input.verificationSummary
    ? buildVerificationPrompt(input.verificationSummary)
    : buildDamageUserPrompt(input.declaredView, input.viewAwareParts);

  const response = await client.models.generateContent({
    model: envConfig.AI_MODEL,
    contents: [
      {
        inlineData: {
          mimeType: input.mimeType,
          data: input.imageBytes.toString("base64"),
        },
      },
      { text: userText },
    ],
    config: {
      systemInstruction: DAMAGE_DETECTION_SYSTEM,
      temperature: envConfig.GEMINI_TEMPERATURE,
      maxOutputTokens: envConfig.GEMINI_MAX_OUTPUT_TOKENS,
      responseMimeType: "application/json",
      responseSchema: GEMINI_DAMAGE_RESPONSE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Empty Gemini response");
  const parsed = geminiResponseSchema.parse(JSON.parse(text));
  return { data: parsed, usage: extractGeminiUsage(response) };
}

function createBreaker(fn: typeof callGemini) {
  return new CircuitBreaker(fn, BREAKER_OPTIONS);
}

export class GeminiDamageProvider implements DamageDetectionProvider {
  async detect(
    input: DamageDetectionInput,
  ): Promise<GeminiCallResult<GeminiParsedResponse>> {
    return withRetry(async () => {
      const breaker = createBreaker(callGemini);
      return breaker.fire(input);
    });
  }
}

export const geminiDamageProvider = new GeminiDamageProvider();

export { DAMAGE_DETECTION_PROMPT_VERSION };
