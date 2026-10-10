import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { globalLimiter } from './middleware/rateLimit';
import { authRouter } from './routes/auth.routes';
import { attendanceRouter } from './routes/attendance.routes';
import { leaveRouter } from './routes/leave.routes';
import { notificationsRouter } from './routes/notifications.routes';
import { reportsRouter } from './routes/reports.routes';
import { sitesRouter } from './routes/sites.routes';
import { uploadsRouter } from './routes/uploads.routes';
import { usersRouter } from './routes/users.routes';

/**
 * Express app factory. Kept separate from index.ts so tests can mount the
 * exact production middleware stack via supertest without opening a port.
 */
export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin:
        env.CORS_ORIGIN === '*'
          ? true
          : env.CORS_ORIGIN.split(',').map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(globalLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', name: 'relay-attendance-api', time: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/attendance', attendanceRouter);
  app.use('/api/leave', leaveRouter);
  app.use('/api/uploads', uploadsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/sites', sitesRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/reports', reportsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
