import { envConfig } from "@/config/env.js";
import { sleep } from "@/infrastructure/gemini/client.js";
import { logger } from "@/shared/logger.js";

export type GeminiErrorType =
  | "missing_key"
  | "auth"
  | "rate_limit"
  | "timeout"
  | "empty_response"
  | "json_parse"
  | "bad_request"
  | "unknown";

export const STRICT_JSON_SUFFIX =
  " Return ONLY valid JSON matching the schema. No markdown, no prose, no code fences.";

export class GeminiCallError extends Error {
  readonly code = "GEMINI_CALL_FAILED" as const;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "GeminiCallError";
    if (cause instanceof Error) this.cause = cause;
  }
}

export type RetryAttemptContext = {
  attempt: number;
  strictJson: boolean;
};

function jitter(ms: number): number {
  return ms + Math.floor(Math.random() * 250);
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function errStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const e = err as Record<string, unknown>;
  if (typeof e.status === "number") return e.status;
  if (typeof e.code === "number") return e.code;
  return undefined;
}

function retryAfterMs(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const headers = (err as { headers?: Record<string, string> }).headers;
  const raw = headers?.["retry-after"] ?? headers?.["Retry-After"];
  if (!raw) return undefined;
  const sec = Number(raw);
  return Number.isFinite(sec) ? sec * 1000 : undefined;
}

export function isRateLimitError(err: unknown): boolean {
  const status = errStatus(err);
  if (status === 429) return true;
  const msg = errMessage(err).toLowerCase();
  return msg.includes("429") || msg.includes("rate limit") || msg.includes("quota");
}

export function isTimeoutError(err: unknown): boolean {
  const msg = errMessage(err).toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("etimedout") ||
    msg.includes("econnaborted")
  );
}

export function isEmptyResponseError(err: unknown): boolean {
  return errMessage(err).includes("Empty Gemini response");
}

export function isJsonParseError(err: unknown): boolean {
  if (err instanceof SyntaxError) return true;
  const msg = errMessage(err).toLowerCase();
  return (
    msg.includes("json") ||
    msg.includes("zod") ||
    msg.includes("parse") ||
    msg.includes("unexpected token")
  );
}

export function isRetryableGeminiError(err: unknown): boolean {
  return (
    isRateLimitError(err) ||
    isTimeoutError(err) ||
    isEmptyResponseError(err) ||
    isJsonParseError(err)
  );
}

export function classifyGeminiError(err: unknown): GeminiErrorType {
  if (!envConfig.AI_API_KEY) return "missing_key";
  const status = errStatus(err);
  if (status === 401 || status === 403) return "auth";
  if (isRateLimitError(err)) return "rate_limit";
  if (isTimeoutError(err)) return "timeout";
  if (isEmptyResponseError(err)) return "empty_response";
  if (isJsonParseError(err)) return "json_parse";
  if (status === 400) return "bad_request";
  return "unknown";
}

function backoffMs(attempt: number, err: unknown): number {
  if (isRateLimitError(err)) {
    return retryAfterMs(err) ?? jitter([5000, 15000, 45000][attempt] ?? 45000);
  }
  const base = envConfig.GEMINI_RETRY_BASE_MS;
  return jitter(base * 2 ** attempt);
}

export async function callWithGeminiRetry<T>(
  fn: (ctx: RetryAttemptContext) => Promise<T>,
): Promise<T> {
  const maxRetries = envConfig.GEMINI_MAX_RETRIES;
  let lastErr: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn({ attempt, strictJson: attempt > 0 });
    } catch (err) {
      lastErr = err;
      logger.warn(
        {
          err,
          attempt: attempt + 1,
          maxRetries,
          errorType: classifyGeminiError(err),
          status: errStatus(err),
          message: errMessage(err),
          retryable: isRetryableGeminiError(err),
        },
        "gemini retry",
      );
      if (attempt >= maxRetries - 1 || !isRetryableGeminiError(err)) break;
      await sleep(backoffMs(attempt, err));
    }
  }

  logger.error(
    {
      errorType: classifyGeminiError(lastErr),
      status: errStatus(lastErr),
      message: errMessage(lastErr),
      attempts: maxRetries,
      apiKeyConfigured: Boolean(envConfig.AI_API_KEY),
      model: envConfig.AI_MODEL,
    },
    "gemini call failed",
  );

  throw new GeminiCallError(
    lastErr instanceof Error ? lastErr.message : "Gemini call failed",
    lastErr,
  );
}

export async function withGeminiTimeout<T>(
  promise: Promise<T>,
  ms = envConfig.GEMINI_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("GEMINI_TIMEOUT")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
