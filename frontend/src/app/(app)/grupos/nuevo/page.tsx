'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { GROUP_NAME_MAX, GROUP_NAME_MIN, useCreateGroup } from '@/groups/useGroups'
import { ApiError } from '@/lib/api'
import { ChevronLeftIcon } from '@/ui/icons'
import styles from '../../pages.module.css'

export default function NewGroupPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const createGroup = useCreateGroup()
  const [name, setName] = useState('')
  const trimmed = name.trim()
  const valid = trimmed.length >= GROUP_NAME_MIN && trimmed.length <= GROUP_NAME_MAX

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!valid) return
    // A new group is empty: straight to inviting friends.
    createGroup.mutate(trimmed, { onSuccess: ({ id }) => router.push(`/grupos/${id}/invitar`) })
  }

  const error = createGroup.error
  return (
    <div className={styles.page}>
      <Link href="/grupos" className={styles.back}>
        <ChevronLeftIcon width={20} height={20} />
        {t('common.back')}
      </Link>
      <h1 className={styles.heading}>{t('groups.createTitle')}</h1>

      <form className={`card ${styles.form}`} onSubmit={onSubmit}>
        <p className="muted">{t('groups.createText')}</p>
        <label className="field">
          <span className="field-label">{t('groups.nameLabel')}</span>
          <input
            className="input"
            autoFocus
            maxLength={GROUP_NAME_MAX}
            placeholder={t('groups.namePlaceholder')}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              createGroup.reset()
            }}
          />
          <span className="muted">{t('groups.nameHint')}</span>
        </label>
        <button className="btn btn-primary btn-block" type="submit" disabled={!valid || createGroup.isPending}>
          {createGroup.isPending ? t('groups.creating') : t('groups.create')}
        </button>
        {error && (
          <p className="error-text" role="alert">
            {error instanceof ApiError && error.status === 409 ? t('groups.tooMany') : t('common.error')}
          </p>
        )}
      </form>
    </div>
  )
}
