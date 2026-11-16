import cors from 'cors';

export function parseAllowedOrigins(raw?: string, appUrl?: string): string[] {
  const entries = new Set<string>();

  if (raw) {
    for (const item of raw.split(',')) {
      const cleaned = item.trim().replace(/\/+$/, '');
      if (cleaned) entries.add(cleaned);
    }
  }

  if (appUrl) {
    const cleanedApp = appUrl.trim().replace(/\/+$/, '');
    if (cleanedApp && cleanedApp !== 'MY_APP_URL') {
      entries.add(cleanedApp);
    }
  }

  return Array.from(entries);
}

export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[]
): boolean {
  // Same-origin / server-to-server / curl requests without Origin header
  if (!origin) return true;

  const normalized = origin.trim().replace(/\/+$/, '');

  // Always allow explicit configured whitelist origins
  if (allowedOrigins.includes(normalized)) {
    return true;
  }

  // Allow local development origins cleanly
  if (
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalized) ||
    /^https:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalized)
  ) {
    return true;
  }

  // If no explicit ALLOWED_ORIGINS configured yet in preview mode, allow same-platform previews
  if (allowedOrigins.length === 0) {
    return true;
  }

  return false;
}

export function createCorsMiddleware() {
  const allowedOrigins = parseAllowedOrigins(
    process.env.ALLOWED_ORIGINS,
    process.env.APP_URL
  );

  return cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin, allowedOrigins)) {
        callback(null, true);
      } else {
        callback(new Error(`Origen CORS no autorizado: ${origin}`));
      }
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  });
}
