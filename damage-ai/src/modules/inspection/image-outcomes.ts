import type { ImageErrorCode } from "@/types/m02.v1.js";

export const IMAGE_OUTCOME_MESSAGES: Record<ImageErrorCode, string> = {
  UNREADABLE_DOCUMENT: "Please reupload a clear vehicle photo.",
  NOT_VEHICLE: "This does not appear to be a vehicle photo. Please upload a vehicle image.",
  LOW_QUALITY: "Retake with better lighting and focus.",
  NO_DAMAGE_FOUND:
    "No damage detected — re-inspect the vehicle or upload a closer photo.",
  GEMINI_CALL_FAILED: "Analysis failed — please try again later.",
};

export function outcomeMessage(code: ImageErrorCode): string {
  return IMAGE_OUTCOME_MESSAGES[code];
}
