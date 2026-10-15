'use client'

import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { currentLanguage, LANGUAGES } from '@/i18n'
import { authClient } from '@/lib/auth-client'
import styles from './LoginScreen.module.css'

type Mode = 'signIn' | 'signUp'

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,20}$/
const PASSWORD_MIN = 8

type AuthError = { status?: number; code?: string } | null

function errorKey(error: AuthError, mode: Mode) {
  if (error?.status === 429) return 'login.errors.rateLimit' as const
  if (error?.code === 'USERNAME_IS_ALREADY_TAKEN' || error?.code === 'USER_ALREADY_EXISTS') {
    return 'login.errors.taken' as const
  }
  if (error?.code === 'INVALID_USERNAME_OR_PASSWORD') return 'login.errors.wrongCredentials' as const
  if (error?.status === 401) return mode === 'signIn' ? ('login.errors.wrongCredentials' as const) : ('common.error' as const)
  return 'common.error' as const
}

/**
 * Better Auth needs an email for every account, so each player gets a made-up one
 * built from their username. Nothing is ever sent to it.
 */
function placeholderEmail(username: string) {
  return `${username.toLowerCase()}@jugadores.blackjack.invalid`
}

/** Classic sign in and sign up with a username and a password. */
export function LoginScreen() {
  const { t, i18n } = useTranslation()
  const [mode, setMode] = useState<Mode>('signIn')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setConfirm('')
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const name = username.trim()
    if (mode === 'signUp') {
      if (!USERNAME_RE.test(name)) return setError(t('login.errors.invalidUsername'))
      if (password.length < PASSWORD_MIN) return setError(t('login.errors.shortPassword'))
      if (password !== confirm) return setError(t('login.errors.mismatch'))
    }
    setBusy(true)
    setError(null)
    // On success the session store updates and SessionProvider swaps this screen out.
    const { error: authError } =
      mode === 'signIn'
        ? await authClient.signIn.username({ username: name, password })
        : await authClient.signUp.email({ email: placeholderEmail(name), name, username: name, password })
    if (authError) {
      setBusy(false)
      return setError(t(errorKey(authError, mode)))
    }
    // Signed in, but the browser didn't keep the cookie (blocked, or another address
    // than the app's): say so instead of coming back to this same screen.
    const { data } = await authClient.getSession({ query: { disableCookieCache: true } })
    setBusy(false)
    if (!data) setError(t('login.errors.noSession'))
  }

  const language = currentLanguage()
  const signUp = mode === 'signUp'
  const canSubmit = username.trim().length > 0 && password.length > 0 && (!signUp || confirm.length > 0)

  return (
    <main className={styles.screen}>
      <div className={styles.languages} role="group" aria-label="Idioma / Language">
        {LANGUAGES.map(({ code: lng }) => (
          <button
            key={lng}
            type="button"
            aria-pressed={language === lng}
            onClick={() => void i18n.changeLanguage(lng)}
          >
            {lng.toUpperCase()}
          </button>
        ))}
      </div>

      <header className={styles.hero}>
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny local SVG */}
        <img className={styles.logo} src="/icon.svg" alt="" width={84} height={84} />
        <h1 className={styles.title}>Blackjack with Friends</h1>
        <p className="muted">{t('login.tagline')}</p>
      </header>

      <form className={`card ${styles.form}`} onSubmit={onSubmit} noValidate>
        <div className={styles.modes} role="tablist">
          <button type="button" role="tab" aria-selected={!signUp} onClick={() => switchMode('signIn')}>
            {t('login.signIn')}
          </button>
          <button type="button" role="tab" aria-selected={signUp} onClick={() => switchMode('signUp')}>
            {t('login.signUp')}
          </button>
        </div>

        <label className="field">
          <span className="field-label">{t('login.usernameLabel')}</span>
          <input
            className="input"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={20}
            placeholder={t('login.usernamePlaceholder')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          {signUp && <span className={`muted ${styles.hint}`}>{t('login.usernameHint')}</span>}
        </label>

        <label className="field">
          <span className="field-label">{t('login.passwordLabel')}</span>
          <input
            className="input"
            type="password"
            name="password"
            autoComplete={signUp ? 'new-password' : 'current-password'}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {signUp && <span className={`muted ${styles.hint}`}>{t('login.passwordHint')}</span>}
        </label>

        {signUp && (
          <label className="field">
            <span className="field-label">{t('login.confirmLabel')}</span>
            <input
              className="input"
              type="password"
              name="confirm"
              autoComplete="new-password"
              maxLength={128}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
        )}

        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy || !canSubmit}>
          {busy ? t('login.busy') : signUp ? t('login.createAccount') : t('login.submit')}
        </button>
      </form>
    </main>
  )
}
