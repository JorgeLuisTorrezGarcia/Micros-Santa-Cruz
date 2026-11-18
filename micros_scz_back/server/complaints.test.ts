import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { createTransportComplaintSchema } from './db/validation.ts';
import { createComplaintRateLimiter } from './routes/complaints.ts';

function validComplaintPayload() {
  return {
    lineLabel: 'Línea 72',
    lineId: 'Línea 72-1',
    category: 'negativa_servicio',
    direction: 'ida',
    occurredAt: new Date().toISOString(),
    occurredTimezone: 'America/La_Paz',
    latitude: -17.7833,
    longitude: -63.1821,
    locationAccuracyMeters: 20,
    stopReference: '2.º anillo y Av. Brasil',
    description: 'El micro no se detuvo bajo la lluvia.',
  };
}

test('transport complaint schema accepts anonymous structured reports', () => {
  const parsed = createTransportComplaintSchema.safeParse(validComplaintPayload());
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.direction, 'ida');
    assert.equal(parsed.data.fareAmount, undefined);
  }
});

test('transport complaint schema validates coordinate pairs and local context', () => {
  const partialLocation = createTransportComplaintSchema.safeParse({
    ...validComplaintPayload(),
    longitude: null,
  });
  assert.equal(partialLocation.success, false);

  const outsideSantaCruz = createTransportComplaintSchema.safeParse({
    ...validComplaintPayload(),
    latitude: 0,
    longitude: 0,
  });
  assert.equal(outsideSantaCruz.success, false);

  const fareForWrongCategory = createTransportComplaintSchema.safeParse({
    ...validComplaintPayload(),
    fareAmount: 3,
  });
  assert.equal(fareForWrongCategory.success, false);

  const invalidTimeZone = createTransportComplaintSchema.safeParse({
    ...validComplaintPayload(),
    occurredTimezone: 'Invalid/Timezone',
  });
  assert.equal(invalidTimeZone.success, false);

  const futureIncident = createTransportComplaintSchema.safeParse({
    ...validComplaintPayload(),
    occurredAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  assert.equal(futureIncident.success, false);
});

test('complaint rate limiter allows five reports and rejects the sixth per window', async () => {
  const app = express();
  app.post(
    '/',
    createComplaintRateLimiter(5, 60_000),
    (_req, res) => res.status(201).json({ accepted: true })
  );
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address() as { port: number };
    const url = `http://127.0.0.1:${address.port}/`;
    const statuses: number[] = [];

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      statuses.push(response.status);
    }

    assert.deepEqual(statuses, [201, 201, 201, 201, 201, 429]);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
