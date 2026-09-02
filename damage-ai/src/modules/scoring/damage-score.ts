import type { DamageCluster } from "@/types/m02.v1.js";
import { SEVERITY_POINTS } from "@/modules/scoring/repair-replace-rules.js";
import { normalizeLocationOnPart } from "@/modules/spatial/location.js";

function uniqueRegionKey(cluster: DamageCluster): string {
  const loc = normalizeLocationOnPart(cluster.location_on_part);
  return `${cluster.part_name}::${loc}`;
}

export function computeOverallScore(clusters: DamageCluster[]): number {
  if (clusters.length === 0) return 0;
  const scores = clusters.map((c) => SEVERITY_POINTS[c.severity]);
  const max = Math.max(...scores);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.min(100, Math.round(max * 0.6 + avg * 0.4));
}

export function buildSummary(clusters: DamageCluster[]) {
  const repair_count = clusters.filter((c) => c.recommendation === "Repair").length;
  const replace_count = clusters.filter((c) => c.recommendation === "Replace").length;
  const uniqueRegions = new Set(clusters.map(uniqueRegionKey));
  return {
    parts_affected: uniqueRegions.size,
    repair_count,
    replace_count,
    total_damages: clusters.length,
  };
}
