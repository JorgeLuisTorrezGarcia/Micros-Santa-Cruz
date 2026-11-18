import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getDb } from '../db/index.ts';
import { transportComplaints } from '../db/schema.ts';
import { createTransportComplaintSchema } from '../db/validation.ts';

export const complaintRouter = Router();

export function createComplaintRateLimiter(
  limit = 5,
  windowMs = 60 * 60 * 1000
) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error:
        'Ya recibimos varios reportes desde esta conexión. Inténtalo más tarde.',
    },
  });
}

complaintRouter.post('/', createComplaintRateLimiter(), async (req, res) => {
  const parsed = createTransportComplaintSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Revisa los datos del reporte.',
    });
    return;
  }

  try {
    const db = getDb();
    if (!db) {
      res.status(503).json({
        offlineFallback: true,
        error: 'No pudimos recibir tu reporte en este momento. Inténtalo nuevamente más tarde.',
      });
      return;
    }

    const [created] = await db
      .insert(transportComplaints)
      .values({
        lineLabel: parsed.data.lineLabel,
        lineId: parsed.data.lineId ?? null,
        internalNumber: parsed.data.internalNumber ?? null,
        category: parsed.data.category,
        direction: parsed.data.direction,
        occurredAt: new Date(parsed.data.occurredAt),
        occurredTimezone: parsed.data.occurredTimezone,
        latitude: parsed.data.latitude ?? null,
        longitude: parsed.data.longitude ?? null,
        locationAccuracyMeters: parsed.data.locationAccuracyMeters ?? null,
        stopReference: parsed.data.stopReference ?? null,
        fareAmount: parsed.data.fareAmount ?? null,
        description: parsed.data.description,
        status: 'open',
      })
      .returning({
        id: transportComplaints.id,
        status: transportComplaints.status,
        createdAt: transportComplaints.createdAt,
      });

    res.status(201).json({ complaint: created });
  } catch (error: unknown) {
    console.error('[Complaints] POST error:', error);
    res.status(500).json({
      error: 'No pudimos guardar tu reporte. Inténtalo nuevamente más tarde.',
    });
  }
});
