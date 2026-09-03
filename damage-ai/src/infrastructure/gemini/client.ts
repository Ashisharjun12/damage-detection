import { GoogleGenAI, Type } from "@google/genai";
import { envConfig } from "@/config/env.js";
import { callWithGeminiRetry } from "@/infrastructure/gemini/retry-policy.js";

let ai: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: envConfig.AI_API_KEY });
  }
  return ai;
}

export const GEMINI_DAMAGE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    view_angle: {
      type: Type.STRING,
      enum: ["Front", "Rear", "Left", "Right", "Roof", "Interior", "Unknown"],
    },
    view_confidence: { type: Type.NUMBER },
    vehicle_count: { type: Type.INTEGER },
    image_quality: {
      type: Type.STRING,
      enum: ["OK", "LOW_QUALITY", "LOW_RESOLUTION", "INVALID_IMAGE"],
    },
    damages: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
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
          box_2d: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
          },
          location_on_part: { type: Type.STRING },
          side: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          visibility: {
            type: Type.STRING,
            enum: ["FULL", "PARTIAL", "OCCLUDED"],
          },
        },
        required: [
          "part_name",
          "damage_type",
          "severity",
          "box_2d",
          "confidence",
        ],
      },
    },
  },
  required: ["view_angle", "damages"],
};

export async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  return callWithGeminiRetry(async () => fn());
}
