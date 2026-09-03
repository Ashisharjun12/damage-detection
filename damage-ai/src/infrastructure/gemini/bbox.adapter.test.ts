import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { box2dToNormalized } from "@/infrastructure/gemini/bbox.adapter.js";
import {
  filterOutsideVehicleBBox,
  filterPartSpatialSanity,
  isCentroidInsideBBox,
  isGroundOrAnomalyBox,
  isGroundSurfaceBox,
  isPartSpatialAnomaly,
  isRoadBandBox,
  shrinkVehicleBBoxBottom,
} from "@/modules/spatial/bbox.js";
import { bboxToPixelRect } from "@/modules/annotation/annotation.styles.js";
import type { DamageInstance } from "@/types/m02.v1.js";

function makeInstance(
  overrides: Partial<DamageInstance> & Pick<DamageInstance, "part_name" | "bounding_box">,
): DamageInstance {
  return {
    instance_id: "img_D001",
    image_id: "img",
    damage_type: "Scratch",
    severity: "Minor",
    recommendation: "Repair",
    confidence: 0.95,
    visibility: "FULL",
    view_angle: "Front",
    ...overrides,
  };
}

describe("box2dToNormalized", () => {
  it("converts ymin,xmin,ymax,xmax from 0-1000 scale", () => {
    const bbox = box2dToNormalized([100, 200, 300, 400]);
    assert.equal(bbox.y_min, 0.1);
    assert.equal(bbox.x_min, 0.2);
    assert.equal(bbox.y_max, 0.3);
    assert.equal(bbox.x_max, 0.4);
  });

  it("swaps inverted min/max", () => {
    const bbox = box2dToNormalized([300, 400, 100, 200]);
    assert.equal(bbox.y_min, 0.1);
    assert.equal(bbox.x_min, 0.2);
    assert.equal(bbox.y_max, 0.3);
    assert.equal(bbox.x_max, 0.4);
  });
});

describe("spatial filters", () => {
  it("rejects ground boxes with y_max above threshold", () => {
    assert.equal(isGroundOrAnomalyBox({ x_min: 0.1, y_min: 0.8, x_max: 0.3, y_max: 0.9 }), true);
    assert.equal(isGroundOrAnomalyBox({ x_min: 0.1, y_min: 0.5, x_max: 0.3, y_max: 0.7 }), false);
  });

  it("rejects bumper damage with centroid in road band", () => {
    const bbox = { x_min: 0.2, y_min: 0.75, x_max: 0.5, y_max: 0.95 };
    assert.equal(isPartSpatialAnomaly("Front Bumper", bbox, "Front"), true);
    assert.equal(isPartSpatialAnomaly("Front Bumper", { x_min: 0.2, y_min: 0.5, x_max: 0.5, y_max: 0.7 }, "Front"), false);
  });

  it("rejects Ertiga-like pavement box in front of wheel", () => {
    const pavementBox = { x_min: 0.45, y_min: 0.72, x_max: 0.55, y_max: 0.82 };
    assert.equal(isRoadBandBox(pavementBox, "Front Bumper"), true);
    assert.equal(isPartSpatialAnomaly("Front Bumper", pavementBox, "Front"), true);
  });

  it("rejects Swift-like gravel rear fender box on ground", () => {
    const gravelBox = { x_min: 0.55, y_min: 0.72, x_max: 0.75, y_max: 0.82 };
    assert.equal(isGroundSurfaceBox(gravelBox), true);
    assert.equal(isPartSpatialAnomaly("Rear Fender (L)", gravelBox, "Rear"), true);
    assert.equal(isPartSpatialAnomaly("Rear Fender (L)", gravelBox, "Left"), true);
  });

  it("keeps valid rear door dent on Left view", () => {
    const doorBox = { x_min: 0.35, y_min: 0.45, x_max: 0.55, y_max: 0.62 };
    assert.equal(isGroundSurfaceBox(doorBox), false);
    assert.equal(isPartSpatialAnomaly("Rear Door (L)", doorBox, "Left"), false);
  });

  it("keeps Tiguan-like front fender damage", () => {
    const fenderBox = { x_min: 0.15, y_min: 0.35, x_max: 0.35, y_max: 0.55 };
    assert.equal(isPartSpatialAnomaly("Front Fender (L)", fenderBox, "Front"), false);
  });

  it("keeps valid low bumper damage", () => {
    const bumperBox = { x_min: 0.2, y_min: 0.55, x_max: 0.5, y_max: 0.72 };
    assert.equal(isPartSpatialAnomaly("Front Bumper", bumperBox, "Front"), false);
  });

  it("filterPartSpatialSanity drops road bumper boxes", () => {
    const instances: DamageInstance[] = [
      makeInstance({
        part_name: "Front Bumper",
        bounding_box: { x_min: 0.2, y_min: 0.75, x_max: 0.5, y_max: 0.95 },
      }),
    ];
    assert.equal(filterPartSpatialSanity(instances, "Front").length, 0);
  });

  it("filterOutsideVehicleBBox rejects centroid outside trimmed vehicle bbox", () => {
    const vehicleBbox = [200, 150, 800, 850];
    const vehicle = shrinkVehicleBBoxBottom(box2dToNormalized(vehicleBbox), 0.08);
    const besideVehicle = { x_min: 0.02, y_min: 0.5, x_max: 0.12, y_max: 0.6 };
    assert.equal(isCentroidInsideBBox(besideVehicle, vehicle), false);

    const instances = [
      makeInstance({
        part_name: "Rear Door (L)",
        bounding_box: besideVehicle,
        view_angle: "Left",
      }),
    ];
    assert.equal(filterOutsideVehicleBBox(instances, vehicleBbox).length, 0);
  });

  it("filterOutsideVehicleBBox keeps damage with centroid inside vehicle", () => {
    const vehicleBbox = [200, 150, 800, 850];
    const onVehicle = { x_min: 0.35, y_min: 0.45, x_max: 0.55, y_max: 0.62 };
    const instances = [
      makeInstance({
        part_name: "Rear Door (L)",
        bounding_box: onVehicle,
        view_angle: "Left",
      }),
    ];
    assert.equal(filterOutsideVehicleBBox(instances, vehicleBbox).length, 1);
  });
});

describe("bboxToPixelRect", () => {
  it("maps normalized coords to pixel rect", () => {
    const rect = bboxToPixelRect(
      { x_min: 0.2, y_min: 0.1, x_max: 0.4, y_max: 0.3 },
      1000,
      800,
    );
    assert.equal(rect.x, 200);
    assert.equal(rect.y, 80);
    assert.equal(rect.w, 200);
    assert.equal(rect.h, 160);
  });
});
