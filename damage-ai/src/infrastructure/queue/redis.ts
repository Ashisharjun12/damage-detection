import { Redis } from "ioredis";
import { envConfig } from "@/config/env.js";

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (!envConfig.REDIS_URL) return null;
  if (!redis) {
    redis = new Redis(envConfig.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return redis;
}

const IDEMPOTENCY_PREFIX = "m02:idempotency:";
const IDEMPOTENCY_TTL_SEC = 86400;

export async function getIdempotentResult<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;
  const raw = await r.get(`${IDEMPOTENCY_PREFIX}${key}`);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export async function setIdempotentResult(
  key: string,
  value: unknown,
): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.set(
    `${IDEMPOTENCY_PREFIX}${key}`,
    JSON.stringify(value),
    "EX",
    IDEMPOTENCY_TTL_SEC,
  );
}
