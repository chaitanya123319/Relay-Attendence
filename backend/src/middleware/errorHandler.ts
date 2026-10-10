import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { isTest } from '../config/env';
import { AppError } from '../lib/errors';

/** 404 for unknown routes — keeps the JSON error envelope consistent. */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
}

/** Central error serializer: { error: { code, message, details? } } */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
  }

  if (err instanceof multer.MulterError) {
    const isSize = err.code === 'LIMIT_FILE_SIZE';
    return res.status(isSize ? 413 : 400).json({
      error: { code: isSize ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR', message: err.message },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return res
      .status(409)
      .json({ error: { code: 'DUPLICATE', message: 'Resource already exists' } });
  }

  if (!isTest && err instanceof Error && err.stack) console.error(err.stack);
  console.error('[error]', err instanceof Error ? err.message : err);
  return res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
}
