import { pinoHttp } from "pino-http";
import type { IncomingMessage } from "node:http";
import { logger } from "@/shared/logger.js";

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req: IncomingMessage) =>
    (req.headers["x-request-id"] as string) ?? crypto.randomUUID(),
});
