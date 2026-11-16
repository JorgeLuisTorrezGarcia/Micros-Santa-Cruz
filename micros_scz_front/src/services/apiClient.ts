const LEGACY_SESSION_TOKEN_KEY = 'scz_micros_session_token';

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (typeof configured === 'string' && configured.trim().length > 0) {
    return configured.trim().replace(/\/+$/, '');
  }
  return '';
}

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

export function clearLegacySessionToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LEGACY_SESSION_TOKEN_KEY);
  } catch {
    // Storage may be unavailable in private browsing; cookie auth still works.
  }
}

clearLegacySessionToken();

export class ApiClientError extends Error {
  status: number;
  offlineFallback: boolean;

  constructor(message: string, status = 500, offlineFallback = false) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.offlineFallback = offlineFallback;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(buildApiUrl(path), {
      ...options,
      headers,
      credentials: options.credentials ?? 'include',
    });
  } catch {
    throw new ApiClientError(
      'Sin conexión con el servidor API. Funcionando en modo offline local.',
      0,
      true
    );
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiClientError(
      data.error || `Error HTTP ${response.status}`,
      response.status,
      Boolean(data.offlineFallback)
    );
  }

  return data as T;
}
