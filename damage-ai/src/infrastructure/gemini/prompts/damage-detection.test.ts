import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildDamageSystemPrompt,
  buildDamageUserPrompt,
  buildVerificationPrompt,
  DAMAGE_DETECTION_PROMPT_VERSION,
} from "@/infrastructure/gemini/prompts/damage-detection.js";

describe("damage-detection prompts v7", () => {
  it("uses v7 version", () => {
    assert.equal(DAMAGE_DETECTION_PROMPT_VERSION, "damage-detection.v7");
  });

  it("system prompt includes gravel, ground, and vehicle-surface rules", () => {
    const system = buildDamageSystemPrompt();
    assert.match(system, /gravel/i);
    assert.match(system, /pavement/i);
    assert.match(system, /vehicle surfaces only/i);
    assert.match(system, /reflection/i);
    assert.match(system, /primary survey vehicle/i);
    assert.match(system, /rocker panel/i);
  });

  it("user prompt limits detection to primary vehicle and excludes ground", () => {
    const user = buildDamageUserPrompt("Left", "Front Bumper, Hood");
    assert.match(user, /primary vehicle in frame/i);
    assert.match(user, /gravel, or ground/i);
  });

  it("verification prompt rejects lighting artifacts and non-vehicle surfaces", () => {
    const verify = buildVerificationPrompt("Rear Door Dent Moderate");
    assert.match(verify, /lighting artifact/i);
    assert.match(verify, /gravel/i);
    assert.match(verify, /pavement/i);
    assert.match(verify, /non-vehicle surface/i);
    assert.match(verify, /PHYSICAL damage/i);
  });
});
