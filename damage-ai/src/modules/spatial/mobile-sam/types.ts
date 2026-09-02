import type { NormalizedBBox } from "@/types/m02.v1.js";

export type SamTransform = {
  originalWidth: number;
  originalHeight: number;
  resizedWidth: number;
  resizedHeight: number;
};

export type RegionProposal = {
  bbox: NormalizedBBox;
  score: number;
};

export type SegmentationMask = {
  proposal: RegionProposal;
  mask: Uint8Array;
  width: number;
  height: number;
  samIoU: number;
  envelope: NormalizedBBox;
};

export type ImageEmbedding = {
  data: Float32Array;
  dims: number[];
  transform: SamTransform;
};
