import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GeminiCallError,
  isJsonParseError,
  isRateLimitError,
  isRetryableGeminiError,
  isTimeoutError,
} from "@/infrastructure/gemini/retry-policy.js";
import { isClusterEligible } from "@/modules/detection/detect-damage.js";
import { clusterDamages } from "@/modules/aggregation/cluster-damages.js";
import { filterOutsideVehicleBBox } from "@/modules/spatial/bbox.js";
import type { DamageInstance } from "@/types/m02.v1.js";

describe("retry-policy classifiers", () => {
  it("detects rate limit errors", () => {
    assert.equal(isRateLimitError({ status: 429 }), true);
    assert.equal(isRateLimitError(new Error("quota exceeded")), true);
  });

  it("detects timeout errors", () => {
    assert.equal(isTimeoutError(new Error("GEMINI_TIMEOUT")), true);
  });

  it("detects json parse errors", () => {
    assert.equal(isJsonParseError(new SyntaxError("Unexpected token")), true);
  });

  it("marks retryable errors", () => {
    assert.equal(isRetryableGeminiError(new Error("Empty Gemini response")), true);
    assert.equal(isRetryableGeminiError(new Error("random failure")), false);
  });

  it("GeminiCallError has code", () => {
    const err = new GeminiCallError("failed");
    assert.equal(err.code, "GEMINI_CALL_FAILED");
  });
});

describe("isClusterEligible", () => {
  const base: DamageInstance = {
    instance_id: "img_D001",
    image_id: "img",
    part_name: "Front Bumper",
    damage_type: "Scratch",
    severity: "Minor",
    recommendation: "Repair",
    bounding_box: { x_min: 0.2, y_min: 0.5, x_max: 0.4, y_max: 0.6 },
    confidence: 0.95,
    visibility: "FULL",
    view_angle: "Front",
  };

  it("accepts high confidence confirmed", () => {
    assert.equal(isClusterEligible(base), true);
  });

  it("rejects low confidence", () => {
    assert.equal(isClusterEligible({ ...base, confidence: 0.5 }), false);
  });

  it("rejects pending review", () => {
    assert.equal(
      isClusterEligible({ ...base, verification_status: "pending_review" }),
      false,
    );
  });
});

describe("clusterDamages", () => {
  it("excludes low-confidence instances", () => {
    const instances: DamageInstance[] = [
      {
        instance_id: "a",
        image_id: "i1",
        part_name: "Front Bumper",
        damage_type: "Scratch",
        severity: "Minor",
        recommendation: "Repair",
        bounding_box: { x_min: 0.1, y_min: 0.5, x_max: 0.2, y_max: 0.6 },
        confidence: 0.95,
        visibility: "FULL",
        view_angle: "Front",
      },
      {
        instance_id: "b",
        image_id: "i1",
        part_name: "Front Bumper",
        damage_type: "Scratch",
        severity: "Minor",
        recommendation: "Repair",
        bounding_box: { x_min: 0.1, y_min: 0.5, x_max: 0.2, y_max: 0.6 },
        confidence: 0.4,
        visibility: "FULL",
        view_angle: "Front",
      },
    ];
    const clusters = clusterDamages(instances);
    assert.equal(clusters.length, 1);
    assert.equal(clusters[0].evidence?.length, 1);
  });
});

describe("filterOutsideVehicleBBox", () => {
  it("drops boxes outside vehicle region", () => {
    const instances: DamageInstance[] = [
      {
        instance_id: "a",
        image_id: "i1",
        part_name: "Front Bumper",
        damage_type: "Scratch",
        severity: "Minor",
        recommendation: "Repair",
        bounding_box: { x_min: 0.1, y_min: 0.5, x_max: 0.2, y_max: 0.6 },
        confidence: 0.9,
        visibility: "FULL",
        view_angle: "Front",
      },
      {
        instance_id: "b",
        image_id: "i1",
        part_name: "Front Bumper",
        damage_type: "Scratch",
        severity: "Minor",
        recommendation: "Repair",
        bounding_box: { x_min: 0.9, y_min: 0.9, x_max: 0.95, y_max: 0.95 },
        confidence: 0.9,
        visibility: "FULL",
        view_angle: "Front",
      },
    ];
    const filtered = filterOutsideVehicleBBox(instances, [200, 50, 900, 900]);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].instance_id, "a");
  });

  it("drops box below trimmed vehicle bottom with loose gate bbox", () => {
    const instances: DamageInstance[] = [
      {
        instance_id: "on_bumper",
        image_id: "i1",
        part_name: "Front Bumper",
        damage_type: "Deformation",
        severity: "Moderate",
        recommendation: "Repair",
        bounding_box: { x_min: 0.15, y_min: 0.55, x_max: 0.25, y_max: 0.68 },
        confidence: 0.9,
        visibility: "FULL",
        view_angle: "Front",
      },
      {
        instance_id: "below_trim",
        image_id: "i1",
        part_name: "Front Bumper",
        damage_type: "Paint Damage",
        severity: "Minor",
        recommendation: "Repair",
        bounding_box: { x_min: 0.45, y_min: 0.87, x_max: 0.55, y_max: 0.92 },
        confidence: 0.9,
        visibility: "FULL",
        view_angle: "Front",
      },
    ];
    const filtered = filterOutsideVehicleBBox(
      instances,
      [150, 80, 950, 920],
      0.75,
      0.08,
    );
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].instance_id, "on_bumper");
  });
});
