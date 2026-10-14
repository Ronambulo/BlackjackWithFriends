'use client'

import { useState, type FormEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { InviteQr } from '@/groups/InviteQr'
import { inviteLink } from '@/groups/pendingInvite'
import {
  GROUP_NAME_MAX,
  GROUP_NAME_MIN,
  useKickMember,
  useRenewCode,
  useUpdateGroup,
  type Group,
  type RankedMember,
} from '@/groups/useGroups'
import { Avatar } from '@/ui/Avatar'
import { ConfirmSheet, SheetIcon } from '@/ui/ConfirmSheet'
import { RenewIcon, ShareIcon } from '@/ui/icons'
import styles from '../../pages.module.css'

// The pieces of a group's screens: inviting, its settings and its members.

export function InviteCard({ group }: { group: Group }) {
  const { t } = useTranslation()
  const renew = useRenewCode()
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)
  const [confirmRenew, setConfirmRenew] = useState(false)
  const admin = group.rol === 'admin'

  async function copy(text: string, what: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      window.setTimeout(() => setCopied(null), 2000)
    } catch {
      // No clipboard access: the code can still be selected by hand.
    }
  }

  async function onShare() {
    const text = t('groupSettings.shareText', { name: group.nombre, code: group.codigo })
    const url = inviteLink(group.codigo)
    // The share sheet on phones; on computers without one, the link goes to the clipboard.
    if (!('share' in navigator)) return copy(`${text}\n${url}`, 'link')
    try {
      await navigator.share({ text, url })
    } catch {
      // Cancelled by the player.
    }
  }

  return (
    <section className={styles.invite}>
      <p className={styles.inviteText}>{t('groupSettings.inviteText')}</p>
      <p className={styles.code}>{group.codigo}</p>
      <button className="btn btn-primary" type="button" onClick={() => void onShare()}>
        <ShareIcon width={18} height={18} />
        {copied === 'link' ? t('groupSettings.linkCopied') : t('groupSettings.share')}
      </button>
      <div className={styles.inviteRow}>
        <button className={`btn ${styles.inviteSecondary}`} type="button" onClick={() => void copy(group.codigo, 'code')}>
          {copied === 'code' ? t('groupSettings.copied') : t('groupSettings.copy')}
        </button>
        {admin && (
          <button
            className={`btn ${styles.inviteOutline}`}
            type="button"
            disabled={renew.isPending}
            onClick={() => setConfirmRenew(true)}
          >
            {t('groupSettings.renew')}
          </button>
        )}
      </div>
      {renew.isError && (
        <p className="error-text" role="alert">
          {t('common.error')}
        </p>
      )}
      <InviteQr link={inviteLink(group.codigo)} name={group.nombre} />
      <ConfirmSheet
        open={confirmRenew}
        tone="accent"
        icon={
          <SheetIcon tone="accent">
            <RenewIcon />
          </SheetIcon>
        }
        title={t('groupSettings.renewTitle')}
        text={<Trans i18nKey="groupSettings.renewText" values={{ code: group.codigo }} components={{ b: <b className={styles.inlineCode} /> }} />}
        confirm={t('groupSettings.renewConfirm')}
        busy={renew.isPending}
        onCancel={() => setConfirmRenew(false)}
        onConfirm={() => renew.mutate(group.id, { onSettled: () => setConfirmRenew(false) })}
      />
    </section>
  )
}

export function AdminCard({ group }: { group: Group }) {
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

  const hidden = group.ajustes.ocultarRanking
  return (
    <section className={`card ${styles.section}`}>
      <h2 className="label">{t('groupSettings.section')}</h2>
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
      <div className={styles.switchRow}>
        <span className={styles.listText} id="hide-ranking">
          {t('groupSettings.hideRanking')}
          <small>{t('groupSettings.hideRankingHint')}</small>
        </span>
        <button
          className="switch"
          type="button"
          role="switch"
          aria-checked={hidden}
          aria-labelledby="hide-ranking"
          disabled={toggle.isPending}
          onClick={() => toggle.mutate({ id: group.id, ocultarRanking: !hidden })}
        />
      </div>
      {(rename.isError || toggle.isError) && (
        <p className="error-text" role="alert">
          {t('common.error')}
        </p>
      )}
    </section>
  )
}

export function MembersCard({ group }: { group: Group }) {
  const { t } = useTranslation()
  const me = useUser()
  const kick = useKickMember()
  const [kicking, setKicking] = useState<RankedMember | null>(null)
  const admin = group.rol === 'admin'
  return (
    <section className={styles.group}>
      <h2 className="label">
        {t('groupSettings.members')} · {group.ranking.length}
      </h2>
      <ul className={styles.list}>
        {group.ranking.map((member) => (
          <li key={member.userId} className={styles.listRow}>
            <Avatar seed={member.userId} name={member.nombre} size={40} />
            <span className={styles.listText}>
              <span>
                {member.nombre}
                {member.userId === me.id && <span className="muted"> · {t('ranking.you').toLowerCase()}</span>}
              </span>
            </span>
            {member.rol === 'admin' && <span className={styles.badge}>{t('groupSettings.admin')}</span>}
            {admin && member.userId !== me.id && (
              <button className={styles.smallButton} type="button" disabled={kick.isPending} onClick={() => setKicking(member)}>
                {t('groupSettings.kick')}
              </button>
            )}
          </li>
        ))}
      </ul>
      {!admin && <p className={`muted ${styles.hint}`}>{t('groupSettings.onlyAdmin')}</p>}
      {kick.isError && (
        <p className="error-text" role="alert">
          {t('common.error')}
        </p>
      )}
      <ConfirmSheet
        open={kicking !== null}
        icon={kicking && <Avatar seed={kicking.userId} name={kicking.nombre} size={64} />}
        title={t('groupSettings.kickTitle', { name: kicking?.nombre ?? '' })}
        text={t('groupSettings.kickText')}
        confirm={t('groupSettings.kick')}
        busy={kick.isPending}
        onCancel={() => setKicking(null)}
        onConfirm={() => {
          if (kicking) kick.mutate({ id: group.id, userId: kicking.userId }, { onSettled: () => setKicking(null) })
        }}
      />
    </section>
  )
}
