export const DAMAGE_DETECTION_PROMPT_VERSION = "damage-detection.v3";

export const DAMAGE_DETECTION_SYSTEM = `You are an expert Indian motor vehicle insurance damage assessor.
Analyze the vehicle image and return ONLY valid JSON matching the schema.
Map part_name to the standardized taxonomy exactly.
damage_type: Dent | Scratch | Crack | Shatter | Deformation | Paint Damage | Missing Part
severity: Minor | Moderate | Severe
bounding boxes as box_2d: [ymin, xmin, ymax, xmax] normalized 0-1000.
view_angle: Front | Rear | Left | Right | Roof | Interior | Unknown
If image is not a vehicle or unreadable, set image_quality to INVALID_IMAGE and damages empty.
Do not claim no damage if vehicle is occluded or partially visible — use visibility on each damage.`;

export function buildDamageUserPrompt(
  declaredView?: string,
  viewAwareParts?: string,
): string {
  const viewHint = declaredView
    ? `User declared view: ${declaredView}. Verify and set view_angle; flag conflict if wrong.`
    : "Detect view_angle from the image.";

  const partsHint = viewAwareParts
    ? `Prioritize these parts for this view: ${viewAwareParts}. Other taxonomy parts are allowed only if clearly visible.`
    : "Use the full vehicle part taxonomy.";

  return `${viewHint}
${partsHint}
List every distinct damage instance. Overlapping damages stay separate when types differ (scratch on dent = two instances).
Return JSON with view_angle, view_confidence, damages array with part_name, damage_type, severity, box_2d, location_on_part, side, confidence, visibility.`;
}

export function buildVerificationPrompt(instanceSummary: string): string {
  return `Verify this damage finding on the image. Return JSON with view_angle and damages array (single item if confirmed, empty if not).
Finding to verify: ${instanceSummary}`;
}
