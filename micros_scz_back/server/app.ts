import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';
import { createCorsMiddleware } from './middleware/cors.ts';
import { healthRouter } from './routes/health.ts';
import { authRouter } from './routes/auth.ts';
import { communityRouter } from './routes/community.ts';
import { favoritesRouter } from './routes/favorites.ts';
import { feedbackRouter } from './routes/feedback.ts';
import { complaintRouter } from './routes/complaints.ts';
import { adminRouter } from './routes/admin.ts';
import { agentRouter } from './routes/agent.ts';

export function createApiApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  const trustedProxyHops = process.env.TRUST_PROXY_HOPS?.trim();
  if (trustedProxyHops) {
    const hopCount = Number(trustedProxyHops);
    if (
      !/^\d+$/.test(trustedProxyHops) ||
      !Number.isSafeInteger(hopCount) ||
      hopCount < 1
    ) {
      throw new Error('TRUST_PROXY_HOPS debe ser un entero positivo.');
    }
    app.set('trust proxy', hopCount);
  }
  app.use(createCorsMiddleware());
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api', communityRouter);
  app.use('/api/favorites', favoritesRouter);
  app.use('/api/feedback', feedbackRouter);
  app.use('/api/complaints', complaintRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/agent', agentRouter);

  // Clean JSON error handler (including CORS rejections)
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) {
      const message =
        err instanceof Error ? err.message : 'Error interno del servidor API';
      const status = message.includes('CORS') ? 403 : 500;
      res.status(status).json({ error: message });
      return;
    }
    next(err);
  });

  return app;
}
