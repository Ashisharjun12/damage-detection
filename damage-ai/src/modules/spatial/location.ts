const LOCATION_ALIASES: Record<string, string> = {
  "lower left": "lower left side",
  "lower left corner": "lower left side",
  "lower right": "lower right side",
  "lower right corner": "lower right side",
  "upper left": "upper left side",
  "upper right": "upper right side",
  "center-left": "center left",
  "center-right": "center right",
};

export function normalizeLocationOnPart(location?: string): string {
  if (!location) return "";
  const key = location.trim().toLowerCase().replace(/\s+/g, " ");
  return LOCATION_ALIASES[key] ?? key;
}
