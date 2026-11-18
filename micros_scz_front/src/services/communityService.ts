import type {
  ApiHealthStatus,
  CommunityPOIItem,
  CreateTransportComplaintPayload,
  FavoriteRouteItem,
  FeedbackCategory,
  FeedbackItem,
  FeedbackTargetType,
  ModerationQueue,
  PlaceCategoryItem,
  PlaceVisibility,
  UserProfile,
} from '../types.ts';
import { apiRequest } from './apiClient.ts';

export interface BootstrapResponse {
  dbConfigured: boolean;
  dbError?: boolean;
  categories: PlaceCategoryItem[];
  places: CommunityPOIItem[];
  favorites: FavoriteRouteItem[];
}

export interface CreatePlacePayload {
  name: string;
  categoryId?: string;
  categoryName?: string;
  lat: number;
  lon: number;
  addressDir?: string | null;
  description?: string | null;
  visibility: 'private' | 'public_pending';
}

export interface CreateFavoritePayload {
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
}

export interface CreateFeedbackPayload {
  targetType: FeedbackTargetType;
  targetRef?: string | null;
  rating: number;
  category: FeedbackCategory;
  comment: string;
}

export async function fetchApiHealth(): Promise<ApiHealthStatus> {
  return apiRequest<ApiHealthStatus>('/api/health');
}

export async function authenticateWithGoogleToken(
  idToken: string
): Promise<{ user: UserProfile }> {
  return apiRequest<{ user: UserProfile }>(
    '/api/auth/session',
    {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    }
  );
}

export async function closeSession(): Promise<void> {
  await apiRequest<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
}

export async function fetchCurrentUser(): Promise<UserProfile | null> {
  const res = await apiRequest<{ user: UserProfile | null }>('/api/auth/me');
  return res.user;
}

export async function bootstrapCommunity(): Promise<BootstrapResponse> {
  return apiRequest<BootstrapResponse>('/api/community/bootstrap');
}

export async function createCommunityPlace(
  payload: CreatePlacePayload
): Promise<CommunityPOIItem> {
  const res = await apiRequest<{ place: CommunityPOIItem }>('/api/places', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.place;
}

export async function deleteCommunityPlace(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/places/${id}`, {
    method: 'DELETE',
  });
}

export async function updateCommunityPlaceVisibility(
  id: string,
  visibility: Extract<PlaceVisibility, 'private' | 'public_pending'>
): Promise<void> {
  await apiRequest(`/api/places/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ visibility }),
  });
}

export async function createFavoriteRoute(
  payload: CreateFavoritePayload
): Promise<FavoriteRouteItem> {
  const res = await apiRequest<{ favorite: FavoriteRouteItem }>(
    '/api/favorites',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
  return res.favorite;
}

export async function deleteFavoriteRoute(id: string): Promise<void> {
  await apiRequest<{ deleted: boolean }>(`/api/favorites/${id}`, {
    method: 'DELETE',
  });
}

export async function submitFeedback(
  payload: CreateFeedbackPayload
): Promise<FeedbackItem> {
  const res = await apiRequest<{ feedback: FeedbackItem }>('/api/feedback', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.feedback;
}

export async function submitTransportComplaint(
  payload: CreateTransportComplaintPayload
): Promise<{ id: string; status: 'open'; createdAt: string }> {
  const res = await apiRequest<{
    complaint: { id: string; status: 'open'; createdAt: string };
  }>('/api/complaints', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.complaint;
}

export async function fetchModerationQueue(): Promise<ModerationQueue> {
  return apiRequest<ModerationQueue>('/api/admin/moderation');
}

export async function moderateEntity(
  entity: 'place' | 'category' | 'feedback' | 'complaint',
  id: string,
  status: string,
  moderationNote?: string
): Promise<void> {
  await apiRequest(`/api/admin/moderation/${entity}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, moderationNote }),
  });
}
