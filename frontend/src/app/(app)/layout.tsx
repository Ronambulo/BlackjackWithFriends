'use client'

import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LoginScreen } from '@/auth/LoginScreen'
import { useSession } from '@/auth/session-context'
import { AppShell } from '@/shell/AppShell'
import { OnboardingScreen } from '@/profile/OnboardingScreen'
import { useProfile } from '@/profile/useProfile'
import { Splash } from '@/ui/Splash'

/**
 * Everything in the app needs a signed-in player with a name. The server only
 * renders the splash; the rest is decided in the browser, where the session lives.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { session, loading } = useSession()
  if (loading) return <Splash />
  if (!session) return <LoginScreen />
  return <SignedIn>{children}</SignedIn>
}

function SignedIn({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation()
  const { data: profile, isPending, isError, refetch } = useProfile()

  // The profile's language wins once the player has one (e.g. a new device).
  useEffect(() => {
    if (profile?.nombre && profile.idioma !== i18n.resolvedLanguage) void i18n.changeLanguage(profile.idioma)
  }, [profile?.nombre, profile?.idioma, i18n])

  if (isPending) return <Splash />
  if (isError) {
    return (
      <main className="card" style={{ maxWidth: 360, margin: '30vh auto 0', textAlign: 'center' }}>
        <p className="muted" style={{ marginBottom: 16 }}>
          {t('common.error')}
        </p>
        <button className="btn btn-secondary" onClick={() => void refetch()}>
          {t('common.retry')}
        </button>
      </main>
    )
  }
  if (!profile.nombre) return <OnboardingScreen />
  return <AppShell profile={profile}>{children}</AppShell>
}
