import sharp from "sharp";
import { envConfig } from "@/config/env.js";
import { resizeForGemini } from "@/modules/ingest/resize-image.js";
import { detectViewWithGemini } from "@/infrastructure/gemini/view-provider.js";
import { classifyViewFromDetection } from "@/modules/inspection/classify-view.js";
import type { GeminiUsage } from "@/infrastructure/gemini/usage.js";
import type { ViewAngle } from "@/types/m02.v1.js";

export type ViewDetectionResult = {
  view_angle: ViewAngle;
  view_confidence?: number;
  view_conflict?: boolean;
  image_quality?: string;
  usage: GeminiUsage;
};

export async function detectView(
  imageBytes: Buffer,
  mimeType: string,
  declaredView?: string,
): Promise<ViewDetectionResult> {
  const geminiBytes = await resizeForGemini(imageBytes);
  const { data: gemini, usage } = await detectViewWithGemini({
    imageBytes: geminiBytes,
    mimeType: "image/jpeg",
    declaredView,
  });

  const viewInfo = classifyViewFromDetection(
    gemini.view_angle,
    gemini.view_confidence,
    declaredView,
  );

  return {
    view_angle: viewInfo.view_angle,
    view_confidence: viewInfo.view_confidence,
    view_conflict: viewInfo.view_conflict,
    image_quality: gemini.image_quality,
    usage,
  };
}

/** Smaller resize for per-region Gemini judge crops. */
export async function resizeForRegionJudge(buffer: Buffer): Promise<Buffer> {
  const maxEdge = envConfig.GEMINI_REGION_MAX_EDGE;
  const meta = await sharp(buffer).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const longEdge = Math.max(w, h);

  if (longEdge <= maxEdge) return buffer;

  return sharp(buffer)
    .resize({
      width: w >= h ? maxEdge : undefined,
      height: h > w ? maxEdge : undefined,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();
}
