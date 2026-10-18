'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ago } from '@/admin/format'
import { can } from '@/admin/useAdmin'
import { useAutomations, useSetAutomation, type AutomationId } from '@/admin/useAdminTools'
import styles from './admin.module.css'
import { useAdminPanel } from './context'
import ui from './tools.module.css'

/** Rules that act on their own, so nobody has to watch for the same things every day. */
export function AutomationsTab() {
  const { t } = useTranslation()
  const { role, go } = useAdminPanel()
  const { data } = useAutomations()
  const set = useSetAutomation()
  const [error, setError] = useState<string | null>(null)
  const owner = can(role, 'dueno')

  const toggle = (id: AutomationId | 'weeklyReport', on: boolean) => {
    setError(null)
    set.mutateAsync({ id, on }).catch((err: Error) => setError(err.message || t('common.error')))
  }

  return (
    <>
      <section className={`card ${styles.block} ${styles.span2}`}>
        <div className={styles.sectionHead}>
          <h2 className="label">{t('panel.auto.title')}</h2>
          <button type="button" className={styles.link} onClick={() => go('log')}>
            {t('panel.auto.seeLog')}
          </button>
        </div>
        <ul className={ui.rules}>
          {data?.rules.map((rule) => (
            <li key={rule.id} data-on={rule.on || undefined}>
              <div className={ui.ruleText}>
                <span className={ui.ruleWhen}>
                  <small>{t('panel.auto.when')}</small> {t(`panel.auto.rule.${rule.id}.when`)}
                </span>
                <span className={ui.ruleThen}>→ {t(`panel.auto.rule.${rule.id}.then`)}</span>
                <small className={styles.dim}>
                  {rule.runs > 0
                    ? t('panel.auto.runs', { count: rule.runs, time: ago(rule.last) })
                    : t('panel.auto.never')}
                </small>
              </div>
              <button
                type="button"
                role="switch"
                className={styles.switch}
                aria-checked={rule.on}
                aria-label={t(`panel.auto.rule.${rule.id}.when`)}
                disabled={!owner || set.isPending}
                onClick={() => toggle(rule.id, !rule.on)}
              />
            </li>
          ))}
        </ul>
        {error && <p className="error-text">{error}</p>}
        {!owner && <p className={styles.dim}>{t('panel.auto.ownerOnly')}</p>}
      </section>

      <section className={`card ${styles.block}`}>
        <h2 className="label">{t('panel.auto.reportTitle')}</h2>
        <div className={styles.switchRow}>
          <span>
            <b>{t('panel.auto.report')}</b>
            <br />
            <small className={styles.dim}>{t('panel.auto.reportText')}</small>
          </span>
          <button
            type="button"
            role="switch"
            className={styles.switch}
            aria-checked={data?.weeklyReport.on ?? false}
            aria-label={t('panel.auto.report')}
            disabled={!owner || set.isPending || !data}
            onClick={() => toggle('weeklyReport', !data?.weeklyReport.on)}
          />
        </div>
        <div className={ui.pushMock}>
          <b>{t('panel.auto.reportPushTitle')}</b>
          <span>{t('panel.auto.reportPushBody')}</span>
        </div>
      </section>
    </>
  )
}
