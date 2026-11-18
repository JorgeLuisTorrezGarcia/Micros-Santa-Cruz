import {
  pgTable,
  pgEnum,
  uuid,
  text,
  doublePrecision,
  numeric,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

export const categoryStatusEnum = pgEnum('category_status', [
  'approved',
  'pending',
  'rejected',
]);

export const placeVisibilityEnum = pgEnum('place_visibility', [
  'private',
  'public_pending',
  'public_approved',
  'rejected',
]);

export const favoriteKindEnum = pgEnum('favorite_kind', ['line', 'trip_ab']);

export const feedbackTargetTypeEnum = pgEnum('feedback_target_type', [
  'line',
  'trip',
  'place',
  'app',
]);

export const feedbackCategoryEnum = pgEnum('feedback_category', [
  'ruta_desactualizada',
  'parada',
  'lugar_erroneo',
  'sugerencia',
  'bug',
]);

export const feedbackStatusEnum = pgEnum('feedback_status', [
  'open',
  'reviewed',
  'resolved',
]);

export const complaintCategoryEnum = pgEnum('complaint_category', [
  'trato_irrespetuoso',
  'negativa_servicio',
  'riesgo_peatonal',
  'conduccion_peligrosa',
  'cobro_excesivo',
  'posible_ebriedad',
  'otro',
]);

export const complaintDirectionEnum = pgEnum('complaint_direction', [
  'ida',
  'vuelta',
  'no_sabe',
]);

export const complaintStatusEnum = pgEnum('complaint_status', [
  'open',
  'reviewed',
  'resolved',
]);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  googleSub: text('google_sub').notNull().unique(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  role: userRoleEnum('role').default('user').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const placeCategories = pgTable('place_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  iconKey: text('icon_key').default('building').notNull(),
  colorHex: text('color_hex').default('#10b981').notNull(),
  status: categoryStatusEnum('status').default('pending').notNull(),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const places = pgTable('places', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  categoryId: uuid('category_id')
    .references(() => placeCategories.id, { onDelete: 'restrict' })
    .notNull(),
  lat: doublePrecision('lat').notNull(),
  lon: doublePrecision('lon').notNull(),
  addressDir: text('address_dir'),
  description: text('description'),
  visibility: placeVisibilityEnum('visibility').default('private').notNull(),
  ownerUserId: uuid('owner_user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  moderatedByUserId: uuid('moderated_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  moderationNote: text('moderation_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const favoriteRoutes = pgTable('favorite_routes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  kind: favoriteKindEnum('kind').notNull(),
  title: text('title').notNull(),
  routeId: text('route_id'),
  originName: text('origin_name'),
  originLat: doublePrecision('origin_lat'),
  originLon: doublePrecision('origin_lon'),
  destName: text('dest_name'),
  destLat: doublePrecision('dest_lat'),
  destLon: doublePrecision('dest_lon'),
  tripSummary: text('trip_summary'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const feedback = pgTable('feedback', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  targetType: feedbackTargetTypeEnum('target_type').notNull(),
  targetRef: text('target_ref'),
  rating: integer('rating').notNull(),
  category: feedbackCategoryEnum('category').notNull(),
  comment: text('comment').notNull(),
  status: feedbackStatusEnum('status').default('open').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const transportComplaints = pgTable(
  'transport_complaints',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    lineLabel: text('line_label').notNull(),
    lineId: text('line_id'),
    internalNumber: text('internal_number'),
    category: complaintCategoryEnum('category').notNull(),
    direction: complaintDirectionEnum('direction').default('no_sabe').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    occurredTimezone: text('occurred_timezone').notNull(),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    locationAccuracyMeters: doublePrecision('location_accuracy_meters'),
    stopReference: text('stop_reference'),
    fareAmount: numeric('fare_amount', { precision: 8, scale: 2, mode: 'number' }),
    description: text('description').notNull(),
    status: complaintStatusEnum('status').default('open').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('transport_complaints_status_created_at_idx').on(
      table.status,
      table.createdAt
    ),
    index('transport_complaints_line_category_time_idx').on(
      table.lineLabel,
      table.category,
      table.occurredAt
    ),
  ]
);
