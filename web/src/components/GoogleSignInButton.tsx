import { useEffect, useRef, useState } from 'react'
import { useTheme } from '@/lib/theme'

/**
 * "Sign in with Google" via Google Identity Services (GIS).
 *
 * Renders nothing unless VITE_GOOGLE_CLIENT_ID is configured (the GSI script
 * is loaded from index.html; if it can't load — e.g. offline — the button
 * simply doesn't appear). The callback hands the Google ID token (JWT) to the
 * parent; the backend verifies it and maps it to an active RELAY user.
 */

interface GoogleCredentialResponse {
  credential?: string
}

interface GsiButtonConfig {
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  width?: number
}

interface GsiId {
  initialize: (config: { client_id: string; callback: (r: GoogleCredentialResponse) => void }) => void
  renderButton: (parent: HTMLElement, options: GsiButtonConfig) => void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GsiId } }
  }
}

export const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

export default function GoogleSignInButton({
  onCredential,
  disabled,
}: {
  onCredential: (idToken: string) => void
  disabled?: boolean
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const { theme } = useTheme()
  const [scriptReady, setScriptReady] = useState(false)

  // The GSI script is loaded async — poll briefly for it, then give up quietly.
  useEffect(() => {
    if (window.google?.accounts?.id) {
      setScriptReady(true)
      return
    }
    let attempts = 0
    const timer = window.setInterval(() => {
      attempts += 1
      if (window.google?.accounts?.id) {
        setScriptReady(true)
        window.clearInterval(timer)
      } else if (attempts > 40) {
        window.clearInterval(timer)
      }
    }, 250)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const gsi = window.google?.accounts?.id
    const host = ref.current
    if (!scriptReady || !googleClientId || !gsi || !host) return
    gsi.initialize({
      client_id: googleClientId,
      callback: (response) => {
        if (response.credential) onCredential(response.credential)
      },
    })
    host.innerHTML = ''
    gsi.renderButton(host, {
      theme: theme === 'dark' ? 'filled_black' : 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      width: 384,
    })
  }, [scriptReady, theme, onCredential])

  if (!googleClientId) return null

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className={disabled ? 'pointer-events-none opacity-50' : undefined}>
        <div ref={ref} className="flex justify-center" />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Use the Google account that matches your RELAY email.
      </p>
    </div>
  )
}
