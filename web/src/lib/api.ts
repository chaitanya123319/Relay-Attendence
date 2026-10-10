import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import type { LoginResponse, User } from './types'

/** API base — override with VITE_API_URL at build time if the backend moves. */
export const API_BASE: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api'

const ACCESS_KEY = 'relay.accessToken'
const REFRESH_KEY = 'relay.refreshToken'
const USER_KEY = 'relay.user'

export const tokenStore = {
  access(): string | null {
    return localStorage.getItem(ACCESS_KEY)
  },
  refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY)
  },
  user(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY)
      return raw ? (JSON.parse(raw) as User) : null
    } catch {
      return null
    }
  },
  set(tokens: { accessToken: string; refreshToken: string }, user?: User): void {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken)
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken)
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
  },
}

export const api = axios.create({ baseURL: API_BASE, timeout: 30_000 })

/* Attach the bearer token to every request. */
api.interceptors.request.use((config) => {
  const token = tokenStore.access()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/* Single-flight refresh: concurrent 401s share one refresh call. */
let refreshInflight: Promise<string> | null = null

function refreshAccessToken(refreshToken: string): Promise<string> {
  refreshInflight ??= axios
    .post<LoginResponse>(`${API_BASE}/auth/refresh`, { refreshToken })
    .then((res) => {
      tokenStore.set(res.data, res.data.user)
      return res.data.accessToken
    })
    .finally(() => {
      refreshInflight = null
    })
  return refreshInflight
}

function sessionExpired(): void {
  tokenStore.clear()
  if (!window.location.pathname.startsWith('/login')) {
    window.location.assign('/login')
  }
}

/* On 401: refresh once, retry the original request; on failure → logout. */
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined
    const url = config?.url ?? ''
    if (
      !config ||
      error.response?.status !== 401 ||
      config._retry ||
      url.includes('/auth/login') ||
      url.includes('/auth/refresh')
    ) {
      return Promise.reject(error)
    }
    const refreshToken = tokenStore.refresh()
    if (!refreshToken) {
      sessionExpired()
      return Promise.reject(error)
    }
    config._retry = true
    try {
      const accessToken = await refreshAccessToken(refreshToken)
      config.headers.Authorization = `Bearer ${accessToken}`
      return api(config)
    } catch (refreshError) {
      sessionExpired()
      return Promise.reject(refreshError)
    }
  },
)

/* ── helpers ────────────────────────────────────────────────────────────── */

interface ApiErrorEnvelope {
  error?: { code?: string; message?: string }
}

/** Human-readable message from the backend's `{error:{code,message}}` envelope. */
export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiErrorEnvelope | undefined
    if (data?.error?.message) return data.error.message
    if (err.code === 'ECONNABORTED') return 'The request timed out — is the API running?'
    if (!err.response) return `Cannot reach the API at ${API_BASE} — is the backend running?`
    return err.message
  }
  return err instanceof Error ? err.message : 'Something went wrong'
}

/** Exchange an authenticated session for an expiring signed media URL. */
export async function signMediaUrl(path: string): Promise<string> {
  const { data } = await api.post<{ url: string; expiresAt: string }>('/uploads/signed-url', {
    path,
  })
  return data.url
}

function filenameFromDisposition(disposition: string | undefined, fallback: string): string {
  const match = disposition?.match(/filename="?([^";]+)"?/)
  return match?.[1] ?? fallback
}

/** Download a report (CSV/PDF) as a blob with the auth header attached. */
export async function downloadReport(
  path: string,
  params: Record<string, string>,
  fallbackName: string,
): Promise<void> {
  try {
    const response = await api.get(path, { params, responseType: 'blob' })
    const filename = filenameFromDisposition(
      response.headers['content-disposition'] as string | undefined,
      fallbackName,
    )
    const blobUrl = URL.createObjectURL(response.data as Blob)
    const anchor = document.createElement('a')
    anchor.href = blobUrl
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000)
  } catch (err) {
    /* blob-typed error bodies hide the JSON envelope — decode it */
    if (axios.isAxiosError(err) && err.response?.data instanceof Blob) {
      try {
        const parsed = JSON.parse(await err.response.data.text()) as ApiErrorEnvelope
        throw new Error(parsed.error?.message ?? 'Download failed')
      } catch (inner) {
        if (inner instanceof Error && inner.message !== 'Download failed') throw inner
        throw new Error('Download failed')
      }
    }
    throw err
  }
}
