import sharp from "sharp";
import type { NormalizedBBox } from "@/types/m02.v1.js";
import { judgeRegionWithGemini } from "@/infrastructure/gemini/grounded-provider.js";
import { normalizePartName } from "@/modules/normalization/normalize-damage.js";
import { normalizeLocationOnPart } from "@/modules/spatial/location.js";
import { recommendForSeverity } from "@/modules/scoring/repair-replace-rules.js";
import type { SegmentationMask } from "@/modules/spatial/mobile-sam/types.js";
import { resizeForRegionJudge } from "@/modules/inspection/detect-view.js";
import type { GeminiUsage } from "@/infrastructure/gemini/usage.js";
import type { DamageInstance, ViewAngle } from "@/types/m02.v1.js";

export type MaskAnnotatedDamage = DamageInstance & {
  mask: Uint8Array;
  maskWidth: number;
  maskHeight: number;
};

function expandBBox(bbox: NormalizedBBox, padding = 0.12): NormalizedBBox {
  const w = bbox.x_max - bbox.x_min;
  const h = bbox.y_max - bbox.y_min;
  return {
    x_min: Math.max(0, bbox.x_min - w * padding),
    y_min: Math.max(0, bbox.y_min - h * padding),
    x_max: Math.min(1, bbox.x_max + w * padding),
    y_max: Math.min(1, bbox.y_max + h * padding),
  };
}

async function buildRegionCropWithMaskOverlay(
  imageBuffer: Buffer,
  fullWidth: number,
  fullHeight: number,
  mask: Uint8Array,
  envelope: NormalizedBBox,
): Promise<Buffer> {
  const cropBox = expandBBox(envelope);
  const left = Math.max(0, Math.floor(cropBox.x_min * fullWidth));
  const top = Math.max(0, Math.floor(cropBox.y_min * fullHeight));
  const right = Math.min(fullWidth, Math.ceil(cropBox.x_max * fullWidth));
  const bottom = Math.min(fullHeight, Math.ceil(cropBox.y_max * fullHeight));
  const cropW = Math.max(1, right - left);
  const cropH = Math.max(1, bottom - top);

  const baseCrop = await sharp(imageBuffer)
    .extract({ left, top, width: cropW, height: cropH })
    .toBuffer();

  const overlay = Buffer.alloc(cropW * cropH * 4);
  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const fullX = left + x;
      const fullY = top + y;
      const maskIdx = fullY * fullWidth + fullX;
      const outIdx = (y * cropW + x) * 4;
      if (mask[maskIdx]) {
        overlay[outIdx] = 255;
        overlay[outIdx + 1] = 255;
        overlay[outIdx + 2] = 0;
        overlay[outIdx + 3] = 140;
      }
    }
  }

  return sharp(baseCrop)
    .composite([
      {
        input: overlay,
        raw: { width: cropW, height: cropH, channels: 4 },
        blend: "over",
      },
    ])
    .jpeg({ quality: 88 })
    .toBuffer();
}

export type JudgeRegionResult = {
  damage: MaskAnnotatedDamage | null;
  usage: GeminiUsage;
};

export async function judgeRegion(
  imageBuffer: Buffer,
  fullWidth: number,
  fullHeight: number,
  segMask: SegmentationMask,
  imageId: string,
  instanceIndex: number,
  viewAngle: ViewAngle,
  declaredView?: string,
): Promise<JudgeRegionResult> {
  const cropBytes = await buildRegionCropWithMaskOverlay(
    imageBuffer,
    fullWidth,
    fullHeight,
    segMask.mask,
    segMask.envelope,
  );
  const geminiBytes = await resizeForRegionJudge(cropBytes);

  const { data: gemini, usage } = await judgeRegionWithGemini({
    imageBytes: geminiBytes,
    mimeType: "image/jpeg",
    declaredView,
  });

  if (!gemini.is_damage) return { damage: null, usage };

  const partName = normalizePartName(gemini.part_name ?? "");
  if (!partName || !gemini.damage_type || !gemini.severity) {
    return { damage: null, usage };
  }

  const confidence = gemini.confidence ?? segMask.samIoU;

  return {
    usage,
    damage: {
      instance_id: `${imageId}_D${String(instanceIndex).padStart(3, "0")}`,
      image_id: imageId,
      part_name: partName,
      damage_type: gemini.damage_type,
      severity: gemini.severity,
      recommendation: recommendForSeverity(gemini.severity, partName),
      bounding_box: segMask.envelope,
      location_on_part: gemini.location_on_part
        ? normalizeLocationOnPart(gemini.location_on_part)
        : undefined,
      side: gemini.side,
      confidence,
      visibility: gemini.visibility ?? "FULL",
      view_angle: viewAngle,
      mask: segMask.mask,
      maskWidth: segMask.width,
      maskHeight: segMask.height,
    },
  };
}
