import { config } from 'dotenv';

config();

const {
  PORT,
  MONGO_URI,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY,
  R2_SECRET_KEY,
  R2_BUCKET,
  R2_PUBLIC_URL,
  JWT_SECRET,
  WEBHOOK_SECRET,
  DAMAGE_AI_URL,
  CORS_ORIGIN,
  NODE_ENV,
} = process.env;

export const _config = {
  PORT: PORT || 3002,
  NODE_ENV: NODE_ENV ?? 'development',
  MONGO_URI,
  JWT_SECRET,
  WEBHOOK_SECRET,
  DAMAGE_AI_URL: DAMAGE_AI_URL || 'http://localhost:3000',
  CORS_ORIGIN: CORS_ORIGIN || 'http://localhost:5174',
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY,
  R2_SECRET_KEY,
  R2_BUCKET,
  R2_PUBLIC_URL,
};
