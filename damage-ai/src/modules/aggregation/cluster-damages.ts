import type {
  DamageCluster,
  DamageInstance,
  ViewAngle,
} from "@/types/m02.v1.js";
import { normalizeLocationOnPart } from "@/modules/spatial/location.js";

const VIEW_ADJACENT: Record<string, string[]> = {
  Front: ["Left", "Right"],
  Rear: ["Left", "Right"],
  Left: ["Front", "Rear"],
  Right: ["Front", "Rear"],
  Roof: ["Front", "Rear", "Left", "Right"],
  Interior: [],
  Unknown: [],
};

function matchScore(a: DamageInstance, b: DamageInstance): number {
  let score = 0;
  if (a.part_name === b.part_name) score += 0.35;
  if (a.damage_type === b.damage_type) score += 0.2;
  const locA = normalizeLocationOnPart(a.location_on_part);
  const locB = normalizeLocationOnPart(b.location_on_part);
  if (locA && locB && locA === locB) score += 0.2;
  if (a.side && b.side && a.side === b.side) score += 0.1;
  const adj = VIEW_ADJACENT[a.view_angle] ?? [];
  if (a.view_angle === b.view_angle || adj.includes(b.view_angle)) score += 0.1;
  if (a.severity === b.severity) score += 0.05;
  return score;
}

export function clusterDamages(instances: DamageInstance[]): DamageCluster[] {
  const clusters: DamageCluster[] = [];
  const assigned = new Set<string>();

  for (const inst of instances) {
    if (assigned.has(inst.instance_id)) continue;

    const group = [inst];
    assigned.add(inst.instance_id);
    let reviewCandidate = false;

    for (const other of instances) {
      if (assigned.has(other.instance_id)) continue;
      const score = matchScore(inst, other);
      if (score >= 0.8) {
        group.push(other);
        assigned.add(other.instance_id);
      } else if (score >= 0.5) {
        reviewCandidate = true;
      }
    }

    const severities = group.map((g) => g.severity);
    const severity = severities.includes("Severe")
      ? "Severe"
      : severities.includes("Moderate")
        ? "Moderate"
        : "Minor";

    const head = group[0];
    const needsReview =
      reviewCandidate ||
      group.some((g) => g.verification_status === "pending_review");
    clusters.push({
      cluster_id: `CLUSTER_${head.instance_id}`,
      part_name: head.part_name,
      damage_type: head.damage_type,
      severity,
      recommendation: severity === "Severe" ? "Replace" : head.recommendation,
      location_on_part: head.location_on_part,
      evidence_image_ids: [...new Set(group.map((g) => g.image_id))],
      evidence: group.map((g) => ({
        image_id: g.image_id,
        instance_id: g.instance_id,
      })),
      review_candidate: needsReview || undefined,
    });
  }

  return clusters;
}
