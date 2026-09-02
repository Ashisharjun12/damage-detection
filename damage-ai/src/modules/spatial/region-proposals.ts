import sharp from "sharp";
import { envConfig } from "@/config/env.js";
import type { NormalizedBBox } from "@/types/m02.v1.js";
import { bboxArea } from "@/infrastructure/gemini/bbox.adapter.js";
import { bboxIoU } from "@/modules/spatial/iou.js";
import type { RegionProposal } from "@/modules/spatial/mobile-sam/types.js";

const GRID = 8;
const PROPOSAL_SIZE = 0.18;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function carCropBounds(): { xMin: number; yMin: number; xMax: number; yMax: number } {
  if (!envConfig.SEG_CAR_CROP_ENABLED) {
    return { xMin: 0, yMin: 0, xMax: 1, yMax: 1 };
  }
  return { xMin: 0.05, yMin: 0, xMax: 0.95, yMax: 0.85 };
}

function makeBox(cx: number, cy: number, size: number): NormalizedBBox {
  const half = size / 2;
  return {
    x_min: clamp01(cx - half),
    y_min: clamp01(cy - half),
    x_max: clamp01(cx + half),
    y_max: clamp01(cy + half),
  };
}

function inCarCrop(bbox: NormalizedBBox, crop: ReturnType<typeof carCropBounds>): boolean {
  const cx = (bbox.x_min + bbox.x_max) / 2;
  const cy = (bbox.y_min + bbox.y_max) / 2;
  return cx >= crop.xMin && cx <= crop.xMax && cy >= crop.yMin && cy <= crop.yMax;
}

function mergeProposals(proposals: RegionProposal[], iouThreshold: number): RegionProposal[] {
  const kept: RegionProposal[] = [];
  for (const p of proposals.sort((a, b) => b.score - a.score)) {
    const overlaps = kept.some(
      (k) => bboxIoU(k.bbox, p.bbox) >= iouThreshold,
    );
    if (!overlaps) kept.push(p);
  }
  return kept;
}

export async function proposeRegions(
  imageBuffer: Buffer,
  width: number,
  height: number,
): Promise<RegionProposal[]> {
  const crop = carCropBounds();
  const analysisSize = 256;

  const { data } = await sharp(imageBuffer)
    .resize(analysisSize, analysisSize, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cellW = analysisSize / GRID;
  const cellH = analysisSize / GRID;
  const scores: { cx: number; cy: number; score: number }[] = [];

  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const cxNorm = (gx + 0.5) / GRID;
      const cyNorm = (gy + 0.5) / GRID;
      const probe = makeBox(cxNorm, cyNorm, PROPOSAL_SIZE);
      if (!inCarCrop(probe, crop)) continue;

      let sum = 0;
      let count = 0;
      const x0 = Math.floor(gx * cellW);
      const y0 = Math.floor(gy * cellH);
      const x1 = Math.min(analysisSize, Math.floor((gx + 1) * cellW));
      const y1 = Math.min(analysisSize, Math.floor((gy + 1) * cellH));

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = y * analysisSize + x;
          const v = data[idx];
          const left = data[y * analysisSize + Math.max(0, x - 1)];
          const up = data[Math.max(0, y - 1) * analysisSize + x];
          sum += Math.abs(v - left) + Math.abs(v - up);
          count++;
        }
      }

      scores.push({ cx: cxNorm, cy: cyNorm, score: count > 0 ? sum / count : 0 });
    }
  }

  const sorted = scores.sort((a, b) => b.score - a.score);
  const proposals: RegionProposal[] = sorted
    .slice(0, GRID * GRID)
    .map((s) => ({
      bbox: makeBox(s.cx, s.cy, PROPOSAL_SIZE),
      score: s.score,
    }));

  const merged = mergeProposals(proposals, 0.5);

  const minArea = envConfig.SEG_MIN_MASK_AREA;
  return merged.filter((p) => bboxArea(p.bbox) >= minArea * 0.5);
}

export function filterSegmentationMasks<
  T extends { mask: Uint8Array; samIoU: number; envelope: NormalizedBBox },
>(masks: T[]): T[] {
  const minIoU = envConfig.SEG_MIN_MASK_IOU;
  const minArea = envConfig.SEG_MIN_MASK_AREA;
  const maxRegions = envConfig.MAX_REGIONS_PER_IMAGE;

  const filtered = masks
    .filter((m) => m.samIoU >= minIoU && bboxArea(m.envelope) >= minArea)
    .sort((a, b) => b.samIoU - a.samIoU);

  const kept: T[] = [];
  for (const m of filtered) {
    if (kept.length >= maxRegions) break;
    const overlaps = kept.some(
      (k) => maskIoU(k.mask, m.mask) >= 0.5,
    );
    if (!overlaps) kept.push(m);
  }
  return kept;
}

function maskIoU(a: Uint8Array, b: Uint8Array): number {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] && b[i]) inter++;
    if (a[i] || b[i]) union++;
  }
  return union <= 0 ? 0 : inter / union;
}
