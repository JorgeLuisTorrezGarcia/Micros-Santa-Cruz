import { Router } from 'express';
import { checkDatabaseHealth } from '../db/index.ts';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  const db = await checkDatabaseHealth();
  const googleAuthConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() ||
      process.env.VITE_GOOGLE_CLIENT_ID?.trim()
  );

  res.json({
    ok: true,
    service: 'micros-scz-api',
    timestamp: new Date().toISOString(),
    database: db,
    googleAuthConfigured,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
  });
});
