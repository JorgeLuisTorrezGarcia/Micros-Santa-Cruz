import { Router } from 'express';
import { desc, eq, ne } from 'drizzle-orm';
import { getDb } from '../db/index.ts';
import { feedback, placeCategories, places, users } from '../db/schema.ts';
import { moderationDecisionSchema } from '../db/validation.ts';
import { requireAdmin, requireAuth } from '../middleware/auth.ts';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/moderation', async (_req, res) => {
  const db = getDb();
  if (!db) {
    res.status(503).json({ offlineFallback: true, error: 'Base de datos no configurada.' });
    return;
  }

  try {
    const pendingPlaces = await db
      .select({
        id: places.id,
        name: places.name,
        categoryId: places.categoryId,
        categoryName: placeCategories.name,
        lat: places.lat,
        lon: places.lon,
        addressDir: places.addressDir,
        description: places.description,
        visibility: places.visibility,
        ownerEmail: users.email,
        ownerName: users.displayName,
        createdAt: places.createdAt,
      })
      .from(places)
      .innerJoin(placeCategories, eq(places.categoryId, placeCategories.id))
      .innerJoin(users, eq(places.ownerUserId, users.id))
      .where(eq(places.visibility, 'public_pending'))
      .orderBy(desc(places.createdAt));

    const pendingCategories = await db
      .select()
      .from(placeCategories)
      .where(eq(placeCategories.status, 'pending'))
      .orderBy(desc(placeCategories.createdAt));

    const openFeedback = await db
      .select({
        id: feedback.id,
        targetType: feedback.targetType,
        targetRef: feedback.targetRef,
        rating: feedback.rating,
        category: feedback.category,
        comment: feedback.comment,
        status: feedback.status,
        createdAt: feedback.createdAt,
      })
      .from(feedback)
      .where(ne(feedback.status, 'resolved'))
      .orderBy(desc(feedback.createdAt));

    res.json({
      pendingPlaces,
      pendingCategories,
      openFeedback,
    });
  } catch (err: unknown) {
    console.error('[Admin] GET /moderation error:', err);
    res.status(500).json({ error: 'Error cargando cola de moderación.' });
  }
});

adminRouter.patch('/moderation/:entity/:id', async (req, res) => {
  const db = getDb();
  if (!db) {
    res.status(503).json({ offlineFallback: true, error: 'Base de datos no configurada.' });
    return;
  }

  const entity = String(req.params.entity);
  const id = String(req.params.id);
  const parsed = moderationDecisionSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Estado de moderación inválido',
    });
    return;
  }

  try {
    if (entity === 'place') {
      if (
        parsed.data.status !== 'public_approved' &&
        parsed.data.status !== 'rejected'
      ) {
        res.status(400).json({ error: 'Estado inválido para lugar.' });
        return;
      }

      const [updated] = await db
        .update(places)
        .set({
          visibility: parsed.data.status,
          moderatedByUserId: req.user!.id,
          moderationNote: parsed.data.moderationNote ?? null,
          updatedAt: new Date(),
        })
        .where(eq(places.id, id))
        .returning();

      if (!updated) {
        res.status(404).json({ error: 'Lugar no encontrado.' });
        return;
      }
      res.json({ updated });
      return;
    }

    if (entity === 'category') {
      if (
        parsed.data.status !== 'approved' &&
        parsed.data.status !== 'rejected'
      ) {
        res.status(400).json({ error: 'Estado inválido para categoría.' });
        return;
      }

      const [updated] = await db
        .update(placeCategories)
        .set({ status: parsed.data.status })
        .where(eq(placeCategories.id, id))
        .returning();

      if (!updated) {
        res.status(404).json({ error: 'Categoría no encontrada.' });
        return;
      }
      res.json({ updated });
      return;
    }

    if (entity === 'feedback') {
      if (
        parsed.data.status !== 'open' &&
        parsed.data.status !== 'reviewed' &&
        parsed.data.status !== 'resolved'
      ) {
        res.status(400).json({ error: 'Estado inválido para feedback.' });
        return;
      }

      const [updated] = await db
        .update(feedback)
        .set({ status: parsed.data.status })
        .where(eq(feedback.id, id))
        .returning();

      if (!updated) {
        res.status(404).json({ error: 'Reporte no encontrado.' });
        return;
      }
      res.json({ updated });
      return;
    }

    res.status(400).json({ error: 'Entidad de moderación desconocida.' });
  } catch (err: unknown) {
    console.error('[Admin] PATCH /moderation error:', err);
    res.status(500).json({ error: 'Error aplicando moderación.' });
  }
});
