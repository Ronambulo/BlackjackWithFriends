'use client'

import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { useCurrentGroup } from '@/groups/useGroups'
import { currentLanguage, LANGUAGES, type Language } from '@/i18n'
import { authClient } from '@/lib/auth-client'
import { isValidName, NAME_MAX, useProfile, useUpdateProfile } from '@/profile/useProfile'
import { Avatar } from '@/ui/Avatar'
import { ChevronLeftIcon, ChevronRightIcon } from '@/ui/icons'
import styles from '../pages.module.css'

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const user = useUser()
  const { data: profile } = useProfile()
  const updateName = useUpdateProfile()
  const updateLanguage = useUpdateProfile()
  const group = useCurrentGroup()
  // The (app) layout only renders this once the profile is loaded.
  const [name, setName] = useState(profile?.nombre ?? '')
  const [editing, setEditing] = useState(false)
  const handle = user.displayUsername ?? user.username

  const nameChanged = name.trim() !== (profile?.nombre ?? '')

  function onSaveName(event: FormEvent) {
    event.preventDefault()
    if (!isValidName(name) || !nameChanged) return
    updateName.mutate({ nombre: name.trim() }, { onSuccess: () => setEditing(false) })
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
      <div className={styles.titleRow}>
        <Link href="/perfil" className={styles.backButton} aria-label={t('common.back')}>
          <ChevronLeftIcon width={22} height={22} />
        </Link>
        <h1 className={styles.title}>{t('settings.title')}</h1>
      </div>

      <section className={styles.group}>
        <h2 className="label">{t('settings.account')}</h2>
        <div className={styles.list}>
          <div className={styles.listRow}>
            <Avatar seed={user.id} name={profile?.nombre ?? ''} size={40} />
            <span className={styles.listText}>
              {profile?.nombre}
              {handle && <small>@{handle}</small>}
            </span>
            <button
              className={styles.listAction}
              type="button"
              aria-expanded={editing}
              onClick={() => {
                setEditing((value) => !value)
                setName(profile?.nombre ?? '')
                updateName.reset()
              }}
            >
              {editing ? t('common.cancel') : t('settings.edit')}
            </button>
          </div>
          {editing && (
            <form className={`${styles.listRow} ${styles.listForm}`} onSubmit={onSaveName}>
              <label className="field">
                <span className="field-label">{t('settings.name')}</span>
                <div className={styles.formRow}>
                  <input
                    className="input"
                    autoComplete="nickname"
                    autoFocus
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
              {updateName.isError && (
                <p className="error-text" role="alert">
                  {t('common.error')}
                </p>
              )}
            </form>
          )}
        </div>
      </section>

      <section className={styles.group}>
        <h2 className="label">{t('settings.general')}</h2>
        <div className={styles.list}>
          <div className={`${styles.listRow} ${styles.listForm}`}>
            <span className={styles.listText}>{t('settings.language')}</span>
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
          {group && (
            <Link className={styles.listRow} href={`/grupos/${group.id}`}>
              <span className={styles.listText}>
                {t('settings.group')}
                <small>{t('settings.groupHint', { name: group.nombre })}</small>
              </span>
              <ChevronRightIcon className={styles.chevron} width={18} height={18} />
            </Link>
          )}
        </div>
      </section>

      <button className="btn btn-danger btn-block" onClick={() => void onSignOut()}>
        {t('settings.signOut')}
      </button>
    </div>
  )
}
