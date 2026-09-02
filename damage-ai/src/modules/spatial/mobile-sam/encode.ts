import * as ort from "onnxruntime-node";
import {
  getEncoderInputName,
  getEncoderSession,
  loadSamSessions,
} from "@/modules/spatial/mobile-sam/ort-session.js";
import { preprocessForSam } from "@/modules/spatial/mobile-sam/preprocess.js";
import type { ImageEmbedding } from "@/modules/spatial/mobile-sam/types.js";

function toChw(hwc: Float32Array): Float32Array {
  const chw = new Float32Array(3 * 1024 * 1024);
  for (let y = 0; y < 1024; y++) {
    for (let x = 0; x < 1024; x++) {
      const hwcIdx = (y * 1024 + x) * 3;
      const dst = y * 1024 + x;
      chw[0 * 1024 * 1024 + dst] = hwc[hwcIdx];
      chw[1 * 1024 * 1024 + dst] = hwc[hwcIdx + 1];
      chw[2 * 1024 * 1024 + dst] = hwc[hwcIdx + 2];
    }
  }
  return chw;
}

export async function encodeImage(imageBuffer: Buffer): Promise<ImageEmbedding> {
  await loadSamSessions();
  const { tensorData, transform } = await preprocessForSam(imageBuffer);
  const session = getEncoderSession();
  const inputName = getEncoderInputName();

  let shape: number[];
  let tensorBuffer: Float32Array = tensorData;

  if (inputName === "input_image") {
    shape = [1024, 1024, 3];
  } else if (inputName === "input") {
    shape = [1, 3, 1024, 1024];
    tensorBuffer = toChw(tensorData);
  } else {
    shape = [3, 1024, 1024];
    tensorBuffer = toChw(tensorData);
  }

  const inputTensor = new ort.Tensor("float32", tensorBuffer, shape);
  const result = await session.run({ [inputName]: inputTensor });
  const outputName = session.outputNames[0];
  const embedding = result[outputName];
  if (!embedding) throw new Error("MobileSAM encoder returned no embedding");

  return {
    data: embedding.data as Float32Array,
    dims: embedding.dims as number[],
    transform,
  };
}
