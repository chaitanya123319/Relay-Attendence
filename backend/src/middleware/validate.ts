import { NextFunction, Request, Response } from 'express';
import { AnyZodObject, ZodTypeAny, z } from 'zod';

/**
 * Validates and *replaces* req.body / req.params with the parsed (coerced,
 * defaulted) values. Throws ZodError → handled centrally as 400 VALIDATION_ERROR.
 */
export function validate(schema: AnyZodObject, source: 'body' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) return next(result.error);
    if (source === 'body') req.body = result.data as Record<string, unknown>;
    else req.params = result.data as Record<string, string>;
    next();
  };
}

/** Parse-or-throw helper for query strings and other ad-hoc payloads. */
export function parseOrThrow<T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) throw result.error;
  return result.data;
}
