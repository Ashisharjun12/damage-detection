import type { ViewAngle } from "@/types/m02.v1.js";
import { VIEW_ANGLES } from "@/types/m02.v1.js";

export type ViewClassification = {
  view_angle: ViewAngle;
  view_confidence?: number;
  view_conflict?: boolean;
};

export function resolveDeclaredView(declaredView?: string): ViewAngle {
  if (!declaredView) return "Unknown";
  const match = VIEW_ANGLES.find(
    (v) => v.toLowerCase() === declaredView.trim().toLowerCase(),
  );
  return match ?? "Unknown";
}

export function classifyViewFromDetection(
  detectedView: ViewAngle,
  viewConfidence?: number,
  declaredView?: string,
): ViewClassification {
  const declared = resolveDeclaredView(declaredView);
  const view_conflict =
    declared !== "Unknown" &&
    detectedView !== "Unknown" &&
    declared !== detectedView;

  return {
    view_angle: detectedView,
    view_confidence: viewConfidence,
    view_conflict: view_conflict || undefined,
  };
}

export function checkVehicleConsistencyStub(): string[] {
  // V1.5: cross-image vehicle colour/body consistency
  return [];
}
