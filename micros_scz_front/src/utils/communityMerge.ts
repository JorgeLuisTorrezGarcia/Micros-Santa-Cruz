import type { CommunityPOIItem, PlaceCategoryItem, POIItem } from '../types.ts';

function normalizeSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Merges static offline POIs (lugares_scz.json) with community PostgreSQL places.
 * Static offline items always load first and remain untouched; community records extend them.
 */
export function mergeStaticAndCommunityPlaces(
  staticPois: POIItem[],
  communityPlaces: CommunityPOIItem[]
): CommunityPOIItem[] {
  const base: CommunityPOIItem[] = staticPois.map((poi) => ({
    ...poi,
    source: 'static',
  }));

  if (!communityPlaces || communityPlaces.length === 0) {
    return base;
  }

  const seenIds = new Set(base.map((p) => String(p.id)));
  const merged = [...base];

  for (const place of communityPlaces) {
    const key = String(place.id);
    if (seenIds.has(key)) continue;
    seenIds.add(key);
    merged.push({
      ...place,
      source: 'community',
    });
  }

  return merged;
}

/**
 * Merges static categories (categoria_lugares.json) with approved/user-pending Postgres categories.
 */
export function mergeStaticAndCommunityCategories(
  staticCategoryNames: string[],
  communityCategories: PlaceCategoryItem[]
): PlaceCategoryItem[] {
  const bySlug = new Map<string, PlaceCategoryItem>();

  for (const name of staticCategoryNames) {
    const slug = normalizeSlug(name);
    if (!slug || bySlug.has(slug)) continue;
    bySlug.set(slug, {
      id: `static-${slug}`,
      slug,
      name,
      status: 'approved',
      source: 'static',
    });
  }

  for (const cat of communityCategories) {
    const slug = cat.slug || normalizeSlug(cat.name);
    if (!slug) continue;
    // Prefer real DB category ID when present so forms can submit UUID directly
    bySlug.set(slug, {
      ...cat,
      slug,
      source: 'community',
    });
  }

  return Array.from(bySlug.values());
}
