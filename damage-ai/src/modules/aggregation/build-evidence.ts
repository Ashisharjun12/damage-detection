import type { DamageCluster } from "@/types/m02.v1.js";

export function enrichClusterEvidence(clusters: DamageCluster[]): DamageCluster[] {
  return clusters.map((c) => ({
    ...c,
    evidence:
      c.evidence ??
      c.evidence_image_ids.map((image_id) => ({
        image_id,
        instance_id: c.cluster_id,
      })),
  }));
}
