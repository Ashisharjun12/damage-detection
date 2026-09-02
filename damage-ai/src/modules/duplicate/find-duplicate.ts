import { hammingDistance } from "@/modules/ingest/fingerprint.js";

export type DuplicateRecord = {
  sha256: string;
  phash: string;
  image_id: string;
  qualityScore: number;
};

const PHASH_THRESHOLD = 10;

export function computeQualityScore(
  width: number,
  height: number,
  sharpness: number,
): number {
  return width * height * (sharpness / 255);
}

export function findDuplicate(
  sha256: string,
  phash: string,
  qualityScore: number,
  existing: DuplicateRecord[],
): {
  kind: "NONE" | "DUPLICATE_EXACT" | "DUPLICATE_NEAR";
  canonical?: DuplicateRecord;
} {
  const exact = existing.find((e) => e.sha256 === sha256);
  if (exact) return { kind: "DUPLICATE_EXACT", canonical: exact };

  let bestNear: DuplicateRecord | undefined;
  let bestDist = PHASH_THRESHOLD + 1;

  for (const e of existing) {
    const dist = hammingDistance(phash, e.phash);
    if (dist <= PHASH_THRESHOLD && dist < bestDist) {
      bestDist = dist;
      bestNear = e;
    }
  }

  if (bestNear) {
    const keepCurrent =
      qualityScore > bestNear.qualityScore;
    return {
      kind: "DUPLICATE_NEAR",
      canonical: keepCurrent ? undefined : bestNear,
    };
  }

  return { kind: "NONE" };
}

export function shouldSkipNearDuplicate(
  kind: "NONE" | "DUPLICATE_EXACT" | "DUPLICATE_NEAR",
  canonical?: DuplicateRecord,
): boolean {
  if (kind === "DUPLICATE_EXACT") return true;
  if (kind === "DUPLICATE_NEAR" && canonical) return true;
  return false;
}
