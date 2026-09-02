import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { envConfig } from "@/config/env.js";

let client: S3Client | null = null;

export function assertR2Configured(): void {
  const missing = [
    !envConfig.R2_ACCOUNT_ID && "R2_ACCOUNT_ID",
    !envConfig.R2_ACCESS_KEY && "R2_ACCESS_KEY",
    !envConfig.R2_SECRET_KEY && "R2_SECRET_KEY",
    !envConfig.R2_BUCKET && "R2_BUCKET",
    !envConfig.R2_PUBLIC_URL && "R2_PUBLIC_URL",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(
      `R2 not configured for annotated uploads. Missing: ${missing.join(", ")}`,
    );
  }
}

function getClient(): S3Client {
  assertR2Configured();
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${envConfig.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: envConfig.R2_ACCESS_KEY,
        secretAccessKey: envConfig.R2_SECRET_KEY,
      },
    });
  }
  return client;
}

export async function fetchImageBytes(url: string): Promise<{
  buffer: Buffer;
  mimeType: string;
}> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch image: ${res.status}`);
  }
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  const arrayBuffer = await res.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), mimeType };
}

export async function uploadAnnotatedImage(
  key: string,
  body: Buffer,
  contentType = "image/jpeg",
): Promise<string> {
  const s3 = getClient();
  await s3.send(
    new PutObjectCommand({
      Bucket: envConfig.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  const base = envConfig.R2_PUBLIC_URL.replace(/\/$/, "");
  return `${base}/${key}`;
}

export function buildAnnotatedKey(surveyId: string, imageId: string): string {
  return `surveys/${surveyId}/annotated/${imageId}.jpg`;
}
