import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { GenerateContentResponse } from "@google/genai";
import { z } from "zod";
import {
  assertFinishReason,
  extractGeminiText,
  parseGeminiJson,
  parseGeminiResponse,
} from "@/infrastructure/gemini/parse-response.js";

const gateSchema = z.object({
  is_vehicle: z.boolean(),
  view_angle: z.string(),
  image_quality: z.string(),
});

function mockResponse(
  text: string,
  finishReason = "STOP",
): GenerateContentResponse {
  return {
    candidates: [
      {
        finishReason,
        content: {
          parts: [{ text }],
        },
      },
    ],
    text,
  } as GenerateContentResponse;
}

describe("extractGeminiText", () => {
  it("joins candidate part text", () => {
    const response = mockResponse('{"a":1}');
    assert.equal(extractGeminiText(response), '{"a":1}');
  });

  it("falls back to response.text", () => {
    const response = {
      candidates: [{ finishReason: "STOP", content: { parts: [] } }],
      text: '{"b":2}',
    } as unknown as GenerateContentResponse;
    assert.equal(extractGeminiText(response), '{"b":2}');
  });
});

describe("parseGeminiJson", () => {
  it("parses clean JSON", () => {
    assert.deepEqual(parseGeminiJson('{"is_vehicle":true}'), { is_vehicle: true });
  });

  it("strips markdown fences", () => {
    const raw = '```json\n{"is_vehicle":true}\n```';
    assert.deepEqual(parseGeminiJson(raw), { is_vehicle: true });
  });

  it("extracts JSON from prose wrapper", () => {
    const raw = 'Here is the result: {"is_vehicle":true,"view_angle":"Left"} done.';
    assert.deepEqual(parseGeminiJson(raw), {
      is_vehicle: true,
      view_angle: "Left",
    });
  });

  it("throws on truncated JSON", () => {
    assert.throws(() => parseGeminiJson('{"is_vehicle": true, "view_an'), SyntaxError);
  });
});

describe("assertFinishReason", () => {
  it("accepts STOP", () => {
    assert.doesNotThrow(() => assertFinishReason(mockResponse("{}", "STOP")));
  });

  it("throws retryable error on MAX_TOKENS", () => {
    assert.throws(
      () => assertFinishReason(mockResponse("{}", "MAX_TOKENS")),
      /Gemini finish reason: MAX_TOKENS/,
    );
  });

  it("throws when no candidates", () => {
    assert.throws(
      () =>
        assertFinishReason({ candidates: [] } as unknown as GenerateContentResponse),
      /no candidates/,
    );
  });
});

describe("parseGeminiResponse", () => {
  it("parses and validates gate JSON", () => {
    const response = mockResponse(
      JSON.stringify({
        is_vehicle: true,
        view_angle: "Left",
        image_quality: "OK",
      }),
    );
    const parsed = parseGeminiResponse(response, gateSchema);
    assert.equal(parsed.is_vehicle, true);
    assert.equal(parsed.view_angle, "Left");
  });

  it("propagates finish reason errors", () => {
    const response = mockResponse("{}", "MAX_TOKENS");
    assert.throws(() => parseGeminiResponse(response, gateSchema), /MAX_TOKENS/);
  });
});
