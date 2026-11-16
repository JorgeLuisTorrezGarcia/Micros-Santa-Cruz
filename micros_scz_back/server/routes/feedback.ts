import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '../db/index.ts';
import { feedback } from '../db/schema.ts';
import { createFeedbackSchema } from '../db/validation.ts';
import { optionalAuth, requireAuth } from '../middleware/auth.ts';

export const feedbackRouter = Router();

feedbackRouter.post('/', optionalAuth, async (req, res) => {
  const db = getDb();
  if (!db) {
    res.status(503).json({
      offlineFallback: true,
      error:
        'PostgreSQL no está configurado aún en el backend. Conecta DATABASE_URL para guardar feedback.',
    });
    return;
  }

  const parsed = createFeedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Datos de feedback inválidos',
    });
    return;
  }

  try {
    const [created] = await db
      .insert(feedback)
      .values({
        userId: req.user?.id ?? null,
        targetType: parsed.data.targetType,
        targetRef: parsed.data.targetRef ?? null,
        rating: parsed.data.rating,
        category: parsed.data.category,
        comment: parsed.data.comment,
        status: 'open',
      })
      .returning();

    res.status(201).json({ feedback: created });
  } catch (err: unknown) {
    console.error('[Feedback] POST error:', err);
    res.status(500).json({ error: 'Error guardando tu comentario.' });
  }
});

feedbackRouter.get('/mine', requireAuth, async (req, res) => {
  const db = getDb();
  if (!db) {
    res.status(503).json({ offlineFallback: true, error: 'Base de datos no configurada.' });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(feedback)
      .where(eq(feedback.userId, req.user!.id))
      .orderBy(desc(feedback.createdAt));

    res.json({ items: rows });
  } catch (err: unknown) {
    console.error('[Feedback] GET /mine error:', err);
    res.status(500).json({ error: 'Error cargando tus reportes.' });
  }
});
