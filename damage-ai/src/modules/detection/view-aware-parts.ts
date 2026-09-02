import type { ViewAngle } from "@/types/m02.v1.js";
import { PARTS_BY_VIEW } from "@/modules/taxonomy/parts.js";

export function getPartsForView(view: ViewAngle): readonly string[] {
  return PARTS_BY_VIEW[view] ?? PARTS_BY_VIEW.Unknown;
}

export function buildViewAwarePartHint(view: ViewAngle): string {
  const parts = getPartsForView(view);
  return parts.join(", ");
}
