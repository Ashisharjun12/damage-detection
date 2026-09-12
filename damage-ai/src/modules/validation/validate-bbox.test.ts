import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { filterCosmeticMinor } from "@/modules/validation/validate-bbox.js";
import { isClusterEligible } from "@/modules/detection/detect-damage.js";
import type { DamageInstance } from "@/types/m02.v1.js";

function makeInstance(
  overrides: Partial<DamageInstance> & Pick<DamageInstance, "severity" | "damage_type">,
): DamageInstance {
  return {
    instance_id: "img_D001",
    image_id: "img",
    part_name: "Front Door (L)",
    recommendation: "Repair",
    bounding_box: { x_min: 0.3, y_min: 0.4, x_max: 0.5, y_max: 0.55 },
    confidence: 0.95,
    visibility: "FULL",
    view_angle: "Left",
    ...overrides,
  };
}

describe("filterCosmeticMinor", () => {
  it("drops Minor Scratch", () => {
    const instances = [makeInstance({ severity: "Minor", damage_type: "Scratch" })];
    const result = filterCosmeticMinor(instances);
    assert.equal(result.instances.length, 0);
    assert.match(result.flags[0], /cosmetic_minor_dropped/);
  });

  it("drops Minor Paint Damage", () => {
    const instances = [makeInstance({ severity: "Minor", damage_type: "Paint Damage" })];
    const result = filterCosmeticMinor(instances);
    assert.equal(result.instances.length, 0);
  });

  it("keeps Minor Dent", () => {
    const instances = [makeInstance({ severity: "Minor", damage_type: "Dent", confidence: 0.92 })];
    const result = filterCosmeticMinor(instances);
    assert.equal(result.instances.length, 1);
    assert.equal(result.flags.length, 0);
  });

  it("keeps Moderate Scratch", () => {
    const instances = [makeInstance({ severity: "Moderate", damage_type: "Scratch" })];
    const result = filterCosmeticMinor(instances);
    assert.equal(result.instances.length, 1);
  });
});

describe("isClusterEligible cosmetic minor", () => {
  it("rejects Minor Scratch even at high confidence", () => {
    const inst = makeInstance({ severity: "Minor", damage_type: "Scratch", confidence: 0.99 });
    assert.equal(isClusterEligible(inst), false);
  });

  it("accepts Minor Dent at high confidence", () => {
    const inst = makeInstance({ severity: "Minor", damage_type: "Dent", confidence: 0.95 });
    assert.equal(isClusterEligible(inst), true);
  });
});
