import { logger } from "../utils/logger.js";

export class AppError extends Error {
  constructor(message, status = 500, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message, details) {
    super(message, 400, details);
    this.name = "ValidationError";
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Unauthenticated") {
    super(message, 401);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403);
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not Found") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409);
    this.name = "ConflictError";
  }
}

export const errorHandler = (err, req, res, _next) => {
  const status = err.status || (err instanceof AppError ? err.status : 500);
  const isProd = process.env.NODE_ENV === "production";

  const logPayload = {
    message: err.message,
    status,
    stack: isProd ? undefined : err.stack,
    path: req.originalUrl,
    method: req.method,
    user: req.user?.role,
    ip: req.ip,
  };

  if (status >= 500) {
    logger.error("Unhandled error", logPayload);
  } else {
    logger.info("Handled error", logPayload);
  }

  const response = {
    success: false,
    error: err.message || "Internal Server Error",
    timestamp: new Date().toISOString(),
  };

  if (!isProd && err.details) {
    response.details = err.details;
  }

  if (!isProd && status === 500) {
    response.details = err.stack;
  }

  res.status(status).json(response);
};

