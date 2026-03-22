/**
 * Typed fetch wrapper — all API calls go through this client.
 * Auth token is kept in memory only (never persisted).
 */

import { API_BASE_URL } from '../lib/constants';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let _authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  _authToken = token;
}

export function getAuthToken(): string | null {
  return _authToken;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (_authToken) headers['Authorization'] = `Bearer ${_authToken}`;

  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!res.ok) {
    let errorBody: unknown;
    try {
      errorBody = await res.json();
    } catch {
      errorBody = await res.text();
    }
    throw new ApiError(res.status, `HTTP ${res.status}: ${res.statusText}`, errorBody);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const apiClient = {
  get<T>(path: string, signal?: AbortSignal): Promise<T> {
    return request<T>('GET', path, undefined, signal);
  },
  post<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return request<T>('POST', path, body, signal);
  },
  put<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    return request<T>('PUT', path, body, signal);
  },
  delete<T>(path: string, signal?: AbortSignal): Promise<T> {
    return request<T>('DELETE', path, undefined, signal);
  },

  /** Upload a file with optional metadata via FormData. */
  async upload<T>(path: string, file: File, metadata?: Record<string, string>): Promise<T> {
    const form = new FormData();
    form.append('file', file);
    if (metadata) {
      Object.entries(metadata).forEach(([k, v]) => form.append(k, v));
    }
    const headers: Record<string, string> = {};
    if (_authToken) headers['Authorization'] = `Bearer ${_authToken}`;

    const url = `${API_BASE_URL}${path}`;
    const res = await fetch(url, { method: 'POST', headers, body: form });
    if (!res.ok) {
      let errorBody: unknown;
      try {
        errorBody = await res.json();
      } catch {
        errorBody = await res.text();
      }
      throw new ApiError(res.status, `HTTP ${res.status}: ${res.statusText}`, errorBody);
    }
    return res.json() as Promise<T>;
  },

  /** Download a blob (PDF, JSON bundle, etc.). */
  async download(path: string): Promise<Blob> {
    const headers: Record<string, string> = {};
    if (_authToken) headers['Authorization'] = `Bearer ${_authToken}`;
    const url = `${API_BASE_URL}${path}`;
    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}: ${res.statusText}`);
    return res.blob();
  },
};
