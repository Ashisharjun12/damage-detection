export const DAMAGE_DETECTION_PROMPT_VERSION = "damage-detection.v8";

const COSMETIC_MINOR_TYPES = ["Scratch", "Paint Damage"];

const DAMAGE_DETECTION_SYSTEM_BASE = `You are an expert Indian motor vehicle insurance and RTO damage assessor.
Analyze the vehicle image and return ONLY valid JSON matching the schema.
part_name MUST be exactly one of the allowed parts listed in the user prompt for this view.
damage_type: Dent | Scratch | Crack | Shatter | Deformation | Paint Damage | Missing Part
severity: Minor | Moderate | Severe
bounding boxes as box_2d: [ymin, xmin, ymax, xmax] integers normalized 0-1000 relative to the exact image provided (top-left origin).
Each box_2d must tightly enclose visible damage pixels only — exclude road, pavement, asphalt, shadows, and background.
view_angle: Front | Rear | Left | Right | Roof | Interior | Unknown
If image is not a vehicle or unreadable, set image_quality to INVALID_IMAGE and damages empty.
If no visible claim-worthy damage on the vehicle, return damages as an empty array.
Do not claim no damage if vehicle is occluded or partially visible — use visibility on each damage.
Report only RTO/insurance-relevant visible damage at normal survey distance — not damage that requires close inspection or a magnifier.
Do not report hairline scratches, swirl marks, wash marks, dust, or Minor Scratch or Minor Paint Damage unless paint is clearly chipped or bare metal is exposed.
Report Scratch only when a distinct continuous scuff line crosses the panel — not texture, dirt, reflection, or normal wear.
Report Dent or Deformation only when panel shape or contour is visibly changed.
Do not report damage that is only sunlight glare, specular highlights, sky/tree/environment reflections, wet shine, or normal paint gloss. Bright white patches on dark paint are often reflections, not dents.
Plastic bumpers and claddings may look a different shade than metal body panels — that is not Paint Damage unless paint is chipped or peeling.
Analyze only the primary survey vehicle (largest or centered car in frame). Never box road, ground, leaves, people, buses, or other parked vehicles in the background.
Never report damage on gravel, stones, dry leaves, soil, pavement, or ground texture. Do not confuse pebbles, leaf shadows, or dirty ground with Scratch or Paint Damage.
box_2d must lie on vehicle surfaces only: painted metal, plastic panels, glass, or tyre rubber when reporting tyre damage.
If a box would overlap the ground below the vehicle sill or rocker panel, do not report it. Do not label pavement or gravel near wheels as Rear Bumper, Rear Fender, or Rocker Panel damage.
Ignore timestamp text burned into the image corner.
When harsh lighting makes damage ambiguous, prefer an empty damages array over guessing; use lower confidence when uncertain.`;

export function buildDamageSystemPrompt(strictJson = false): string {
  if (!strictJson) return DAMAGE_DETECTION_SYSTEM_BASE;
  return `${DAMAGE_DETECTION_SYSTEM_BASE} Return ONLY valid JSON matching the schema. No markdown, no prose, no code fences.`;
}

/** @deprecated use buildDamageSystemPrompt */
export const DAMAGE_DETECTION_SYSTEM = DAMAGE_DETECTION_SYSTEM_BASE;

export function buildDamageUserPrompt(
  declaredView?: string,
  viewAwareParts?: string,
): string {
  const viewHint = declaredView
    ? `User declared view: ${declaredView}. Verify and set view_angle; flag conflict if wrong.`
    : "Detect view_angle from the image.";

  const partsHint = viewAwareParts
    ? `Allowed part_name values for this view (use exactly these strings): ${viewAwareParts}.`
    : "Use the full vehicle part taxonomy.";

  return `${viewHint}
${partsHint}
Only detect damage on the primary vehicle in frame. Do not annotate background objects, gravel, or ground.
Report only RTO/insurance-relevant visible damage. Skip cosmetic hairline scratches and minor paint scuffs.
Overlapping claim-worthy damages stay separate when types differ (scratch on dent = two instances).
Return JSON with view_angle, view_confidence, damages array with part_name, damage_type, severity, box_2d, location_on_part, side, confidence, visibility.`;
}

export function buildVerificationPrompt(instanceSummary: string): string {
  return `Verify this damage finding on the image. Return JSON with view_angle and damages array (single item if confirmed, empty if not).
Verify this is PHYSICAL claim-worthy damage on the vehicle body — not a sunlight reflection, shadow, glare highlight, dirt, gravel, leaves, pavement, hairline scratch, or cosmetic paint scuff.
Return empty damages array if the finding is only a lighting artifact, ground texture, or Minor Scratch/Paint Damage that is not claim-worthy.
Finding to verify: ${instanceSummary}`;
}

export function isCosmeticMinorDamage(
  severity: string,
  damageType: string,
): boolean {
  return severity === "Minor" && COSMETIC_MINOR_TYPES.includes(damageType);
}
