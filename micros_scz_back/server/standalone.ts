import dotenv from 'dotenv';
import { createApiApp } from './app.ts';

dotenv.config();

const PORT = Number(process.env.PORT) || 4000;
const app = createApiApp();

app.get('/', (_req, res) => {
  res.json({
    service: 'micros-scz-api',
    status: 'running',
    health: '/api/health',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[API Standalone] Server listening on http://0.0.0.0:${PORT}`);
});
