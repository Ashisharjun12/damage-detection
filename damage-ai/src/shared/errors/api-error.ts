export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public errors: unknown[];

  constructor(
    statusCode: number,
    message: string,
    isOperational = true,
    errors: unknown[] = [],
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static notFound(msg = "not Found") {
    return new ApiError(404, msg);
  }
  static forbidden(msg = "forbidden") {
    return new ApiError(403, msg);
  }
  static unauthorized(msg = "unauthorized") {
    return new ApiError(401, msg);
  }
  static conflict(msg = "resource conflict") {
    return new ApiError(409, msg);
  }
  static badRequest(msg = "bad Request", error?: unknown[]) {
    return new ApiError(400, msg, true, error);
  }
  static internalServerError(msg = "internal Server Error", error?: unknown[]) {
    return new ApiError(500, msg, true, error);
  }
}
