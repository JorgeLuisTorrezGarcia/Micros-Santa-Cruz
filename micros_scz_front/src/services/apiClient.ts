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
  diagnosticMessage: string;

  constructor(
    status = 500,
    offlineFallback = false,
    diagnosticMessage = ''
  ) {
    super(getApiErrorMessage(status));
    this.name = 'ApiClientError';
    this.status = status;
    this.offlineFallback = offlineFallback;
    this.diagnosticMessage = diagnosticMessage;
  }
}

function getApiErrorMessage(status: number): string {
  if (status === 0) {
    return 'No pudimos conectar con el servicio. Revisa tu conexión e inténtalo nuevamente.';
  }
  if (status === 400 || status === 422) {
    return 'Revisa la información ingresada e inténtalo nuevamente.';
  }
  if (status === 401) {
    return 'Tu sesión pudo haber vencido. Inicia sesión nuevamente.';
  }
  if (status === 403) {
    return 'No tienes permiso para realizar esta acción.';
  }
  if (status === 404) {
    return 'No encontramos la información solicitada.';
  }
  if (status === 429) {
    return 'Hay muchas solicitudes en este momento. Inténtalo en unos minutos.';
  }
  if (status === 501 || status === 503) {
    return 'Esta función no está disponible por ahora. Puedes seguir usando las demás funciones.';
  }
  if (status >= 500) {
    return 'No pudimos completar la solicitud. Inténtalo nuevamente más tarde.';
  }
  return 'No pudimos completar la solicitud. Inténtalo nuevamente.';
}

export function getUserFriendlyError(
  error: unknown,
  fallback: string
): string {
  return error instanceof ApiClientError ? error.message : fallback;
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
  } catch (error: unknown) {
    throw new ApiClientError(
      0,
      true,
      error instanceof Error ? error.message : 'Fetch request failed'
    );
  }

  const responseData: unknown = await response.json().catch(() => ({}));
  const data =
    responseData && typeof responseData === 'object'
      ? (responseData as Record<string, unknown>)
      : {};

  if (!response.ok) {
    throw new ApiClientError(
      response.status,
      Boolean(data.offlineFallback),
      typeof data.error === 'string' ? data.error : `HTTP ${response.status}`
    );
  }

  return data as T;
}
