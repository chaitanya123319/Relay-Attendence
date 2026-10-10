import { Request, Router } from 'express';
import { asyncHandler } from '../lib/errors';
import { authenticate } from '../middleware/auth';
import { loginLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { googleLoginSchema, loginSchema, logoutSchema, refreshSchema } from '../schemas/auth.schema';
import * as authService from '../services/auth.service';

export const authRouter = Router();

const ipOf = (req: Request): string | undefined =>
  req.ip || req.socket.remoteAddress || undefined;

authRouter.post(
  '/login',
  loginLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { identifier, password } = req.body as { identifier: string; password: string };
    const result = await authService.login(identifier, password, ipOf(req));
    res.json(result);
  }),
);

authRouter.post(
  '/google',
  loginLimiter,
  validate(googleLoginSchema),
  asyncHandler(async (req, res) => {
    const { idToken } = req.body as { idToken: string };
    res.json(await authService.loginWithGoogle(idToken, ipOf(req)));
  }),
);

authRouter.post(
  '/refresh',
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body as { refreshToken: string };
    res.json(await authService.refresh(refreshToken, ipOf(req)));
  }),
);

authRouter.post(
  '/logout',
  authenticate,
  validate(logoutSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body as { refreshToken?: string };
    res.json(await authService.logout(refreshToken));
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(await authService.me(req.user!.id));
  }),
);
