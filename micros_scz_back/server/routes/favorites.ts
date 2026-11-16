import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../db/index.ts';
import { favoriteRoutes } from '../db/schema.ts';
import { createFavoriteSchema } from '../db/validation.ts';
import { requireAuth } from '../middleware/auth.ts';

export const favoritesRouter = Router();

favoritesRouter.get('/', requireAuth, async (req, res) => {
  const db = getDb();
  if (!db) {
    res.status(503).json({ offlineFallback: true, error: 'Base de datos no configurada.' });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(favoriteRoutes)
      .where(eq(favoriteRoutes.userId, req.user!.id))
      .orderBy(desc(favoriteRoutes.createdAt));

    res.json({ favorites: rows });
  } catch (err: unknown) {
    console.error('[Favorites] GET error:', err);
    res.status(500).json({ error: 'Error cargando rutas favoritas.' });
  }
});

favoritesRouter.post('/', requireAuth, async (req, res) => {
  const db = getDb();
  if (!db) {
    res.status(503).json({ offlineFallback: true, error: 'Base de datos no configurada.' });
    return;
  }

  const parsed = createFavoriteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Datos de favorito inválidos',
    });
    return;
  }

  try {
    // Avoid duplicating a favorite line for the same user
    if (parsed.data.kind === 'line' && parsed.data.routeId) {
      const existing = await db
        .select()
        .from(favoriteRoutes)
        .where(
          and(
            eq(favoriteRoutes.userId, req.user!.id),
            eq(favoriteRoutes.kind, 'line'),
            eq(favoriteRoutes.routeId, parsed.data.routeId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        res.status(200).json({ favorite: existing[0], existed: true });
        return;
      }
    }

    const [created] = await db
      .insert(favoriteRoutes)
      .values({
        userId: req.user!.id,
        kind: parsed.data.kind,
        title: parsed.data.title,
        routeId: parsed.data.routeId ?? null,
        originName: parsed.data.originName ?? null,
        originLat: parsed.data.originLat ?? null,
        originLon: parsed.data.originLon ?? null,
        destName: parsed.data.destName ?? null,
        destLat: parsed.data.destLat ?? null,
        destLon: parsed.data.destLon ?? null,
        tripSummary: parsed.data.tripSummary ?? null,
      })
      .returning();

    res.status(201).json({ favorite: created });
  } catch (err: unknown) {
    console.error('[Favorites] POST error:', err);
    res.status(500).json({ error: 'No se pudo guardar la ruta favorita.' });
  }
});

favoritesRouter.delete('/:id', requireAuth, async (req, res) => {
  const db = getDb();
  if (!db) {
    res.status(503).json({ offlineFallback: true, error: 'Base de datos no configurada.' });
    return;
  }

  try {
    const favId = String(req.params.id);
    const existing = await db
      .select()
      .from(favoriteRoutes)
      .where(
        and(
          eq(favoriteRoutes.id, favId),
          eq(favoriteRoutes.userId, req.user!.id)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({ error: 'Favorito no encontrado.' });
      return;
    }

    await db.delete(favoriteRoutes).where(eq(favoriteRoutes.id, favId));
    res.json({ deleted: true, id: favId });
  } catch (err: unknown) {
    console.error('[Favorites] DELETE error:', err);
    res.status(500).json({ error: 'No se pudo eliminar el favorito.' });
  }
});
