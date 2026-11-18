export type Coordinates = [number, number]; // [longitude, latitude]

export interface RouteFeatureProperties {
  objectid?: number;
  nombre?: string;
  name?: string;
  linea?: string;
  sentido?: number; // 1 (Ida), 2 (Vuelta)
  origen?: number | string;
  medio?: number | string;
  destino?: number | string;
  desdoble?: number;
  sindicato?: number;
  parque_a?: number;
  color?: string;
  [key: string]: unknown;
}

export interface RouteItem {
  id: string; // unique ID e.g. "Línea 72-1"
  label: string; // e.g. "Línea 72"
  direction: number; // 1 (Ida) or 2 (Vuelta)
  directionLabel: string; // "Ida (S1)" or "Vuelta (S2)"
  color: string;
  coordinates: Coordinates[]; // Flattened sequence of coordinates for this route
  totalDistanceMeters: number;
  bbox: [number, number, number, number]; // [minX, minY, maxX, maxY]
  rawProperties?: RouteFeatureProperties;
}

export interface SpatialSegment {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  routeId: string;
  routeLabel: string;
  direction: number;
  segmentIndex: number;
  p1: Coordinates;
  p2: Coordinates;
  distAlongMeters: number;
  segmentLengthMeters: number;
}

export interface NearResult {
  routeId: string;
  routeLabel: string;
  direction: number;
  color: string;
  distanceMeters: number;
  nearestPoint: Coordinates;
  distAlongMeters: number;
  fractionAlong: number;
  totalDistanceMeters: number;
}

export interface TripLeg {
  routeId: string;
  routeLabel: string;
  direction: number;
  color: string;
  boardPoint: Coordinates;
  alightPoint: Coordinates;
  boardDistAlongMeters: number;
  alightDistAlongMeters: number;
  rideDistanceMeters: number;
  estimatedRideMinutes: number;
  pathCoordinates: Coordinates[];
}

export interface WalkSegment {
  from: Coordinates;
  to: Coordinates;
  distanceMeters: number;
  estimatedMinutes: number;
  instruction: string;
  pathCoordinates?: Coordinates[];
  streetNames?: string[];
}

export interface TripOption {
  id: string;
  type: 'direct' | 'transfer' | 'walk-only';
  summary: string;
  totalTimeMinutes: number;
  totalWalkMeters: number;
  totalRideMeters: number;
  legs: TripLeg[];
  walkSegments: WalkSegment[];
  steps: string[];
}

export interface POIItem {
  id: string | number;
  name: string;
  category: string;
  lat: number;
  lon: number;
  dir?: string;
  desc?: string;
}

export interface DatasetStats {
  featureCount: number;
  routeCount: number;
  segmentCount: number;
  totalDistanceKm: number;
  fileSizeBytes: number;
  fileName: string;
  loadTimeMs: number;
}

export interface GeofenceAlarmConfig {
  isActive: boolean;
  targetCoords: Coordinates | null;
  targetName: string;
  thresholdMeters: number; // 100, 200, 300
  soundEnabled: boolean;
  vibrateEnabled: boolean;
  isTriggered: boolean;
  currentDistanceMeters: number | null;
  currentAccuracyMeters: number | null;
}

export interface AgentFunctionCall {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: Record<string, any>;
}

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  functionCalls?: AgentFunctionCall[];
  actionExecuted?: boolean;
}

export interface StreetSegment {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  name: string;
  type?: string;
  p1: Coordinates;
  p2: Coordinates;
}

export interface CustomDatasetConfig {
  geoJson: any | null;
  fileName: string;
  featureCount: number;
  isVisible: boolean;
  color: string;
}

export type UserRole = 'user' | 'admin';

export interface UserProfile {
  id: string;
  googleSub: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
}

export type PlaceVisibility =
  | 'private'
  | 'public_pending'
  | 'public_approved'
  | 'rejected';

export interface PlaceCategoryItem {
  id: string;
  slug: string;
  name: string;
  iconKey?: string;
  colorHex?: string;
  status: 'approved' | 'pending' | 'rejected';
  source: 'static' | 'community';
  createdByUserId?: string | null;
}

export interface CommunityPOIItem extends POIItem {
  categoryId?: string;
  categorySlug?: string;
  visibility?: PlaceVisibility;
  ownerUserId?: string;
  moderationNote?: string;
  source?: 'static' | 'community';
  createdAt?: string;
}

export interface FavoriteRouteItem {
  id: string;
  userId: string;
  kind: 'line' | 'trip_ab';
  title: string;
  routeId?: string | null;
  originName?: string | null;
  originLat?: number | null;
  originLon?: number | null;
  destName?: string | null;
  destLat?: number | null;
  destLon?: number | null;
  tripSummary?: string | null;
  createdAt: string;
}

export type FeedbackTargetType = 'line' | 'trip' | 'place' | 'app';

export type FeedbackCategory =
  | 'ruta_desactualizada'
  | 'parada'
  | 'lugar_erroneo'
  | 'sugerencia'
  | 'bug';

export type FeedbackStatus = 'open' | 'reviewed' | 'resolved';

export interface FeedbackItem {
  id: string;
  targetType: FeedbackTargetType;
  targetRef?: string | null;
  rating: number;
  category: FeedbackCategory;
  comment: string;
  status: FeedbackStatus;
  createdAt: string;
}

export type TransportComplaintCategory =
  | 'trato_irrespetuoso'
  | 'negativa_servicio'
  | 'riesgo_peatonal'
  | 'conduccion_peligrosa'
  | 'cobro_excesivo'
  | 'posible_ebriedad'
  | 'otro';

export type TransportComplaintDirection = 'ida' | 'vuelta' | 'no_sabe';

export type TransportComplaintStatus = 'open' | 'reviewed' | 'resolved';

export interface TransportComplaintItem {
  id: string;
  lineLabel: string;
  lineId: string | null;
  internalNumber: string | null;
  category: TransportComplaintCategory;
  direction: TransportComplaintDirection;
  occurredAt: string;
  occurredTimezone: string;
  latitude: number | null;
  longitude: number | null;
  locationAccuracyMeters: number | null;
  stopReference: string | null;
  fareAmount: number | null;
  description: string;
  status: TransportComplaintStatus;
  createdAt: string;
}

export interface CreateTransportComplaintPayload {
  lineLabel: string;
  lineId?: string | null;
  internalNumber?: string | null;
  category: TransportComplaintCategory;
  direction?: TransportComplaintDirection;
  occurredAt: string;
  occurredTimezone: string;
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracyMeters?: number | null;
  stopReference?: string | null;
  fareAmount?: number | null;
  description: string;
}

export interface ModerationQueue {
  pendingPlaces: Array<{
    id: string;
    name: string;
    categoryId: string;
    categoryName: string;
    lat: number;
    lon: number;
    addressDir: string | null;
    description: string | null;
    visibility: PlaceVisibility;
    ownerEmail: string;
    ownerName: string;
    createdAt: string;
  }>;
  pendingCategories: Array<{
    id: string;
    slug: string;
    name: string;
    status: 'approved' | 'pending' | 'rejected';
    createdAt: string;
  }>;
  openFeedback: FeedbackItem[];
  openComplaints: TransportComplaintItem[];
}

export interface ApiHealthStatus {
  ok: boolean;
  service: string;
  database: {
    configured: boolean;
    connected: boolean;
    latencyMs?: number;
    error?: string;
  };
  googleAuthConfigured: boolean;
  geminiConfigured: boolean;
}

