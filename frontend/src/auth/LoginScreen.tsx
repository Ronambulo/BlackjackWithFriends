'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { currentLanguage, LANGUAGES } from '@/i18n'
import { authClient } from '@/lib/auth-client'
import { MailIcon } from '@/ui/icons'
import styles from './LoginScreen.module.css'

const RESEND_SECONDS = 60
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Step = { name: 'email' } | { name: 'code'; email: string }

type AuthError = { status?: number; code?: string } | null

function errorKey(error: AuthError, fallback: 'common.error' | 'login.errors.invalidCode') {
  if (error?.status === 429) return 'login.errors.rateLimit' as const
  if (error?.code === 'TOO_MANY_ATTEMPTS') return 'login.errors.tooManyAttempts' as const
  return fallback
}

/** Email-only sign in: the backend emails a 6-digit code (Better Auth email OTP). */
export function LoginScreen() {
  const { t, i18n } = useTranslation()
  const [step, setStep] = useState<Step>({ name: 'email' })
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  async function sendEmail(address: string) {
    // x-lang picks the language of the email.
    const { error } = await authClient.emailOtp.sendVerificationOtp(
      { email: address, type: 'sign-in' },
      { headers: { 'x-lang': currentLanguage() } },
    )
    return error
  }

  async function onSubmitEmail(event: FormEvent) {
    event.preventDefault()
    const address = email.trim().toLowerCase()
    if (!EMAIL_RE.test(address)) {
      setError(t('login.errors.invalidEmail'))
      return
    }
    setBusy(true)
    setError(null)
    const sendError = await sendEmail(address)
    setBusy(false)
    if (sendError) {
      setError(t(errorKey(sendError, 'common.error')))
      return
    }
    setStep({ name: 'code', email: address })
    setCode('')
    setNotice(null)
    setCooldown(RESEND_SECONDS)
  }

  async function onSubmitCode(event: FormEvent) {
    event.preventDefault()
    if (step.name !== 'code') return
    setBusy(true)
    setError(null)
    const { error: verifyError } = await authClient.signIn.emailOtp({ email: step.email, otp: code.trim() })
    setBusy(false)
    // On success the session store updates and SessionProvider swaps this screen out.
    if (verifyError) setError(t(errorKey(verifyError, 'login.errors.invalidCode')))
  }

  async function onResend() {
    if (step.name !== 'code' || cooldown > 0) return
    setBusy(true)
    setError(null)
    setNotice(null)
    const sendError = await sendEmail(step.email)
    setBusy(false)
    if (sendError) {
      setError(t(errorKey(sendError, 'common.error')))
      return
    }
    setNotice(t('login.resent'))
    setCooldown(RESEND_SECONDS)
  }

  const language = currentLanguage()

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

      {step.name === 'email' ? (
        <form className={`card ${styles.form}`} onSubmit={onSubmitEmail} noValidate>
          <label className="field">
            <span className="field-label">{t('login.emailLabel')}</span>
            <input
              className="input"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={t('login.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy || !email.trim()}>
            {busy ? t('login.sending') : t('login.submit')}
          </button>
          <p className={`muted ${styles.small}`}>{t('login.noPassword')}</p>
        </form>
      ) : (
        <form className={`card ${styles.form}`} onSubmit={onSubmitCode} noValidate>
          <div className={styles.inboxIcon}>
            <MailIcon />
          </div>
          <h2 className={styles.subtitle}>{t('login.checkInbox')}</h2>
          <p className="muted">
            <Trans i18nKey="login.sentTo" values={{ email: step.email }} components={{ b: <strong /> }} />
          </p>

          <label className="field">
            <span className="field-label">{t('login.codeLabel')}</span>
            <input
              className={`input ${styles.code}`}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </label>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          {notice && <p className="success-text">{notice}</p>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy || code.length < 6}>
            {busy ? t('login.verifying') : t('login.verify')}
          </button>

          <div className={styles.links}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setStep({ name: 'email' })
                setError(null)
                setNotice(null)
              }}
            >
              {t('login.changeEmail')}
            </button>
            <button type="button" className="btn btn-ghost" disabled={busy || cooldown > 0} onClick={onResend}>
              {cooldown > 0 ? t('login.resendIn', { seconds: cooldown }) : t('login.resend')}
            </button>
          </div>
        </form>
      )}
    </main>
  )
}
