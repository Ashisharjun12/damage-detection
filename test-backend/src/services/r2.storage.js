import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { _config } from '../config/config.js';

const VALID_PURPOSES = ['survey', 'annotated', 'other'];

let s3Client;

function assertR2Configured() {
  if (
    !_config.R2_ACCOUNT_ID ||
    !_config.R2_ACCESS_KEY ||
    !_config.R2_SECRET_KEY ||
    !_config.R2_BUCKET ||
    !_config.R2_PUBLIC_URL
  ) {
    throw new Error('R2 storage is not configured. Check R2_* env vars.');
  }
}

export function getR2Client() {
  assertR2Configured();
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${_config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: _config.R2_ACCESS_KEY,
        secretAccessKey: _config.R2_SECRET_KEY,
      },
    });
  }
  return s3Client;
}

function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function normalizePurpose(purpose) {
  return VALID_PURPOSES.includes(purpose) ? purpose : 'other';
}

export function buildPublicUrl(key) {
  const base = _config.R2_PUBLIC_URL.replace(/\/$/, '');
  return `${base}/${key}`;
}

export function buildSurveyObjectKey(surveyId, imageId) {
  return `surveys/${surveyId}/original/${imageId}.jpg`;
}

export function buildObjectKeyForPurpose(purpose, filename, surveyId) {
  const safeName = sanitizeFilename(filename);
  const normalized = normalizePurpose(purpose);

  if (normalized === 'survey' && surveyId) {
    return `surveys/${surveyId}/original/${randomUUID()}-${safeName}`;
  }
  if (normalized === 'annotated' && surveyId) {
    return `surveys/${surveyId}/annotated/${randomUUID()}-${safeName}`;
  }
  return `uploads/${normalized}/${randomUUID()}-${safeName}`;
}

export async function uploadObjectBuffer(
  buffer,
  filename,
  contentType,
  purpose = 'other',
  surveyId,
) {
  const publicId = buildObjectKeyForPurpose(purpose, filename, surveyId);
  const command = new PutObjectCommand({
    Bucket: _config.R2_BUCKET,
    Key: publicId,
    Body: buffer,
    ContentType: contentType,
  });
  await getR2Client().send(command);
  return {
    publicUrl: buildPublicUrl(publicId),
    publicId,
    key: publicId,
    size: buffer.length,
  };
}

export async function createPresignedUploadUrl(
  filename,
  contentType,
  purpose = 'other',
  surveyId,
) {
  const publicId = buildObjectKeyForPurpose(purpose, filename, surveyId);

  const command = new PutObjectCommand({
    Bucket: _config.R2_BUCKET,
    Key: publicId,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(getR2Client(), command, { expiresIn: 600 });
  const publicUrl = buildPublicUrl(publicId);

  return { uploadUrl, publicUrl, publicId, key: publicId };
}

export async function getPresignedPutUrl(key, expiresIn = 3600) {
  const command = new PutObjectCommand({
    Bucket: _config.R2_BUCKET,
    Key: key,
  });
  return getSignedUrl(getR2Client(), command, { expiresIn });
}

export async function deleteR2Object(publicId) {
  if (!publicId) return;
  const command = new DeleteObjectCommand({
    Bucket: _config.R2_BUCKET,
    Key: publicId,
  });
  await getR2Client().send(command);
}

export { VALID_PURPOSES };
