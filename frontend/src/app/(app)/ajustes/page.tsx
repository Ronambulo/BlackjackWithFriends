'use client'

import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { currentLanguage, LANGUAGES, type Language } from '@/i18n'
import { authClient } from '@/lib/auth-client'
import { isValidName, NAME_MAX, useProfile, useUpdateProfile } from '@/profile/useProfile'
import { ChevronLeftIcon } from '@/ui/icons'
import styles from '../pages.module.css'

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { data: profile } = useProfile()
  const updateName = useUpdateProfile()
  const updateLanguage = useUpdateProfile()
  // The (app) layout only renders this once the profile is loaded.
  const [name, setName] = useState(profile?.nombre ?? '')

  const nameChanged = name.trim() !== (profile?.nombre ?? '')

  function onSaveName(event: FormEvent) {
    event.preventDefault()
    if (!isValidName(name) || !nameChanged) return
    updateName.mutate({ nombre: name.trim() })
  }

  function onLanguage(language: Language) {
    void i18n.changeLanguage(language)
    updateLanguage.mutate({ idioma: language })
  }

  async function onSignOut() {
    await authClient.signOut()
    queryClient.clear()
  }

  const language = currentLanguage()

  return (
    <div className={styles.page}>
      <Link href="/perfil" className={styles.back}>
        <ChevronLeftIcon width={20} height={20} />
        {t('common.back')}
      </Link>
      <h1 className={styles.heading}>{t('settings.title')}</h1>

      <section className={`card ${styles.section}`}>
        <h2 className="card-title">{t('settings.account')}</h2>
        <form className={styles.form} onSubmit={onSaveName}>
          <label className="field">
            <span className="field-label">{t('settings.name')}</span>
            <div className={styles.formRow}>
              <input
                className="input"
                autoComplete="nickname"
                maxLength={NAME_MAX}
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  updateName.reset()
                }}
              />
              <button
                className="btn btn-primary"
                type="submit"
                disabled={!isValidName(name) || !nameChanged || updateName.isPending}
              >
                {updateName.isPending ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </label>
          {updateName.isSuccess && <p className="success-text">{t('common.saved')}</p>}
          {updateName.isError && (
            <p className="error-text" role="alert">
              {t('common.error')}
            </p>
          )}
        </form>

        <div className="field">
          <span className="field-label">{t('settings.language')}</span>
          <div className="segmented" role="group" aria-label={t('settings.language')}>
            {LANGUAGES.map(({ code, label }) => (
              <button key={code} type="button" aria-pressed={language === code} onClick={() => onLanguage(code)}>
                {label}
              </button>
            ))}
          </div>
          {updateLanguage.isError && (
            <p className="error-text" role="alert">
              {t('common.error')}
            </p>
          )}
        </div>
      </section>

      <button className="btn btn-danger btn-block" onClick={() => void onSignOut()}>
        {t('settings.signOut')}
      </button>
    </div>
  )
}
