import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  createCategorySchema,
  createFavoriteSchema,
  createFeedbackSchema,
  createPlaceSchema,
  createTransportComplaintSchema,
  isWithinSantaCruzBounds,
  slugifyCategory,
} from './db/validation.ts';
import { isOriginAllowed, parseAllowedOrigins } from './middleware/cors.ts';
import { createApiApp } from './app.ts';

test('Santa Cruz bounding box & validation schemas enforce valid coordinates and payloads', () => {
  assert.equal(isWithinSantaCruzBounds(-17.7833, -63.1821), true);
  assert.equal(isWithinSantaCruzBounds(0, 0), false);
  assert.equal(slugifyCategory('Centros de Salud (24h)'), 'centros-de-salud-24h');

  const validPlace = createPlaceSchema.safeParse({
    name: 'Parada UAGRM Norte',
    categoryName: 'Universidades',
    lat: -17.7758,
    lon: -63.1912,
    visibility: 'private',
  });
  assert.equal(validPlace.success, true);

  const outsidePlace = createPlaceSchema.safeParse({
    name: 'Lugar Fuera de SCZ',
    categoryName: 'Universidades',
    lat: -16.5,
    lon: -68.15,
    visibility: 'private',
  });
  assert.equal(outsidePlace.success, false);

  assert.equal(
    createCategorySchema.safeParse({ name: 'Coworkings' }).success,
    true
  );
  assert.equal(
    createFavoriteSchema.safeParse({
      kind: 'line',
      title: 'Línea 72 Ida',
      routeId: 'Línea 72-1',
    }).success,
    true
  );
  assert.equal(
    createFavoriteSchema.safeParse({
      kind: 'trip_ab',
      title: 'Casa → UAGRM',
      originLat: -17.78,
      originLon: -63.18,
      destLat: -17.775,
      destLon: -63.191,
    }).success,
    true
  );
  assert.equal(
    createFeedbackSchema.safeParse({
      targetType: 'line',
      targetRef: 'Línea 72',
      rating: 5,
      category: 'sugerencia',
      comment: 'Excelente precisión en el 2do anillo.',
    }).success,
    true
  );

  assert.equal(
    createTransportComplaintSchema.safeParse({
      lineLabel: 'Línea 72',
      category: 'cobro_excesivo',
      occurredAt: new Date().toISOString(),
      occurredTimezone: 'America/La_Paz',
      fareAmount: 3,
      description: 'Me cobraron una tarifa mayor a la establecida.',
    }).success,
    true
  );
});

test('CORS whitelist enforces ALLOWED_ORIGINS while allowing localhost dev', () => {
  const allowed = parseAllowedOrigins(
    'https://micros-scz.pages.dev, https://micros.scz.bo/',
    'https://preview.example.com'
  );
  assert.deepEqual(allowed, [
    'https://micros-scz.pages.dev',
    'https://micros.scz.bo',
    'https://preview.example.com',
  ]);

  assert.equal(isOriginAllowed('https://micros-scz.pages.dev', allowed), true);
  assert.equal(isOriginAllowed('http://localhost:5173', allowed), true);
  assert.equal(isOriginAllowed('https://evil.example.org', allowed), false);
});

test('Decoupled API server boots cleanly without DATABASE_URL and enforces auth', async () => {
  const originalDbUrl = process.env.DATABASE_URL;
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
  delete process.env.DATABASE_URL;
  process.env.ALLOWED_ORIGINS = 'https://trusted.example.com';

  const app = createApiApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const addr = server.address() as { port: number };
    const base = `http://127.0.0.1:${addr.port}`;

    const healthRes = await fetch(`${base}/api/health`);
    assert.equal(healthRes.status, 200);
    const healthJson = (await healthRes.json()) as {
      ok: boolean;
      database: { configured: boolean };
    };
    assert.equal(healthJson.ok, true);
    assert.equal(healthJson.database.configured, false);

    const bootstrapRes = await fetch(`${base}/api/community/bootstrap`);
    assert.equal(bootstrapRes.status, 200);
    const bootstrapJson = (await bootstrapRes.json()) as {
      dbConfigured: boolean;
      places: unknown[];
    };
    assert.equal(bootstrapJson.dbConfigured, false);
    assert.deepEqual(bootstrapJson.places, []);

    const anonymousComplaintRes = await fetch(`${base}/api/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lineLabel: 'Línea 72',
        category: 'trato_irrespetuoso',
        occurredAt: new Date().toISOString(),
        occurredTimezone: 'America/La_Paz',
        description: 'El chofer trató mal a un pasajero.',
      }),
    });
    assert.equal(
      anonymousComplaintRes.status,
      503,
      'anonymous complaint submission reaches storage availability instead of requiring a session'
    );

    const privateQueueRes = await fetch(`${base}/api/admin/moderation`);
    assert.equal(privateQueueRes.status, 401);

    const publicComplaintReadRes = await fetch(`${base}/api/complaints`);
    assert.equal(publicComplaintReadRes.status, 404);

    const unauthPlaceRes = await fetch(`${base}/api/places`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test',
        categoryName: 'Universidades',
        lat: -17.78,
        lon: -63.18,
      }),
    });
    assert.equal(unauthPlaceRes.status, 401);

    const cookieWithoutOriginRes = await fetch(`${base}/api/places`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'scz_session=invalid-session',
      },
      body: JSON.stringify({
        name: 'Test',
        categoryName: 'Universidades',
        lat: -17.78,
        lon: -63.18,
      }),
    });
    assert.equal(cookieWithoutOriginRes.status, 403);

    const trustedCookieOriginRes = await fetch(`${base}/api/places`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'scz_session=invalid-session',
        Origin: 'https://trusted.example.com',
      },
      body: JSON.stringify({
        name: 'Test',
        categoryName: 'Universidades',
        lat: -17.78,
        lon: -63.18,
      }),
    });
    assert.equal(trustedCookieOriginRes.status, 401);

    const logoutRes = await fetch(`${base}/api/auth/logout`, {
      method: 'POST',
    });
    assert.equal(logoutRes.status, 200);
    assert.match(logoutRes.headers.get('set-cookie') || '', /scz_session=;/);
    assert.match(logoutRes.headers.get('set-cookie') || '', /HttpOnly/i);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (originalDbUrl !== undefined) {
      process.env.DATABASE_URL = originalDbUrl;
    }
    if (originalAllowedOrigins !== undefined) {
      process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
    } else {
      delete process.env.ALLOWED_ORIGINS;
    }
  }
});
