import CircuitBreaker from "opossum";
import { Type } from "@google/genai";
import {
  getGeminiClient,
  withRetry,
} from "@/infrastructure/gemini/client.js";
import {
  buildViewUserPrompt,
  VIEW_DETECTION_SYSTEM,
} from "@/infrastructure/gemini/prompts/view-detection.js";
import {
  viewDetectionSchema,
  type ViewDetectionResponse,
} from "@/infrastructure/gemini/schemas/grounded-response.schema.js";
import {
  extractGeminiUsage,
  type GeminiCallResult,
} from "@/infrastructure/gemini/usage.js";
import { envConfig } from "@/config/env.js";

export const GEMINI_VIEW_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    view_angle: {
      type: Type.STRING,
      enum: ["Front", "Rear", "Left", "Right", "Roof", "Interior", "Unknown"],
    },
    view_confidence: { type: Type.NUMBER },
    image_quality: {
      type: Type.STRING,
      enum: ["OK", "LOW_QUALITY", "LOW_RESOLUTION", "INVALID_IMAGE"],
    },
  },
  required: ["view_angle"],
};

const BREAKER_OPTIONS = {
  timeout: 45000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
};

export type ViewDetectionInput = {
  imageBytes: Buffer;
  mimeType: string;
  declaredView?: string;
};

async function callViewGemini(
  input: ViewDetectionInput,
): Promise<GeminiCallResult<ViewDetectionResponse>> {
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
      { text: buildViewUserPrompt(input.declaredView) },
    ],
    config: {
      systemInstruction: VIEW_DETECTION_SYSTEM,
      temperature: envConfig.GEMINI_TEMPERATURE,
      maxOutputTokens: 256,
      responseMimeType: "application/json",
      responseSchema: GEMINI_VIEW_RESPONSE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Empty Gemini view response");
  return {
    data: viewDetectionSchema.parse(JSON.parse(text)),
    usage: extractGeminiUsage(response),
  };
}

export async function detectViewWithGemini(
  input: ViewDetectionInput,
): Promise<GeminiCallResult<ViewDetectionResponse>> {
  return withRetry(async () => {
    const breaker = new CircuitBreaker(callViewGemini, BREAKER_OPTIONS);
    return breaker.fire(input);
  });
}
