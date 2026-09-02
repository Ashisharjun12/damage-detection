import { ErrorRequestHandler } from "express";
import { logger } from "@/shared/logger.js";
import { ApiError } from "@/shared/errors/api-error.js";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  logger.error({ err, method: req.method, path: req.path, requestId: req.id });

  if (err instanceof ApiError && err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }

  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    errors: [],
  });
};
