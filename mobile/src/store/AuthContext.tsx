import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/endpoints';
import { setApiTokens, setSessionExpiredHandler } from '../lib/api';
import { registerPushToken } from '../lib/push';
import { clearTokens, loadTokens, persistTokens } from '../lib/session';
import type { AuthSession, User } from '../types';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  signIn: (identifier: string, password: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  // Refresh reuse / expiry → drop the session, navigator returns to Login.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setStatus('signedOut');
    });
    return () => setSessionExpiredHandler(null);
  }, []);

  // Boot: hydrate tokens from SecureStore and verify them with GET /auth/me.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { accessToken, refreshToken } = await loadTokens();
        if (!accessToken || !refreshToken) {
          if (!cancelled) setStatus('signedOut');
          return;
        }
        setApiTokens(accessToken, refreshToken);
        const me = await authApi.me(); // interceptor refreshes transparently if expired
        if (!cancelled) {
          setUser(me);
          setStatus('signedIn');
          void registerPushToken();
        }
      } catch {
        setApiTokens(null, null);
        await clearTokens();
        if (!cancelled) setStatus('signedOut');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Applies a session (password or Google) identically. */
  const applySession = useCallback(async (session: AuthSession) => {
    setApiTokens(session.accessToken, session.refreshToken);
    await persistTokens(session.accessToken, session.refreshToken);
    setUser(session.user);
    setStatus('signedIn');
    void registerPushToken(); // best-effort, never blocks login
  }, []);

  const signIn = useCallback(
    async (identifier: string, password: string) => {
      await applySession(await authApi.login(identifier, password));
    },
    [applySession],
  );

  const signInWithGoogle = useCallback(
    async (idToken: string) => {
      await applySession(await authApi.googleLogin(idToken));
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    try {
      const { refreshToken } = await loadTokens();
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      // Server may be unreachable — local sign-out must still work.
    }
    setApiTokens(null, null);
    await clearTokens();
    setUser(null);
    setStatus('signedOut');
  }, []);

  const value = useMemo(
    () => ({ status, user, signIn, signInWithGoogle, signOut }),
    [status, user, signIn, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
