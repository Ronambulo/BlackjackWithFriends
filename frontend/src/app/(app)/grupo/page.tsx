'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import {
  GROUP_NAME_MAX,
  GROUP_NAME_MIN,
  useCurrentGroup,
  useGroup,
  useGroups,
  useKickMember,
  useLeaveGroup,
  useRenewCode,
  useUpdateGroup,
  type Group,
} from '@/groups/useGroups'
import { ChevronLeftIcon, ShareIcon } from '@/ui/icons'
import styles from '../pages.module.css'

function inviteLink(code: string) {
  return `${window.location.origin}/grupos/unirse?codigo=${encodeURIComponent(code)}`
}

function InviteCard({ group }: { group: Group }) {
  const { t } = useTranslation()
  const renew = useRenewCode()
  const [copied, setCopied] = useState(false)
  const admin = group.rol === 'admin'

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(group.codigo)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // No clipboard access: the code can still be selected by hand.
    }
  }

  async function onShare() {
    const text = t('groupSettings.shareText', { name: group.nombre, code: group.codigo })
    try {
      await navigator.share({ text, url: inviteLink(group.codigo) })
    } catch {
      // Cancelled by the player.
    }
  }

  const canShare = typeof navigator !== 'undefined' && 'share' in navigator
  return (
    <section className={`card ${styles.section}`}>
      <h2 className="card-title">{t('groupSettings.invite')}</h2>
      <p className="muted">{t('groupSettings.inviteText')}</p>
      <p className={styles.code}>{group.codigo}</p>
      <div className={styles.actions}>
        <button className="btn btn-secondary" type="button" onClick={() => void onCopy()}>
          {copied ? t('groupSettings.copied') : t('groupSettings.copy')}
        </button>
        {canShare && (
          <button className="btn btn-primary" type="button" onClick={() => void onShare()}>
            <ShareIcon width={18} height={18} />
            {t('groupSettings.share')}
          </button>
        )}
      </div>
      {admin && (
        <button
          className="btn btn-ghost"
          type="button"
          disabled={renew.isPending}
          onClick={() => {
            if (window.confirm(t('groupSettings.renewConfirm'))) renew.mutate(group.id)
          }}
        >
          {t('groupSettings.renew')}
        </button>
      )}
      {renew.isError && (
        <p className="error-text" role="alert">
          {t('common.error')}
        </p>
      )}
    </section>
  )
}

function AdminCard({ group }: { group: Group }) {
  const { t } = useTranslation()
  const rename = useUpdateGroup()
  const toggle = useUpdateGroup()
  const [name, setName] = useState(group.nombre)

  const trimmed = name.trim()
  const valid = trimmed.length >= GROUP_NAME_MIN && trimmed.length <= GROUP_NAME_MAX
  const changed = trimmed !== group.nombre

  function onRename(event: FormEvent) {
    event.preventDefault()
    if (valid && changed) rename.mutate({ id: group.id, nombre: trimmed })
  }

  return (
    <section className={`card ${styles.section}`}>
      <h2 className="card-title">{t('settings.group')}</h2>
      <form className={styles.form} onSubmit={onRename}>
        <label className="field">
          <span className="field-label">{t('groupSettings.name')}</span>
          <div className={styles.formRow}>
            <input
              className="input"
              maxLength={GROUP_NAME_MAX}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                rename.reset()
              }}
            />
            <button className="btn btn-primary" type="submit" disabled={!valid || !changed || rename.isPending}>
              {rename.isPending ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </label>
        {rename.isSuccess && <p className="success-text">{t('common.saved')}</p>}
      </form>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={group.ajustes.ocultarRanking}
          disabled={toggle.isPending}
          onChange={(e) => toggle.mutate({ id: group.id, ocultarRanking: e.target.checked })}
        />
        <span>{t('groupSettings.hideRanking')}</span>
      </label>
      {(rename.isError || toggle.isError) && (
        <p className="error-text" role="alert">
          {t('common.error')}
        </p>
      )}
    </section>
  )
}

function MembersCard({ group }: { group: Group }) {
  const { t } = useTranslation()
  const me = useUser()
  const kick = useKickMember()
  const admin = group.rol === 'admin'
  return (
    <section className={`card ${styles.section}`}>
      <h2 className="card-title">
        {t('groupSettings.members')} · {group.ranking.length}
      </h2>
      <ul className={styles.members}>
        {group.ranking.map((member) => (
          <li key={member.userId} className={styles.member}>
            <span className={styles.memberName}>
              {member.userId === me.id ? `${member.nombre} · ${t('ranking.you')}` : member.nombre}
              {member.rol === 'admin' && <span className={styles.badge}>{t('groupSettings.admin')}</span>}
            </span>
            {admin && member.userId !== me.id && (
              <button
                className="btn btn-ghost"
                type="button"
                disabled={kick.isPending}
                onClick={() => {
                  if (window.confirm(t('groupSettings.kickConfirm', { name: member.nombre })))
                    kick.mutate({ id: group.id, userId: member.userId })
                }}
              >
                {t('groupSettings.kick')}
              </button>
            )}
          </li>
        ))}
      </ul>
      {!admin && <p className="muted">{t('groupSettings.onlyAdmin')}</p>}
      {kick.isError && (
        <p className="error-text" role="alert">
          {t('common.error')}
        </p>
      )}
    </section>
  )
}

export default function GroupSettingsPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const groups = useGroups()
  const current = useCurrentGroup()
  const { data: group, isError, refetch } = useGroup(current?.id)
  const leave = useLeaveGroup()

  // Without groups there's nothing to set up.
  useEffect(() => {
    if (groups.data?.length === 0 && !leave.isPending) router.replace('/')
  }, [groups.data, leave.isPending, router])

  return (
    <div className={styles.page}>
      <Link href="/ranking" className={styles.back}>
        <ChevronLeftIcon width={20} height={20} />
        {t('common.back')}
      </Link>
      <h1 className={styles.heading}>{group?.nombre ?? t('groupSettings.title')}</h1>

      {isError && (
        <section className="card">
          <p className="muted">{t('common.error')}</p>
          <button className="btn btn-secondary" onClick={() => void refetch()}>
            {t('common.retry')}
          </button>
        </section>
      )}

      {group && (
        <>
          <InviteCard group={group} />
          {/* Keyed so a rename elsewhere, or another group, starts the form afresh. */}
          {group.rol === 'admin' && <AdminCard key={`${group.id}:${group.nombre}`} group={group} />}
          <MembersCard group={group} />
          <button
            className="btn btn-danger btn-block"
            disabled={leave.isPending}
            onClick={() => {
              if (!window.confirm(t('groupSettings.leaveConfirm', { name: group.nombre }))) return
              leave.mutate(group.id, { onSuccess: () => router.push('/') })
            }}
          >
            {t('groupSettings.leave')}
          </button>
          {leave.isError && (
            <p className="error-text" role="alert">
              {t('common.error')}
            </p>
          )}
        </>
      )}
    </div>
  )
}
