import CircuitBreaker from "opossum";
import { Type } from "@google/genai";
import {
  getGeminiClient,
  withRetry,
} from "@/infrastructure/gemini/client.js";
import {
  buildGroundedUserPrompt,
  GROUNDED_DAMAGE_SYSTEM,
} from "@/infrastructure/gemini/prompts/grounded-damage.js";
import {
  groundedResponseSchema,
  type GroundedParsedResponse,
} from "@/infrastructure/gemini/schemas/grounded-response.schema.js";
import {
  extractGeminiUsage,
  type GeminiCallResult,
} from "@/infrastructure/gemini/usage.js";
import { envConfig } from "@/config/env.js";

export const GEMINI_GROUNDED_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    is_damage: { type: Type.BOOLEAN },
    false_positive_reason: { type: Type.STRING },
    part_name: { type: Type.STRING },
    damage_type: {
      type: Type.STRING,
      enum: [
        "Dent",
        "Scratch",
        "Crack",
        "Shatter",
        "Deformation",
        "Paint Damage",
        "Missing Part",
      ],
    },
    severity: {
      type: Type.STRING,
      enum: ["Minor", "Moderate", "Severe"],
    },
    confidence: { type: Type.NUMBER },
    visibility: {
      type: Type.STRING,
      enum: ["FULL", "PARTIAL", "OCCLUDED"],
    },
    location_on_part: { type: Type.STRING },
    side: { type: Type.STRING },
  },
  required: ["is_damage"],
};

const BREAKER_OPTIONS = {
  timeout: 60000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
};

export type GroundedJudgeInput = {
  imageBytes: Buffer;
  mimeType: string;
  declaredView?: string;
};

async function callGroundedGemini(
  input: GroundedJudgeInput,
): Promise<GeminiCallResult<GroundedParsedResponse>> {
  const client = getGeminiClient();
  const response = await client.models.generateContent({
    model: envConfig.AI_MODEL,
    contents: [
      {
        inlineData: {
          mimeType: input.mimeType,
          data: input.imageBytes.toString("base64"),
        },
      },
      { text: buildGroundedUserPrompt(input.declaredView) },
    ],
    config: {
      systemInstruction: GROUNDED_DAMAGE_SYSTEM,
      temperature: envConfig.GEMINI_TEMPERATURE,
      maxOutputTokens: 512,
      responseMimeType: "application/json",
      responseSchema: GEMINI_GROUNDED_RESPONSE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Empty Gemini grounded response");
  return {
    data: groundedResponseSchema.parse(JSON.parse(text)),
    usage: extractGeminiUsage(response),
  };
}

export async function judgeRegionWithGemini(
  input: GroundedJudgeInput,
): Promise<GeminiCallResult<GroundedParsedResponse>> {
  return withRetry(async () => {
    const breaker = new CircuitBreaker(callGroundedGemini, BREAKER_OPTIONS);
    return breaker.fire(input);
  });
}
