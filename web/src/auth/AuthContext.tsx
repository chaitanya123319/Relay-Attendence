import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, tokenStore } from '../lib/api'
import type { LoginResponse, User } from '../lib/types'

interface AuthContextValue {
  user: User | null
  /** True until the stored session has been validated against GET /auth/me. */
  ready: boolean
  login: (identifier: string, password: string) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => tokenStore.user())
  const [ready, setReady] = useState(false)

  /* Validate the stored session once on boot (refresh-on-401 handled by the axios layer). */
  useEffect(() => {
    let cancelled = false
    async function restore(): Promise<void> {
      const access = tokenStore.access()
      const refresh = tokenStore.refresh()
      if (!access || !refresh) {
        tokenStore.clear()
        if (!cancelled) setReady(true)
        return
      }
      try {
        const { data } = await api.get<User>('/auth/me')
        if (!cancelled) {
          setUser(data)
          tokenStore.set({ accessToken: access, refreshToken: refresh }, data)
        }
      } catch {
        if (!cancelled) setUser(tokenStore.access() ? tokenStore.user() : null)
      } finally {
        if (!cancelled) setReady(true)
      }
    }
    void restore()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (identifier: string, password: string): Promise<User> => {
    const { data } = await api.post<LoginResponse>('/auth/login', { identifier, password })
    tokenStore.set(data, data.user)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async (): Promise<void> => {
    const refreshToken = tokenStore.refresh()
    try {
      if (refreshToken) await api.post('/auth/logout', { refreshToken })
    } catch {
      /* best-effort revoke — the local session is cleared regardless */
    }
    tokenStore.clear()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, ready, login, logout }),
    [user, ready, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
