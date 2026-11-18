import { z } from 'zod';

// Santa Cruz de la Sierra + surrounding metropolitan bounds
export const SCZ_BOUNDS = {
  minLat: -18.18,
  maxLat: -17.5,
  minLon: -63.48,
  maxLon: -62.88,
} as const;

export function isWithinSantaCruzBounds(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= SCZ_BOUNDS.minLat &&
    lat <= SCZ_BOUNDS.maxLat &&
    lon >= SCZ_BOUNDS.minLon &&
    lon <= SCZ_BOUNDS.maxLon
  );
}

export function slugifyCategory(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);
}

export const createCategorySchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(60, 'Máximo 60 caracteres'),
  iconKey: z
    .enum(['building', 'graduation', 'shopping', 'hospital', 'store', 'bus', 'park', 'landmark'])
    .optional()
    .default('building'),
  colorHex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color hexadecimal inválido')
    .optional()
    .default('#10b981'),
});

export const createPlaceSchema = z.object({
  name: z.string().trim().min(2, 'Nombre requerido').max(120, 'Máximo 120 caracteres'),
  categoryId: z.string().uuid('Categoría inválida').optional(),
  categoryName: z.string().trim().min(2).max(60).optional(),
  lat: z
    .number()
    .refine((v) => v >= SCZ_BOUNDS.minLat && v <= SCZ_BOUNDS.maxLat, {
      message: 'Latitud fuera del área metropolitana de Santa Cruz',
    }),
  lon: z
    .number()
    .refine((v) => v >= SCZ_BOUNDS.minLon && v <= SCZ_BOUNDS.maxLon, {
      message: 'Longitud fuera del área metropolitana de Santa Cruz',
    }),
  addressDir: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  visibility: z.enum(['private', 'public_pending']).default('private'),
});

export const updatePlaceSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  categoryId: z.string().uuid().optional(),
  lat: z
    .number()
    .refine((v) => v >= SCZ_BOUNDS.minLat && v <= SCZ_BOUNDS.maxLat, {
      message: 'Latitud fuera de Santa Cruz',
    })
    .optional(),
  lon: z
    .number()
    .refine((v) => v >= SCZ_BOUNDS.minLon && v <= SCZ_BOUNDS.maxLon, {
      message: 'Longitud fuera de Santa Cruz',
    })
    .optional(),
  addressDir: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  visibility: z.enum(['private', 'public_pending']).optional(),
});

export const createFavoriteSchema = z
  .object({
    kind: z.enum(['line', 'trip_ab']),
    title: z.string().trim().min(2).max(140),
    routeId: z.string().trim().max(100).optional().nullable(),
    originName: z.string().trim().max(140).optional().nullable(),
    originLat: z.number().optional().nullable(),
    originLon: z.number().optional().nullable(),
    destName: z.string().trim().max(140).optional().nullable(),
    destLat: z.number().optional().nullable(),
    destLon: z.number().optional().nullable(),
    tripSummary: z.string().trim().max(240).optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.kind === 'line' && !val.routeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'routeId es requerido para línea favorita',
        path: ['routeId'],
      });
    }
    if (
      val.kind === 'trip_ab' &&
      (val.originLat == null ||
        val.originLon == null ||
        val.destLat == null ||
        val.destLon == null)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Coordenadas de origen y destino requeridas para viaje favorito',
        path: ['originLat'],
      });
    }
  });

export const createFeedbackSchema = z.object({
  targetType: z.enum(['line', 'trip', 'place', 'app']),
  targetRef: z.string().trim().max(140).optional().nullable(),
  rating: z.number().int().min(1).max(5),
  category: z.enum([
    'ruta_desactualizada',
    'parada',
    'lugar_erroneo',
    'sugerencia',
    'bug',
  ]),
  comment: z.string().trim().min(4, 'Describe brevemente tu reporte').max(1000),
});

export const createTransportComplaintSchema = z
  .object({
    lineLabel: z.string().trim().min(1).max(100),
    lineId: z.string().trim().max(120).optional().nullable(),
    internalNumber: z.string().trim().min(1).max(30).optional().nullable(),
    category: z.enum([
      'trato_irrespetuoso',
      'negativa_servicio',
      'riesgo_peatonal',
      'conduccion_peligrosa',
      'cobro_excesivo',
      'posible_ebriedad',
      'otro',
    ]),
    direction: z.enum(['ida', 'vuelta', 'no_sabe']).default('no_sabe'),
    occurredAt: z.string().datetime({ offset: true }),
    occurredTimezone: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat('es', { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, 'Zona horaria inválida'),
    latitude: z
      .number()
      .refine((value) => value >= SCZ_BOUNDS.minLat && value <= SCZ_BOUNDS.maxLat, {
        message: 'Ubicación fuera del área metropolitana de Santa Cruz',
      })
      .optional()
      .nullable(),
    longitude: z
      .number()
      .refine((value) => value >= SCZ_BOUNDS.minLon && value <= SCZ_BOUNDS.maxLon, {
        message: 'Ubicación fuera del área metropolitana de Santa Cruz',
      })
      .optional()
      .nullable(),
    locationAccuracyMeters: z.number().positive().max(10000).optional().nullable(),
    stopReference: z.string().trim().max(160).optional().nullable(),
    fareAmount: z.number().positive().max(1000).optional().nullable(),
    description: z.string().trim().min(5).max(2000),
  })
  .superRefine((value, context) => {
    if ((value.latitude == null) !== (value.longitude == null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Envía latitud y longitud juntas o deja ambas vacías.',
        path: ['latitude'],
      });
    }

    if (value.locationAccuracyMeters != null && value.latitude == null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La precisión requiere una ubicación.',
        path: ['locationAccuracyMeters'],
      });
    }

    if (value.fareAmount != null && value.category !== 'cobro_excesivo') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El monto solo corresponde a reportes de cobro excesivo.',
        path: ['fareAmount'],
      });
    }

    if (Date.parse(value.occurredAt) > Date.now() + 5 * 60 * 1000) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La fecha del incidente no puede estar en el futuro.',
        path: ['occurredAt'],
      });
    }
  });

export const moderationDecisionSchema = z.object({
  status: z.string().trim().min(2).max(32),
  moderationNote: z.string().trim().max(300).optional().nullable(),
});
