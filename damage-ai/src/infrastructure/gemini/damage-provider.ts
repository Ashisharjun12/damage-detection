import { getGeminiClient, GEMINI_DAMAGE_RESPONSE_SCHEMA } from "@/infrastructure/gemini/client.js";
import {
  buildDamageUserPrompt,
  buildVerificationPrompt,
  buildDamageSystemPrompt,
  DAMAGE_DETECTION_PROMPT_VERSION,
} from "@/infrastructure/gemini/prompts/damage-detection.js";
import {
  geminiResponseSchema,
  type GeminiParsedResponse,
} from "@/infrastructure/gemini/schemas/damage-response.schema.js";
import {
  callWithGeminiRetry,
  withGeminiTimeout,
} from "@/infrastructure/gemini/retry-policy.js";
import { parseGeminiResponse } from "@/infrastructure/gemini/parse-response.js";
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

async function callGeminiDamageOnce(
  input: DamageDetectionInput,
  strictJson = false,
): Promise<GeminiCallResult<GeminiParsedResponse>> {
  const client = getGeminiClient();
  const userText = input.verificationSummary
    ? buildVerificationPrompt(input.verificationSummary)
    : buildDamageUserPrompt(input.declaredView, input.viewAwareParts);

  const response = await withGeminiTimeout(
    client.models.generateContent({
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
        systemInstruction: buildDamageSystemPrompt(strictJson),
        temperature: envConfig.GEMINI_TEMPERATURE,
        maxOutputTokens: envConfig.GEMINI_MAX_OUTPUT_TOKENS,
        responseMimeType: "application/json",
        responseSchema: GEMINI_DAMAGE_RESPONSE_SCHEMA,
      },
    }),
  );

  const parsed = parseGeminiResponse(response, geminiResponseSchema);
  return { data: parsed, usage: extractGeminiUsage(response) };
}

export class GeminiDamageProvider implements DamageDetectionProvider {
  async detect(
    input: DamageDetectionInput,
  ): Promise<GeminiCallResult<GeminiParsedResponse>> {
    return callWithGeminiRetry(async ({ strictJson }) =>
      callGeminiDamageOnce(input, strictJson),
    );
  }
}

export const geminiDamageProvider = new GeminiDamageProvider();

export { DAMAGE_DETECTION_PROMPT_VERSION };
