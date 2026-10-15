'use client'

import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { Avatar } from '@/ui/Avatar'
import { CameraIcon } from '@/ui/icons'
import { usePhotoPicker } from './usePhotoPicker'
import { useProfile } from './useProfile'
import styles from './AvatarPicker.module.css'

/** The player's own avatar as a button: tapping it changes the photo. */
export function AvatarPicker({ size, className = '' }: { size: number; className?: string }) {
  const { t } = useTranslation()
  const user = useUser()
  const { data: profile } = useProfile()
  const { pick, field, avatar } = usePhotoPicker()
  return (
    <span className={styles.wrap}>
      <button
        type="button"
        className={styles.button}
        onClick={pick}
        disabled={avatar.isPending}
        aria-label={t('settings.changePhoto')}
      >
        <Avatar
          seed={user.id}
          name={profile?.nombre ?? ''}
          src={profile?.avatar_url}
          size={size}
          className={`${className} ${avatar.isPending ? styles.busy : ''}`}
        />
        <span className={styles.badge} aria-hidden="true">
          <CameraIcon width={14} height={14} />
        </span>
      </button>
      {field}
      {avatar.isError && (
        <span className={`error-text ${styles.error}`} role="alert">
          {t('settings.photoError')}
        </span>
      )}
    </span>
  )
}
