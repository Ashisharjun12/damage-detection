import type { PartName, ViewAngle } from "@/types/m02.v1.js";
import { PART_TAXONOMY } from "@/types/m02.v1.js";

export const PARTS_BY_VIEW: Record<ViewAngle, readonly PartName[]> = {
  Front: [
    "Front Bumper",
    "Hood / Bonnet",
    "Front Grille",
    "Headlamp (L)",
    "Headlamp (R)",
    "Fog Lamp (L)",
    "Fog Lamp (R)",
    "Front Windshield",
    "Front Fender (L)",
    "Front Fender (R)",
  ],
  Rear: [
    "Rear Bumper",
    "Dicky / Boot Lid",
    "Tail Lamp (L)",
    "Tail Lamp (R)",
    "Rear Windshield",
    "Rear Fender (L)",
    "Rear Fender (R)",
    "Number Plate Panel",
  ],
  Left: [
    "Front Fender (L)",
    "Front Door (L)",
    "Rear Door (L)",
    "Rear Fender (L)",
    "Side Mirror (L)",
    "Rocker Panel (L)",
    "Running Board",
    "B-Pillar / C-Pillar",
    "A-Pillar (L)",
  ],
  Right: [
    "Front Fender (R)",
    "Front Door (R)",
    "Rear Door (R)",
    "Rear Fender (R)",
    "Side Mirror (R)",
    "Rocker Panel (R)",
    "Running Board",
    "B-Pillar / C-Pillar",
    "A-Pillar (R)",
  ],
  Roof: ["Roof Panel", "Sunroof Glass", "A-Pillar (L)", "A-Pillar (R)"],
  Interior: ["Airbags / Interior", "Front Windshield", "Rear Windshield"],
  Unknown: PART_TAXONOMY,
};

export function isValidPartName(name: string): boolean {
  return (PART_TAXONOMY as readonly string[]).includes(name);
}
