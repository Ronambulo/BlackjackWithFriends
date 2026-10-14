'use client'

import { Trans, useTranslation } from 'react-i18next'
import { CloseIcon, ShareIcon } from '@/ui/icons'
import styles from './InstallBanner.module.css'
import { useInstallPrompt } from './useInstallPrompt'

/** Floats above the tab bar until the app is installed or dismissed. Client-only (reads navigator). */
export function InstallBanner() {
  const { t } = useTranslation()
  const { platform, installed, dismissed, canPromptInstall, install, dismiss } = useInstallPrompt()

  if (installed || dismissed) return null
  // On desktop we only show the banner when the browser can install directly.
  if (platform === 'other' && !canPromptInstall) return null

  const components = {
    b: <strong />,
    share: <ShareIcon className={styles.inlineIcon} role="img" aria-label={t('install.share')} />,
  }

  return (
    <aside className={styles.banner} role="dialog" aria-labelledby="install-title">
      <button className={styles.close} onClick={dismiss} aria-label={t('install.close')}>
        <CloseIcon width={16} height={16} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- static PWA icon */}
      <img className={styles.icon} src="/pwa-192x192.png" alt="" width={52} height={52} />
      <div className={styles.body}>
        <h2 id="install-title">{t('install.title')}</h2>

        {canPromptInstall ? (
          <>
            <p>{t('install.text')}</p>
            <button className={`btn btn-primary ${styles.button}`} onClick={install}>
              {t('install.button')}
            </button>
          </>
        ) : platform === 'ios' ? (
          <ol>
            <li>
              <Trans i18nKey="install.ios1" components={components} />
            </li>
            <li>
              <Trans i18nKey="install.ios2" components={components} />
            </li>
            <li>
              <Trans i18nKey="install.ios3" components={components} />
            </li>
          </ol>
        ) : (
          <ol>
            <li>
              <Trans i18nKey="install.android1" components={components} />
            </li>
            <li>
              <Trans i18nKey="install.android2" components={components} />
            </li>
          </ol>
        )}
      </div>
    </aside>
  )
}
