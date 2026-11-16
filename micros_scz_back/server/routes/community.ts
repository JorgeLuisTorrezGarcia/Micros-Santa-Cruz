import { Router } from 'express';
import { and, desc, eq, ne, or } from 'drizzle-orm';
import { getDb } from '../db/index.ts';
import {
  favoriteRoutes,
  placeCategories,
  places,
} from '../db/schema.ts';
import {
  createCategorySchema,
  createPlaceSchema,
  slugifyCategory,
  updatePlaceSchema,
} from '../db/validation.ts';
import { optionalAuth, requireAuth } from '../middleware/auth.ts';

export const communityRouter = Router();

const STATIC_BASE_CATEGORY_NAMES = new Set([
  'oficinas de gobierno',
  'centros comerciales',
  'centros de salud',
  'universidades',
  'centros culturales',
  'museos',
  'deportes',
  'cementerios',
  'iglesias',
  'mercados',
  'atractivos turisticos',
  'monumentos',
  'parques',
  'plazas',
  'transportes',
  'colegios',
  'policia',
  'prosalud',
  'guarderias',
]);

function isBaseStaticCategory(name: string): boolean {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  return STATIC_BASE_CATEGORY_NAMES.has(normalized);
}

communityRouter.get('/community/bootstrap', optionalAuth, async (req, res) => {
  const db = getDb();
  if (!db) {
    res.json({
      dbConfigured: false,
      categories: [],
      places: [],
      favorites: [],
    });
    return;
  }

  try {
    const userId = req.user?.id ?? null;

    const categoryRows = await db
      .select()
      .from(placeCategories)
      .where(
        userId
          ? or(
              eq(placeCategories.status, 'approved'),
              and(
                eq(placeCategories.createdByUserId, userId),
                ne(placeCategories.status, 'rejected')
              )
            )
          : eq(placeCategories.status, 'approved')
      )
      .orderBy(placeCategories.name);

    const placeRows = await db
      .select({
        id: places.id,
        name: places.name,
        categoryId: places.categoryId,
        categoryName: placeCategories.name,
        categorySlug: placeCategories.slug,
        lat: places.lat,
        lon: places.lon,
        addressDir: places.addressDir,
        description: places.description,
        visibility: places.visibility,
        ownerUserId: places.ownerUserId,
        moderationNote: places.moderationNote,
        createdAt: places.createdAt,
        updatedAt: places.updatedAt,
      })
      .from(places)
      .innerJoin(placeCategories, eq(places.categoryId, placeCategories.id))
      .where(
        userId
          ? or(
              eq(places.visibility, 'public_approved'),
              eq(places.ownerUserId, userId)
            )
          : eq(places.visibility, 'public_approved')
      )
      .orderBy(desc(places.createdAt));

    const favRows = userId
      ? await db
          .select()
          .from(favoriteRoutes)
          .where(eq(favoriteRoutes.userId, userId))
          .orderBy(desc(favoriteRoutes.createdAt))
      : [];

    res.json({
      dbConfigured: true,
      categories: categoryRows,
      places: placeRows.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.categoryName,
        categoryId: p.categoryId,
        categorySlug: p.categorySlug,
        lat: p.lat,
        lon: p.lon,
        dir: p.addressDir || undefined,
        desc: p.description || undefined,
        visibility: p.visibility,
        ownerUserId: p.ownerUserId,
        moderationNote: p.moderationNote || undefined,
        source: 'community' as const,
        createdAt: p.createdAt,
      })),
      favorites: favRows,
    });
  } catch (err: unknown) {
    console.error('[Community] bootstrap error:', err);
    res.json({
      dbConfigured: true,
      dbError: true,
      categories: [],
      places: [],
      favorites: [],
    });
  }
});

communityRouter.post('/categories', requireAuth, async (req, res) => {
  const db = getDb();
  if (!db) {
    res.status(503).json({
      offlineFallback: true,
      error: 'Base de datos PostgreSQL no configurada.',
    });
    return;
  }

  const parsed = createCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Datos de categoría inválidos',
    });
    return;
  }

  try {
    const slug = slugifyCategory(parsed.data.name);
    if (!slug) {
      res.status(400).json({ error: 'Nombre de categoría inválido.' });
      return;
    }

    const existing = await db
      .select()
      .from(placeCategories)
      .where(eq(placeCategories.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      res.status(200).json({ category: existing[0], existed: true });
      return;
    }

    const status =
      req.user!.role === 'admin' || isBaseStaticCategory(parsed.data.name)
        ? 'approved'
        : 'pending';

    const [created] = await db
      .insert(placeCategories)
      .values({
        slug,
        name: parsed.data.name,
        iconKey: parsed.data.iconKey,
        colorHex: parsed.data.colorHex,
        status,
        createdByUserId: req.user!.id,
      })
      .returning();

    res.status(201).json({ category: created });
  } catch (err: unknown) {
    console.error('[Community] POST /categories error:', err);
    res.status(500).json({ error: 'No se pudo registrar la categoría.' });
  }
});

