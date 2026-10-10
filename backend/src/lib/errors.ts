import { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Application error with an HTTP status and a machine-readable code.
 * All thrown AppErrors are serialized by the error handler into the
 * standard envelope: { error: { code, message, details? } }
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (code: string, message: string, details?: unknown) =>
  new AppError(400, code, message, details);
export const unauthorized = (code: string, message: string) => new AppError(401, code, message);
export const forbidden = (code: string, message: string) => new AppError(403, code, message);
export const notFound = (code: string, message: string) => new AppError(404, code, message);
export const conflict = (code: string, message: string, details?: unknown) =>
  new AppError(409, code, message, details);
export const unprocessable = (code: string, message: string, details?: unknown) =>
  new AppError(422, code, message, details);

/** Wraps async route handlers so rejected promises reach the error middleware. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
