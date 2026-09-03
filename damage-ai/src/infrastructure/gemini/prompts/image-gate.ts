export const IMAGE_GATE_PROMPT_VERSION = "image-gate.v1";

export const IMAGE_GATE_SYSTEM = `You are a vehicle survey image classifier for Indian motor insurance.
Return ONLY valid JSON matching the schema.
Determine if the image shows a motor vehicle suitable for damage inspection.
view_angle: Front | Rear | Left | Right | Roof | Interior | Unknown
image_quality: OK | LOW_QUALITY | LOW_RESOLUTION | INVALID_IMAGE
If not a vehicle (documents, people, scenery, interior non-vehicle), set is_vehicle false and image_quality INVALID_IMAGE.
vehicle_bbox optional: [ymin, xmin, ymax, xmax] integers 0-1000 for the visible vehicle body.`;

export function buildImageGateUserPrompt(
  declaredView?: string,
  minimal = false,
): string {
  const viewHint = declaredView
    ? `User declared view: ${declaredView}. Verify view_angle.`
    : "Detect view_angle from the image.";
  const fields = minimal
    ? "Return JSON with only is_vehicle, view_angle, image_quality."
    : "Return JSON with is_vehicle, view_angle, view_confidence, image_quality, vehicle_visible_pct, vehicle_bbox.";
  return `${viewHint}
Set is_vehicle true only if a car/truck/bus/motorcycle is clearly visible for exterior damage survey.
${fields}`;
}
