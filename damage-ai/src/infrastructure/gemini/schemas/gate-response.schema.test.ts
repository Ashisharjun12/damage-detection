import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gateResponseSchema } from "@/infrastructure/gemini/schemas/gate-response.schema.js";

const baseGate = {
  is_vehicle: true,
  view_angle: "Front" as const,
  image_quality: "OK" as const,
};

describe("gateResponseSchema", () => {
  it("coerces vehicle_visible_pct from 0-100 to 0-1", () => {
    const parsed = gateResponseSchema.parse({
      ...baseGate,
      vehicle_visible_pct: 85,
    });
    assert.equal(parsed.vehicle_visible_pct, 0.85);
  });

  it("leaves vehicle_visible_pct unchanged when already 0-1", () => {
    const parsed = gateResponseSchema.parse({
      ...baseGate,
      vehicle_visible_pct: 0.9,
    });
    assert.equal(parsed.vehicle_visible_pct, 0.9);
  });

  it("coerces view_confidence from 0-100 to 0-1", () => {
    const parsed = gateResponseSchema.parse({
      ...baseGate,
      view_confidence: 92,
    });
    assert.equal(parsed.view_confidence, 0.92);
  });

  it("parses a full gate object with percent fields", () => {
    const parsed = gateResponseSchema.parse({
      is_vehicle: true,
      view_angle: "Front",
      view_confidence: 95,
      image_quality: "OK",
      vehicle_visible_pct: 100,
      vehicle_bbox: [0, 0, 1000, 1000],
    });
    assert.equal(parsed.view_confidence, 0.95);
    assert.equal(parsed.vehicle_visible_pct, 1);
    assert.deepEqual(parsed.vehicle_bbox, [0, 0, 1000, 1000]);
  });
});
