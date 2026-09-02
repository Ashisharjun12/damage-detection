import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { envConfig } from "@/config/env.js";
import { ApiError } from "@/shared/errors/api-error.js";

export function requireJwt(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(ApiError.unauthorized("Missing Bearer token"));
    return;
  }
  const token = header.slice(7);
  if (!envConfig.JWT_SECRET) {
    next(ApiError.internalServerError("JWT_SECRET not configured"));
    return;
  }
  try {
    jwt.verify(token, envConfig.JWT_SECRET);
    next();
  } catch {
    next(ApiError.unauthorized("Invalid token"));
  }
}
