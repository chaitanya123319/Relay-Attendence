import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { ApiErrorEnvelope, AuthSession } from '../types';
import { clearTokens, persistTokens } from './session';

/**
 * Base URL: EXPO_PUBLIC_API_URL wins (set it to your PC's LAN IP when running on
 * a physical phone, e.g. http://192.168.1.20:4000). Falls back to localhost for
 * emulators/simulators.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export const api = axios.create({ baseURL: API_URL, timeout: 30000 });

// ── In-memory token state (hydrated from SecureStore by AuthContext) ─────────

let accessToken: string | null = null;
let refreshToken: string | null = null;
let sessionExpiredHandler: (() => void) | null = null;

export function setApiTokens(access: string | null, refresh: string | null): void {
  accessToken = access;
  refreshToken = refresh;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

/** AuthContext registers here to be told when refresh fails (→ back to Login). */
export function setSessionExpiredHandler(fn: (() => void) | null): void {
  sessionExpiredHandler = fn;
}

// ── Request interceptor: attach Bearer ───────────────────────────────────────

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// ── Response interceptor: ONE refresh attempt on 401, then retry ─────────────

interface RetryableConfig extends AxiosRequestConfig {
  _retried?: boolean;
}

let refreshPromise: Promise<string> | null = null;

async function refreshOnce(): Promise<string> {
  if (!refreshToken) throw new Error('No refresh token');
  // Bare axios call — no interceptors, so a 401 here cannot recurse.
  const res = await axios.post<AuthSession>(
    `${API_URL}/api/auth/refresh`,
    { refreshToken },
    { timeout: 15000 },
  );
  const data = res.data;
  accessToken = data.accessToken;
  refreshToken = data.refreshToken;
  await persistTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

function isAuthEndpoint(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes('/api/auth/login') || url.includes('/api/auth/refresh');
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined;
    const status = error.response?.status;
    if (status !== 401 || !config || config._retried || isAuthEndpoint(config.url)) {
      return Promise.reject(error);
    }
    config._retried = true;
    try {
      if (!refreshPromise) {
        refreshPromise = refreshOnce().finally(() => {
          refreshPromise = null;
        });
      }
      const fresh = await refreshPromise;
      config.headers = { ...(config.headers ?? {}), Authorization: `Bearer ${fresh}` };
      return await api.request(config);
    } catch (refreshErr) {
      accessToken = null;
      refreshToken = null;
      await clearTokens();
      sessionExpiredHandler?.();
      return Promise.reject(error);
    }
  },
);

// ── Error normalisation ──────────────────────────────────────────────────────

export interface NormalizedApiError {
  code: string | null;
  message: string;
  details?: Record<string, unknown>;
  status: number | null;
}

/** Turns anything thrown by axios into a displayable {code,message,details}. */
export function apiError(e: unknown): NormalizedApiError {
  if (axios.isAxiosError(e)) {
    const body = e.response?.data as ApiErrorEnvelope | undefined;
    if (body && typeof body === 'object' && 'error' in body && body.error?.message) {
      return {
        code: body.error.code ?? null,
        message: body.error.message,
        details: body.error.details,
        status: e.response?.status ?? null,
      };
    }
    if (!e.response) {
      return {
        code: 'NETWORK',
        message: `Can't reach the server at ${API_URL}. Check your connection and that the API is running.`,
        status: null,
      };
    }
    return { code: null, message: `Request failed (HTTP ${e.response.status})`, status: e.response.status };
  }
  if (e instanceof Error) return { code: null, message: e.message, status: null };
  return { code: null, message: 'Something went wrong', status: null };
}
