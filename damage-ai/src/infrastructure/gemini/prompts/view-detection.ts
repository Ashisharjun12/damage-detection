export const VIEW_DETECTION_PROMPT_VERSION = "view-detection-v1";

export const VIEW_DETECTION_SYSTEM = `You classify the camera view angle of a vehicle inspection photo for Indian motor surveys.
Respond with strict JSON only. Do not list damages.`;

export function buildViewUserPrompt(declaredView?: string): string {
  if (declaredView) {
    return `Declared view: ${declaredView}. Confirm or correct the vehicle camera angle.`;
  }
  return "Identify the vehicle camera view angle from this inspection photo.";
}
