import type { GenerateContentResponse } from "@google/genai";
import type { z } from "zod";
import { logger } from "@/shared/logger.js";

const RETRYABLE_FINISH_REASONS = new Set([
  "MAX_TOKENS",
  "SAFETY",
  "RECITATION",
  "OTHER",
  "LANGUAGE",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "SPII",
  "MALFORMED_FUNCTION_CALL",
  "IMAGE_SAFETY",
  "UNEXPECTED_TOOL_CALL",
]);

export function extractGeminiText(response: GenerateContentResponse): string {
  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts;
  if (parts?.length) {
    const joined = parts
      .map((part) => ("text" in part && typeof part.text === "string" ? part.text : ""))
      .join("");
    if (joined.trim()) return joined;
  }
  return response.text?.trim() ?? "";
}

export function assertFinishReason(response: GenerateContentResponse): void {
  const candidate = response.candidates?.[0];
  if (!candidate) {
    throw new Error("Empty Gemini response: no candidates");
  }

  const reason = candidate.finishReason;
  if (!reason || reason === "STOP") return;

  if (RETRYABLE_FINISH_REASONS.has(reason)) {
    throw new Error(`Gemini finish reason: ${reason}`);
  }
}

function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function extractJsonObject(text: string): string | undefined {
  const start = text.indexOf("{");
  if (start < 0) return undefined;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return undefined;
}

export function parseGeminiJson(text: string): unknown {
  const normalized = stripMarkdownFences(text);
  try {
    return JSON.parse(normalized);
  } catch {
    const extracted = extractJsonObject(normalized);
    if (!extracted) throw new SyntaxError("No JSON object found in Gemini response");
    return JSON.parse(extracted);
  }
}

export function parseGeminiResponse<T>(
  response: GenerateContentResponse,
  schema: z.ZodType<T>,
): T {
  assertFinishReason(response);
  const text = extractGeminiText(response);
  if (!text) throw new Error("Empty Gemini response");

  try {
    const raw = parseGeminiJson(text);
    return schema.parse(raw);
  } catch (err) {
    const finishReason = response.candidates?.[0]?.finishReason ?? "unknown";
    logger.warn(
      {
        finishReason,
        preview: text.slice(0, 120),
        err,
      },
      "gemini json parse failed",
    );
    throw err;
  }
}
