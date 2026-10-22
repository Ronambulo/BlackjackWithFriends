'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { currentLanguage, LANGUAGES, type Language } from '@/i18n'
import { authClient } from '@/lib/auth-client'
import { AvatarPicker } from '@/profile/AvatarPicker'
import { usePhotoPicker } from '@/profile/usePhotoPicker'
import { forgetDevice, PUSH_KINDS, usePush, usePushPrefs, useTestPush, useUpdatePushPrefs } from '@/push/usePush'
import { api, ApiError } from '@/lib/api'
import { lastScreen } from '@/shell/lastScreen'
import {
  isValidName,
  isValidUsername,
  NAME_MAX,
  USERNAME_MAX,
  useProfile,
  useUpdateProfile,
  useUpdateUsername,
} from '@/profile/useProfile'
import { setSoundsOn, useSoundsOn } from '@/sound/sounds'
import { ChevronLeftIcon, ChevronRightIcon } from '@/ui/icons'
import styles from '../pages.module.css'

export default function SettingsPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const user = useUser()
  const { data: profile } = useProfile()
  const updateName = useUpdateProfile()
  const updateLanguage = useUpdateProfile()
  const photo = usePhotoPicker()
  const soundsOn = useSoundsOn()
  const push = usePush()
  const { data: pushPrefs } = usePushPrefs()
  const updatePushPrefs = useUpdatePushPrefs()
  const testPush = useTestPush()
  // The (app) layout only renders this once the profile is loaded.
  const [name, setName] = useState(profile?.nombre ?? '')
  const [editing, setEditing] = useState(false)
  const handle = user.displayUsername ?? user.username
  const updateUsername = useUpdateUsername()
  const [username, setUsername] = useState(handle ?? '')

  const nameChanged = name.trim() !== (profile?.nombre ?? '')
  const usernameChanged = username.trim().replace(/^@/, '') !== (handle ?? '')
  // A username can change once every 30 days; until then the field waits.
  const usernameFreeAt = profile?.usuario_cambiable_desde ?? null
  const usernameWaits = usernameFreeAt !== null && usernameFreeAt > Date.now()
  const [reporting, setReporting] = useState(false)
  const [report, setReport] = useState('')
  const sendReport = useMutation({
    mutationFn: (texto: string) => api('/reports', { method: 'POST', body: { texto, ruta: lastScreen() } }),
    onSuccess: () => setReport(''),
  })

  function onSaveName(event: FormEvent) {
    event.preventDefault()
    if (!isValidName(name) || !nameChanged) return
    updateName.mutate({ nombre: name.trim() }, { onSuccess: () => setEditing(false) })
  }

  function onSaveUsername(event: FormEvent) {
    event.preventDefault()
    if (!isValidUsername(username) || !usernameChanged) return
    updateUsername.mutate(username.trim().replace(/^@/, ''), { onSuccess: () => setEditing(false) })
  }

  const usernameError =
    updateUsername.error instanceof ApiError && updateUsername.error.status === 409
      ? t('settings.usernameTaken')
      : updateUsername.error instanceof ApiError && updateUsername.error.status === 403
        ? t('settings.usernameLocked')
        : updateUsername.error instanceof ApiError && updateUsername.error.status === 429
          ? t('settings.usernameTooSoon')
          : t('common.error')

  function onLanguage(language: Language) {
    void i18n.changeLanguage(language)
    updateLanguage.mutate({ idioma: language })
  }

  async function onSignOut() {
    await forgetDevice()
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
            <AvatarPicker size={40} />
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
                setUsername(handle ?? '')
                updateName.reset()
                updateUsername.reset()
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
          {editing && (
            <form className={`${styles.listRow} ${styles.listForm}`} onSubmit={onSaveUsername}>
              <label className="field">
                <span className="field-label">{t('settings.username')}</span>
                <div className={styles.formRow}>
                  <input
                    className="input"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={USERNAME_MAX + 1}
                    disabled={usernameWaits}
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value)
                      updateUsername.reset()
                    }}
                  />
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={usernameWaits || !isValidUsername(username) || !usernameChanged || updateUsername.isPending}
                  >
                    {updateUsername.isPending ? t('common.saving') : t('common.save')}
                  </button>
                </div>
                <small className={styles.fieldHint}>
                  {usernameWaits
                    ? t('settings.usernameWaitUntil', {
                        date: new Intl.DateTimeFormat(language, { day: 'numeric', month: 'long' }).format(usernameFreeAt),
                      })
                    : `${t('settings.usernameHint')} ${t('settings.usernameWait')}`}
                </small>
              </label>
              {updateUsername.isError && (
                <p className="error-text" role="alert">
                  {usernameError}
                </p>
              )}
              <div className={styles.photoRow}>
                <button className="btn btn-secondary" type="button" onClick={photo.pick} disabled={photo.avatar.isPending}>
                  {photo.avatar.isPending ? t('common.saving') : t('settings.changePhoto')}
                </button>
                {profile?.avatar_url && (
                  <button className="btn btn-ghost" type="button" onClick={photo.remove} disabled={photo.avatar.isPending}>
                    {t('settings.removePhoto')}
                  </button>
                )}
                {photo.field}
              </div>
              {photo.avatar.isError && (
                <p className="error-text" role="alert">
                  {t('settings.photoError')}
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
          <div className={styles.listRow}>
            <span className={styles.listText} id="sounds">
              {t('settings.sounds')}
              <small>{t('settings.soundsHint')}</small>
            </span>
            <button
              className="switch"
              type="button"
              role="switch"
              aria-checked={soundsOn}
              aria-labelledby="sounds"
              onClick={() => setSoundsOn(!soundsOn)}
            />
          </div>
        </div>
      </section>

      <section className={styles.group}>
        <h2 className="label">{t('settings.notifications')}</h2>
        <div className={styles.list}>
          <div className={styles.listRow}>
            <span className={styles.listText} id="push">
              {t('settings.push')}
              {push.state !== 'loading' && <small className={styles.wrap}>{t(`settings.pushState.${push.state}`)}</small>}
            </span>
            {(push.state === 'on' || push.state === 'off') && (
              <button
                className="switch"
                type="button"
                role="switch"
                aria-checked={push.state === 'on'}
                aria-labelledby="push"
                disabled={push.busy}
                onClick={() => void push.toggle()}
              />
            )}
          </div>
          {push.problem && (
            <p className={`error-text ${styles.listRow}`} role="alert">
              {push.problem.kind === 'dismissed' ? t('settings.pushDismissed') : t('settings.pushError')}
              {push.problem.detail && <small> ({push.problem.detail})</small>}
            </p>
          )}
          {push.state === 'on' && (
            <div className={styles.listRow}>
              <span className={styles.listText}>
                {t('settings.pushTest')}
                {testPush.data && (
                  <small className={styles.wrap}>
                    {testPush.data.devices === 0
                      ? t('settings.pushTestNone')
                      : testPush.data.failed.length > 0
                        ? t('settings.pushTestFailed', { reason: testPush.data.failed.join(', ') })
                        : t('settings.pushTestSent', { count: testPush.data.devices })}
                  </small>
                )}
                {testPush.isError && <small className={`${styles.wrap} error-text`}>{t('common.error')}</small>}
              </span>
              <button className="btn btn-ghost" type="button" disabled={testPush.isPending} onClick={() => testPush.mutate()}>
                {t('settings.pushTestSend')}
              </button>
            </div>
          )}
          {pushPrefs &&
            PUSH_KINDS.map((kind) => (
              <div key={kind} className={styles.listRow}>
                <span className={styles.listText} id={`push-${kind}`}>
                  {t(`settings.pushKinds.${kind}.name`)}
                  <small className={styles.wrap}>{t(`settings.pushKinds.${kind}.hint`)}</small>
                </span>
                <button
                  className="switch"
                  type="button"
                  role="switch"
                  aria-checked={pushPrefs[kind]}
                  aria-labelledby={`push-${kind}`}
                  onClick={() => updatePushPrefs.mutate({ [kind]: !pushPrefs[kind] })}
                />
              </div>
            ))}
        </div>
      </section>

      <section className={styles.group}>
        <h2 className="label">{t('settings.help')}</h2>
        <div className={styles.list}>
          <Link className={styles.listRow} href="/novedades">
            <span className={styles.listText}>
              {t('whatsNew.title')}
              <small>{t('settings.whatsNewHint')}</small>
            </span>
            <ChevronRightIcon className={styles.chevron} width={18} height={18} />
          </Link>
          <button
            className={styles.listRow}
            type="button"
            aria-expanded={reporting}
            onClick={() => {
              setReporting((value) => !value)
              sendReport.reset()
            }}
          >
            <span className={styles.listText}>
              {t('settings.report')}
              <small className={styles.wrap}>{t('settings.reportHint')}</small>
            </span>
            <ChevronRightIcon
              className={styles.chevron}
              width={18}
              height={18}
              style={{ transform: reporting ? 'rotate(90deg)' : undefined }}
            />
          </button>
          {reporting && (
            <form
              className={`${styles.listRow} ${styles.listForm}`}
              onSubmit={(event) => {
                event.preventDefault()
                if (report.trim().length >= 5) sendReport.mutate(report.trim())
              }}
            >
              {sendReport.isSuccess ? (
                <p className="success-text" role="status">
                  {t('settings.reportThanks')}
                </p>
              ) : (
                <>
                  <label className="field">
                    <span className="field-label">{t('settings.reportLabel')}</span>
                    <textarea
                      className={`input ${styles.reportText}`}
                      maxLength={1000}
                      placeholder={t('settings.reportPlaceholder')}
                      value={report}
                      onChange={(e) => {
                        setReport(e.target.value)
                        sendReport.reset()
                      }}
                    />
                  </label>
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={report.trim().length < 5 || sendReport.isPending}
                  >
                    {sendReport.isPending ? t('common.sending') : t('settings.reportSend')}
                  </button>
                  {sendReport.isError && (
                    <p className="error-text" role="alert">
                      {sendReport.error instanceof ApiError && sendReport.error.status === 429
                        ? t('settings.reportTooMany')
                        : t('common.error')}
                    </p>
                  )}
                </>
              )}
            </form>
          )}
        </div>
      </section>

      <button className="btn btn-danger btn-block" onClick={() => void onSignOut()}>
        {t('settings.signOut')}
      </button>
    </div>
  )
}
