import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildDamageSystemPrompt,
  buildDamageUserPrompt,
  buildVerificationPrompt,
  DAMAGE_DETECTION_PROMPT_VERSION,
  isCosmeticMinorDamage,
} from "@/infrastructure/gemini/prompts/damage-detection.js";

describe("damage-detection prompts v8", () => {
  it("uses v8 version", () => {
    assert.equal(DAMAGE_DETECTION_PROMPT_VERSION, "damage-detection.v8");
  });

  it("system prompt includes RTO and cosmetic minor rules", () => {
    const system = buildDamageSystemPrompt();
    assert.match(system, /RTO\/insurance-relevant/i);
    assert.match(system, /hairline scratches/i);
    assert.match(system, /Minor Scratch or Minor Paint Damage/i);
    assert.match(system, /gravel/i);
    assert.match(system, /vehicle surfaces only/i);
  });

  it("user prompt focuses on claim-worthy damage only", () => {
    const user = buildDamageUserPrompt("Left", "Front Bumper, Hood");
    assert.match(user, /RTO\/insurance-relevant visible damage/i);
    assert.match(user, /cosmetic hairline scratches/i);
    assert.doesNotMatch(user, /List every distinct damage/i);
  });

  it("verification prompt rejects cosmetic minor findings", () => {
    const verify = buildVerificationPrompt("Rear Door Dent Moderate");
    assert.match(verify, /hairline scratch/i);
    assert.match(verify, /cosmetic paint scuff/i);
    assert.match(verify, /Minor Scratch\/Paint Damage/i);
  });

  it("isCosmeticMinorDamage identifies cosmetic minors only", () => {
    assert.equal(isCosmeticMinorDamage("Minor", "Scratch"), true);
    assert.equal(isCosmeticMinorDamage("Minor", "Paint Damage"), true);
    assert.equal(isCosmeticMinorDamage("Minor", "Dent"), false);
    assert.equal(isCosmeticMinorDamage("Moderate", "Scratch"), false);
  });
});
