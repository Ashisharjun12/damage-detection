import sharp from "sharp";
import { encodeImage } from "@/modules/spatial/mobile-sam/encode.js";
import { decodeMask } from "@/modules/spatial/mobile-sam/decode.js";
import { proposeRegions } from "@/modules/spatial/region-proposals.js";

const url = "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800";
const res = await fetch(url);
const buf = Buffer.from(await res.arrayBuffer());
const meta = await sharp(buf).metadata();
const width = meta.width ?? 0;
const height = meta.height ?? 0;

console.log("image", width, height);
const embedding = await encodeImage(buf);
console.log("embedding dims", embedding.dims);

const proposals = await proposeRegions(buf, width, height);
console.log("proposals", proposals.length);

if (proposals[0]) {
  const decoded = await decodeMask(embedding, proposals[0]);
  let pixels = 0;
  for (let i = 0; i < decoded.mask.length; i++) if (decoded.mask[i]) pixels++;
  console.log(
    "mask pixels",
    pixels,
    "samIoU",
    decoded.samIoU,
    "envelope",
    decoded.envelope,
  );
}

console.log("SAM smoke test OK");
