import * as ort from "onnxruntime-node";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { envConfig } from "@/config/env.js";
import { logger } from "@/shared/logger.js";

let encoderSession: ort.InferenceSession | null = null;
let decoderSession: ort.InferenceSession | null = null;
let encoderInputName = "input";
let decoderInputNames: Record<string, string> = {};

export function modelsAvailable(): boolean {
  const enc = resolve(envConfig.SEG_ENCODER_PATH);
  const dec = resolve(envConfig.SEG_DECODER_PATH);
  return existsSync(enc) && existsSync(dec);
}

export async function loadSamSessions(): Promise<void> {
  if (encoderSession && decoderSession) return;
  if (!modelsAvailable()) {
    throw new Error("MobileSAM ONNX models not found — run scripts/download-mobile-sam.mjs");
  }

  const encPath = resolve(envConfig.SEG_ENCODER_PATH);
  const decPath = resolve(envConfig.SEG_DECODER_PATH);

  encoderSession = await ort.InferenceSession.create(encPath, {
    executionProviders: ["cpu"],
  });
  decoderSession = await ort.InferenceSession.create(decPath, {
    executionProviders: ["cpu"],
  });

  encoderInputName = encoderSession.inputNames[0] ?? "input";

  for (const name of decoderSession.inputNames) {
    decoderInputNames[name] = name;
  }

  logger.info(
    {
      encoderInputs: encoderSession.inputNames,
      decoderInputs: decoderSession.inputNames,
      decoderOutputs: decoderSession.outputNames,
    },
    "MobileSAM ONNX sessions loaded",
  );
}

export function getEncoderSession(): ort.InferenceSession {
  if (!encoderSession) throw new Error("MobileSAM encoder not loaded");
  return encoderSession;
}

export function getDecoderSession(): ort.InferenceSession {
  if (!decoderSession) throw new Error("MobileSAM decoder not loaded");
  return decoderSession;
}

export function getEncoderInputName(): string {
  return encoderInputName;
}

export function getDecoderInputNames(): string[] {
  return Object.keys(decoderInputNames);
}
