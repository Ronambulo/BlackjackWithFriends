'use client'

import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { currentLanguage } from '@/i18n'
import styles from './OnboardingScreen.module.css'
import { isValidName, NAME_MAX, useUpdateProfile } from './useProfile'

/** First screen after the first sign in: the name friends will see in the league. */
export function OnboardingScreen() {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const update = useUpdateProfile()

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!isValidName(name)) return
    update.mutate({ nombre: name.trim(), idioma: currentLanguage() })
  }

  return (
    <main className={styles.screen}>
      <form className={styles.form} onSubmit={onSubmit}>
        <h1 className={styles.title}>{t('onboarding.title')}</h1>
        <p className="muted">{t('onboarding.subtitle')}</p>

        <label className="field">
          <span className="field-label">{t('onboarding.nameLabel')}</span>
          <input
            className="input"
            autoComplete="nickname"
            autoFocus
            maxLength={NAME_MAX}
            placeholder={t('onboarding.namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <span className={`muted ${styles.hint}`}>{t('onboarding.nameHint')}</span>
        </label>

        {update.isError && (
          <p className="error-text" role="alert">
            {t('common.error')}
          </p>
        )}
        <button className="btn btn-primary btn-block" type="submit" disabled={!isValidName(name) || update.isPending}>
          {update.isPending ? t('common.saving') : t('onboarding.submit')}
        </button>
      </form>
    </main>
  )
}
