import type { Severity } from "@/types/m02.v1.js";

const STRUCTURAL_PARTS = [
  "A-Pillar (L)",
  "A-Pillar (R)",
  "Underbody / Frame",
  "Front Windshield",
  "Airbags / Interior",
];

export function recommendForSeverity(
  severity: Severity,
  partName: string,
): "Repair" | "Replace" {
  if (severity === "Severe") return "Replace";
  if (severity === "Moderate" && STRUCTURAL_PARTS.includes(partName)) {
    return "Replace";
  }
  return "Repair";
}

export const SEVERITY_POINTS: Record<Severity, number> = {
  Minor: 20,
  Moderate: 50,
  Severe: 90,
};

export const HIGH_RISK_PARTS = [
  "Airbags / Interior",
  "Front Windshield",
  "A-Pillar (L)",
  "A-Pillar (R)",
  "Underbody / Frame",
  "Wheels / Alloys",
];

export const HIGH_RISK_TYPES = ["Shatter", "Deformation", "Missing Part"];