communityRouter.post('/places', requireAuth, async (req, res) => {
  const db = getDb();
  if (!db) {
    res.status(503).json({
      offlineFallback: true,
      error: 'Base de datos PostgreSQL no configurada.',
    });
    return;
  }

  const parsed = createPlaceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Datos de lugar inválidos',
    });
    return;
  }

  try {
    let resolvedCategoryId = parsed.data.categoryId;
    let resolvedCategoryName = parsed.data.categoryName || '';
    let resolvedCategorySlug = '';

    if (resolvedCategoryId) {
      const found = await db
        .select()
        .from(placeCategories)
        .where(eq(placeCategories.id, resolvedCategoryId))
        .limit(1);
      if (found.length === 0) {
        res.status(400).json({ error: 'La categoría seleccionada no existe.' });
        return;
      }
      resolvedCategoryName = found[0].name;
      resolvedCategorySlug = found[0].slug;
    } else if (resolvedCategoryName) {
      const slug = slugifyCategory(resolvedCategoryName);
      const found = await db
        .select()
        .from(placeCategories)
        .where(eq(placeCategories.slug, slug))
        .limit(1);

      if (found.length > 0) {
        resolvedCategoryId = found[0].id;
        resolvedCategoryName = found[0].name;
        resolvedCategorySlug = found[0].slug;
      } else {
        const autoApprove =
          req.user!.role === 'admin' || isBaseStaticCategory(resolvedCategoryName);
        const [createdCat] = await db
          .insert(placeCategories)
          .values({
            slug,
            name: resolvedCategoryName,
            status: autoApprove ? 'approved' : 'pending',
            createdByUserId: req.user!.id,
          })
          .returning();
        resolvedCategoryId = createdCat.id;
        resolvedCategoryName = createdCat.name;
        resolvedCategorySlug = createdCat.slug;
      }
    } else {
      res.status(400).json({
        error: 'Debes elegir o escribir una categoría para el lugar.',
      });
      return;
    }

    // Admins proposing public places can publish directly if desired, or keep pending
    const finalVisibility =
      parsed.data.visibility === 'public_pending' && req.user!.role === 'admin'
        ? 'public_approved'
        : parsed.data.visibility;

    const [created] = await db
      .insert(places)
      .values({
        name: parsed.data.name,
        categoryId: resolvedCategoryId,
        lat: parsed.data.lat,
        lon: parsed.data.lon,
        addressDir: parsed.data.addressDir ?? null,
        description: parsed.data.description ?? null,
        visibility: finalVisibility,
        ownerUserId: req.user!.id,
      })
      .returning();

    res.status(201).json({
      place: {
        id: created.id,
        name: created.name,
        category: resolvedCategoryName,
        categoryId: created.categoryId,
        categorySlug: resolvedCategorySlug,
        lat: created.lat,
        lon: created.lon,
        dir: created.addressDir || undefined,
        desc: created.description || undefined,
        visibility: created.visibility,
        ownerUserId: created.ownerUserId,
        source: 'community' as const,
        createdAt: created.createdAt,
      },
    });
  } catch (err: unknown) {
    console.error('[Community] POST /places error:', err);
    res.status(500).json({ error: 'No se pudo guardar el lugar.' });
  }
});

communityRouter.patch('/places/:id', requireAuth, async (req, res) => {
  const db = getDb();
  if (!db) {
    res.status(503).json({ offlineFallback: true, error: 'Base de datos no configurada.' });
    return;
  }

  const parsed = updatePlaceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Datos inválidos',
    });
    return;
  }

  try {
    const placeId = String(req.params.id);
    const existing = await db
      .select()
      .from(places)
      .where(eq(places.id, placeId))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({ error: 'Lugar no encontrado.' });
      return;
    }

    const row = existing[0];
    if (row.ownerUserId !== req.user!.id && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'No tienes permiso para editar este lugar.' });
      return;
    }

    const nextVisibility =
      parsed.data.visibility !== undefined
        ? parsed.data.visibility === 'public_pending' && req.user!.role === 'admin'
          ? 'public_approved'
          : parsed.data.visibility
        : row.visibility === 'public_approved' && req.user!.role !== 'admin'
        ? 'public_pending'
        : row.visibility;

    const [updated] = await db
      .update(places)
      .set({
        name: parsed.data.name ?? row.name,
        categoryId: parsed.data.categoryId ?? row.categoryId,
        lat: parsed.data.lat ?? row.lat,
        lon: parsed.data.lon ?? row.lon,
        addressDir:
          parsed.data.addressDir !== undefined
            ? parsed.data.addressDir
            : row.addressDir,
        description:
          parsed.data.description !== undefined
            ? parsed.data.description
            : row.description,
        visibility: nextVisibility,
        updatedAt: new Date(),
      })
      .where(eq(places.id, placeId))
      .returning();

    res.json({ place: updated });
  } catch (err: unknown) {
    console.error('[Community] PATCH /places/:id error:', err);
    res.status(500).json({ error: 'Error actualizando el lugar.' });
  }
});

communityRouter.delete('/places/:id', requireAuth, async (req, res) => {
  const db = getDb();
  if (!db) {
    res.status(503).json({ offlineFallback: true, error: 'Base de datos no configurada.' });
    return;
  }

  try {
    const placeId = String(req.params.id);
    const existing = await db
      .select()
      .from(places)
      .where(eq(places.id, placeId))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({ error: 'Lugar no encontrado.' });
      return;
    }

    if (
      existing[0].ownerUserId !== req.user!.id &&
      req.user!.role !== 'admin'
    ) {
      res.status(403).json({ error: 'No tienes permiso para eliminar este lugar.' });
      return;
    }

    await db.delete(places).where(eq(places.id, placeId));
    res.json({ deleted: true, id: placeId });
  } catch (err: unknown) {
    console.error('[Community] DELETE /places/:id error:', err);
    res.status(500).json({ error: 'Error eliminando el lugar.' });
  }
});
