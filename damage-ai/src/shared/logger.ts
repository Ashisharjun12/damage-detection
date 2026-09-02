import pino from "pino";
import { envConfig } from "@/config/env.js";

export const logger = pino({
  level: envConfig.LOG_LEVEL,
  transport:
    envConfig.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});
