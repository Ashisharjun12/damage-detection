import { PART_TAXONOMY } from "@/types/m02.v1.js";
import { isValidPartName } from "@/modules/taxonomy/parts.js";

const PART_ALIASES: Record<string, string> = {
  "front bumper": "Front Bumper",
  "hood": "Hood / Bonnet",
  "bonnet": "Hood / Bonnet",
  "front grille": "Front Grille",
  "grille": "Front Grille",
  "headlamp left": "Headlamp (L)",
  "headlamp (left)": "Headlamp (L)",
  "headlamp right": "Headlamp (R)",
  "headlamp (right)": "Headlamp (R)",
  "lh headlamp": "Headlamp (L)",
  "rh headlamp": "Headlamp (R)",
  "left headlamp": "Headlamp (L)",
  "right headlamp": "Headlamp (R)",
  "front windshield": "Front Windshield",
  "windshield": "Front Windshield",
  "rear bumper": "Rear Bumper",
  "boot lid": "Dicky / Boot Lid",
  "boot": "Dicky / Boot Lid",
  "dicky": "Dicky / Boot Lid",
};

export function normalizePartName(raw: string): string | null {
  const trimmed = raw.trim();
  if (isValidPartName(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();
  if (PART_ALIASES[lower]) return PART_ALIASES[lower];

  const fuzzy = PART_TAXONOMY.find(
    (p) => p.toLowerCase() === lower || p.toLowerCase().includes(lower),
  );
  return fuzzy ?? null;
}
