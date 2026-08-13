const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';
const TOKEN_STORAGE_KEY = 'accessToken';

export class ApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

interface ApiSuccessBody<T> {
  success: true;
  data: T;
}

interface ApiErrorBody {
  success: false;
  error: { code: string; message: string };
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  // Empty body covers 204 No Content, but also guards against a stray 304
  // (e.g. from an intermediary that ignores Cache-Control: no-store) or
  // any other response with nothing to parse — safer than special-casing
  // one status code and letting everything else hit JSON.parse blind.
  const text = await response.text();
  if (!text) {
    if (response.ok) {
      return undefined as T;
    }
    throw new ApiError('EMPTY_RESPONSE', `Request failed with status ${response.status}`);
  }

  let body: ApiSuccessBody<T> | ApiErrorBody;
  try {
    body = JSON.parse(text) as ApiSuccessBody<T> | ApiErrorBody;
  } catch {
    throw new ApiError(
      'INVALID_RESPONSE',
      `Could not parse response as JSON (status ${response.status})`,
    );
  }

  if (!body.success) {
    throw new ApiError(body.error.code, body.error.message);
  }
  return body.data;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
