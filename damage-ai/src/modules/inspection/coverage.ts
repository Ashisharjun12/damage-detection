import { MANDATORY_VIEWS } from "@/types/m02.v1.js";
import type { ViewAngle } from "@/types/m02.v1.js";

export function computeCoverage(detectedViews: ViewAngle[]) {
  const set = new Set(detectedViews.filter((v) => v !== "Unknown"));
  const missing = MANDATORY_VIEWS.filter((v) => !set.has(v));
  const status: "COMPLETE" | "INCOMPLETE" =
    missing.length === 0 ? "COMPLETE" : "INCOMPLETE";
  return {
    status,
    detected_views: [...set] as ViewAngle[],
    missing_views: [...missing],
  };
}
