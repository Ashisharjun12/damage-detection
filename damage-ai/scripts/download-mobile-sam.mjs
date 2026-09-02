/**
 * Download MobileSAM ONNX encoder + decoder into damage-ai/models/
 * Uses Heliosoph/sam-onnx standalone checkpoints (no external .onnx.data blobs).
 */
import { createWriteStream, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const modelsDir = join(__dirname, "..", "models");

const FILES = [
  {
    name: "mobile_sam_encoder.onnx",
    url: "https://huggingface.co/Heliosoph/sam-onnx/resolve/main/mobile_sam_image_encoder.onnx",
  },
  {
    name: "mobile_sam_decoder.onnx",
    url: "https://huggingface.co/Heliosoph/sam-onnx/resolve/main/sam_mask_decoder_single.onnx",
  },
];

async function download(url, dest) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  await pipeline(res.body, createWriteStream(dest));
}

mkdirSync(modelsDir, { recursive: true });

for (const file of FILES) {
  const dest = join(modelsDir, file.name);
  if (existsSync(dest)) {
    unlinkSync(dest);
  }
  console.log(`downloading ${file.name}...`);
  await download(file.url, dest);
  console.log(`saved ${dest}`);
}

// Remove legacy external-data blobs if present
for (const legacy of [
  "mobile_sam_encoder.onnx.data",
  "mobile_sam_decoder.onnx.data",
]) {
  const p = join(modelsDir, legacy);
  if (existsSync(p)) unlinkSync(p);
}

console.log("MobileSAM models ready in", modelsDir);
