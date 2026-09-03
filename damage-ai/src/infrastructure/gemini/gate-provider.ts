import { Type } from "@google/genai";
import { getGeminiClient } from "@/infrastructure/gemini/client.js";
import {
  buildImageGateUserPrompt,
  IMAGE_GATE_PROMPT_VERSION,
  IMAGE_GATE_SYSTEM,
} from "@/infrastructure/gemini/prompts/image-gate.js";
import {
  gateResponseSchema,
  type GateParsedResponse,
} from "@/infrastructure/gemini/schemas/gate-response.schema.js";
import { parseGeminiResponse } from "@/infrastructure/gemini/parse-response.js";
import {
  callWithGeminiRetry,
  STRICT_JSON_SUFFIX,
  withGeminiTimeout,
} from "@/infrastructure/gemini/retry-policy.js";
import {
  extractGeminiUsage,
  type GeminiCallResult,
} from "@/infrastructure/gemini/usage.js";
import { envConfig } from "@/config/env.js";

export const GEMINI_GATE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    is_vehicle: { type: Type.BOOLEAN },
    view_angle: {
      type: Type.STRING,
      enum: ["Front", "Rear", "Left", "Right", "Roof", "Interior", "Unknown"],
    },
    view_confidence: { type: Type.NUMBER },
    image_quality: {
      type: Type.STRING,
      enum: ["OK", "LOW_QUALITY", "LOW_RESOLUTION", "INVALID_IMAGE"],
    },
    vehicle_visible_pct: { type: Type.NUMBER },
    vehicle_bbox: {
      type: Type.ARRAY,
      items: { type: Type.INTEGER },
    },
  },
  required: ["is_vehicle", "view_angle", "image_quality"],
};

export type GateInput = {
  imageBytes: Buffer;
  mimeType: string;
  declaredView?: string;
};

function resolveGateModel(strictJson: boolean): string {
  if (
    strictJson &&
    envConfig.AI_FALLBACK_MODEL &&
    envConfig.AI_FALLBACK_MODEL !== envConfig.AI_MODEL
  ) {
    return envConfig.AI_FALLBACK_MODEL;
  }
  return envConfig.AI_MODEL;
}

async function callGeminiGateOnce(
  input: GateInput,
  strictJson = false,
): Promise<GeminiCallResult<GateParsedResponse>> {
  const client = getGeminiClient();
  const systemInstruction = strictJson
    ? IMAGE_GATE_SYSTEM + STRICT_JSON_SUFFIX
    : IMAGE_GATE_SYSTEM;

  const response = await withGeminiTimeout(
    client.models.generateContent({
      model: resolveGateModel(strictJson),
      contents: [
        {
          inlineData: {
            mimeType: input.mimeType,
            data: input.imageBytes.toString("base64"),
          },
        },
        { text: buildImageGateUserPrompt(input.declaredView, strictJson) },
      ],
      config: {
        systemInstruction,
        temperature: 0.1,
        maxOutputTokens: 512,
        responseMimeType: "application/json",
        responseSchema: GEMINI_GATE_RESPONSE_SCHEMA,
      },
    }),
  );

  const parsed = parseGeminiResponse(response, gateResponseSchema);
  return { data: parsed, usage: extractGeminiUsage(response) };
}

export async function gateImageWithGemini(
  input: GateInput,
): Promise<GeminiCallResult<GateParsedResponse>> {
  return callWithGeminiRetry(async ({ strictJson }) =>
    callGeminiGateOnce(input, strictJson),
  );
}

export { IMAGE_GATE_PROMPT_VERSION };
