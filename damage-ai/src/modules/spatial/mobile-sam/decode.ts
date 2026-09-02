import * as ort from "onnxruntime-node";
import type { NormalizedBBox } from "@/types/m02.v1.js";
import {
  getDecoderInputNames,
  getDecoderSession,
  loadSamSessions,
} from "@/modules/spatial/mobile-sam/ort-session.js";
import {
  normalizedBoxToSamPixels,
} from "@/modules/spatial/mobile-sam/preprocess.js";
import type { ImageEmbedding, RegionProposal } from "@/modules/spatial/mobile-sam/types.js";

function maskFromLogits(
  logits: Float32Array,
  maskW: number,
  maskH: number,
  targetW: number,
  targetH: number,
): Uint8Array {
  const mask = new Uint8Array(targetW * targetH);
  if (maskW === targetW && maskH === targetH) {
    for (let i = 0; i < logits.length; i++) {
      mask[i] = logits[i] > 0 ? 1 : 0;
    }
    return mask;
  }

  const scaleX = maskW / targetW;
  const scaleY = maskH / targetH;
  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const sx = Math.min(maskW - 1, Math.floor(x * scaleX));
      const sy = Math.min(maskH - 1, Math.floor(y * scaleY));
      mask[y * targetW + x] = logits[sy * maskW + sx] > 0 ? 1 : 0;
    }
  }
  return mask;
}

export function envelopeFromMask(
  mask: Uint8Array,
  width: number,
  height: number,
): NormalizedBBox {
  let xMin = width;
  let yMin = height;
  let xMax = 0;
  let yMax = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      found = true;
      xMin = Math.min(xMin, x);
      yMin = Math.min(yMin, y);
      xMax = Math.max(xMax, x);
      yMax = Math.max(yMax, y);
    }
  }

  if (!found) {
    return { x_min: 0, y_min: 0, x_max: 0, y_max: 0 };
  }

  return {
    x_min: xMin / width,
    y_min: yMin / height,
    x_max: (xMax + 1) / width,
    y_max: (yMax + 1) / height,
  };
}

export function maskAreaNormalized(mask: Uint8Array): number {
  let count = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) count++;
  }
  return count / mask.length;
}

export async function decodeMask(
  embedding: ImageEmbedding,
  proposal: RegionProposal,
): Promise<{
  mask: Uint8Array;
  width: number;
  height: number;
  samIoU: number;
  envelope: NormalizedBBox;
}> {
  await loadSamSessions();
  const session = getDecoderSession();
  const inputNames = getDecoderInputNames();
  const transform = embedding.transform;
  const { originalWidth, originalHeight } = transform;

  const [x1, y1, x2, y2] = normalizedBoxToSamPixels(proposal.bbox, transform);

  const pointCoords = new Float32Array([x1, y1, x2, y2]);
  const pointLabels = new Float32Array([2, 3]);
  const maskInput = new Float32Array(1 * 1 * 256 * 256);
  const hasMaskInput = new Float32Array([0]);
  const origImSize = new Float32Array([originalHeight, originalWidth]);

  const feeds: Record<string, ort.Tensor> = {};
  const nameMap: Record<string, ort.Tensor> = {
    image_embeddings: new ort.Tensor("float32", embedding.data, embedding.dims),
    point_coords: new ort.Tensor("float32", pointCoords, [1, 2, 2]),
    point_labels: new ort.Tensor("float32", pointLabels, [1, 2]),
    mask_input: new ort.Tensor("float32", maskInput, [1, 1, 256, 256]),
    has_mask_input: new ort.Tensor("float32", hasMaskInput, [1]),
    orig_im_size: new ort.Tensor("float32", origImSize, [2]),
  };

  for (const name of inputNames) {
    const tensor = nameMap[name];
    if (tensor) feeds[name] = tensor;
  }

  const result = await session.run(feeds);
  const masksOut = result.masks ?? result[session.outputNames[0]];
  const iouOut = result.iou_predictions ?? result[session.outputNames[1]];

  if (!masksOut) throw new Error("MobileSAM decoder returned no masks");

  const maskDims = masksOut.dims as number[];
  const maskH = maskDims[maskDims.length - 2] ?? originalHeight;
  const maskW = maskDims[maskDims.length - 1] ?? originalWidth;
  const logits = masksOut.data as Float32Array;

  const mask = maskFromLogits(logits, maskW, maskH, originalWidth, originalHeight);
  const samIoU = iouOut ? (iouOut.data as Float32Array)[0] : proposal.score;
  const envelope = envelopeFromMask(mask, originalWidth, originalHeight);

  return {
    mask,
    width: originalWidth,
    height: originalHeight,
    samIoU,
    envelope,
  };
}
