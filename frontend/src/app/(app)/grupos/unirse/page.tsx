'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { CODE_LENGTH, selectGroup, useInvite, useJoinGroup } from '@/groups/useGroups'
import { currentLanguage } from '@/i18n'
import { ApiError } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { ChevronLeftIcon } from '@/ui/icons'
import styles from '../../pages.module.css'

/** Only the characters an invite code can have; pasted links or spaces are trimmed away. */
function cleanCode(value: string) {
  const match = /[?&]codigo=([^&\s]+)/.exec(value)
  return (match ? match[1] : value).replace(/[^A-Za-z0-9]/g, '').slice(0, CODE_LENGTH)
}

function JoinForm() {
  const { t } = useTranslation()
  const router = useRouter()
  const params = useSearchParams()
  const [code, setCode] = useState(() => cleanCode(params.get('codigo') ?? ''))
  const invite = useInvite(code)
  const joinGroup = useJoinGroup()

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!invite.data) return
    if (invite.data.member) {
      selectGroup(invite.data.id)
      router.push('/ranking')
      return
    }
    joinGroup.mutate(code, { onSuccess: () => router.push('/ranking') })
  }

  const expired = invite.error instanceof ApiError && invite.error.status === 404
  const joinError = joinGroup.error
  return (
    <form className={`card ${styles.form}`} onSubmit={onSubmit}>
      <p className="muted">{t('groups.joinText')}</p>
      <label className="field">
        <span className="field-label">{t('groups.codeLabel')}</span>
        <input
          className={`input ${styles.codeInput}`}
          autoFocus
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Ab3dEf7hJk"
          value={code}
          onChange={(e) => {
            setCode(cleanCode(e.target.value))
            joinGroup.reset()
          }}
        />
      </label>

      {invite.data && (
        <div className={styles.preview}>
          <h2 className="card-title">{invite.data.nombre}</h2>
          <span className="muted">{t('groups.players', { count: invite.data.members })}</span>
          {invite.data.top.map((player, i) => (
            <div key={i} className={styles.previewTop}>
              <span>
                {i + 1}º {player.nombre}
              </span>
              <strong>{formatNumber(player.balance, currentLanguage())}</strong>
            </div>
          ))}
          {invite.data.member && <p className="success-text">{t('groups.alreadyIn')}</p>}
        </div>
      )}
      {expired && (
        <p className="error-text" role="alert">
          {t('groups.expired')}
        </p>
      )}
      {invite.isError && !expired && (
        <p className="error-text" role="alert">
          {t('common.error')}
        </p>
      )}

      <button className="btn btn-primary btn-block" type="submit" disabled={!invite.data || joinGroup.isPending}>
        {joinGroup.isPending
          ? t('groups.joining')
          : invite.data?.member
            ? t('groups.open')
            : t('groups.join', { name: invite.data?.nombre ?? '…' })}
      </button>
      {joinError && (
        <p className="error-text" role="alert">
          {joinError instanceof ApiError && joinError.status === 409
            ? t('groups.full')
            : joinError instanceof ApiError && joinError.status === 404
              ? t('groups.expired')
              : t('common.error')}
        </p>
      )}
    </form>
  )
}

export default function JoinGroupPage() {
  const { t } = useTranslation()
  return (
    <div className={styles.page}>
      <Link href="/" className={styles.back}>
        <ChevronLeftIcon width={20} height={20} />
        {t('common.back')}
      </Link>
      <h1 className={styles.heading}>{t('groups.joinTitle')}</h1>
      {/* The code may come in the link (?codigo=): reading it needs a boundary. */}
      <Suspense>
        <JoinForm />
      </Suspense>
    </div>
  )
}
