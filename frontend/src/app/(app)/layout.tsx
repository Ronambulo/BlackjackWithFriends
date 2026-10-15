'use client'

import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useIsAdmin } from '@/admin/useAdmin'
import { LoginScreen } from '@/auth/LoginScreen'
import { rememberInvite } from '@/groups/pendingInvite'
import { useSession } from '@/auth/session-context'
import { MaintenanceScreen } from '@/maintenance/MaintenanceScreen'
import { useMaintenance } from '@/maintenance/useMaintenance'
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

  // Opening an invite signed out: it waits until the player has signed up.
  const signedOut = !loading && !session
  useEffect(() => {
    if (!signedOut || window.location.pathname !== '/grupos/unirse') return
    const codigo = new URLSearchParams(window.location.search).get('codigo')
    if (codigo) rememberInvite(codigo)
  }, [signedOut])

  if (loading) return <Splash />
  if (!session) return <LoginScreen />
  return <SignedIn>{children}</SignedIn>
}

function SignedIn({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation()
  const maintenance = useMaintenance()
  const admin = useIsAdmin()
  const { data: profile, isPending, isError, refetch } = useProfile()

  // The profile's language wins once the player has one (e.g. a new device).
  useEffect(() => {
    if (profile?.nombre && profile.idioma !== i18n.resolvedLanguage) void i18n.changeLanguage(profile.idioma)
  }, [profile?.nombre, profile?.idioma, i18n])

  // Closed for maintenance: admins still get in, to check things before opening again.
  if (maintenance && admin === false) return <MaintenanceScreen maintenance={maintenance} />
  if (isPending || (maintenance && admin === undefined)) return <Splash />
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
