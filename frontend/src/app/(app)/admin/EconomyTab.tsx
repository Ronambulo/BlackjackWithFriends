'use client'

import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAdjustAll, useEconomy, useSetRules, type Economy } from '@/admin/useAdmin'
import { number, percent } from '@/admin/format'
import { ConfirmSheet } from '@/ui/ConfirmSheet'
import { CoinsIcon } from '@/ui/icons'
import styles from './admin.module.css'
import { SignedAmount, signedAmount, type Sign } from './SignedAmount'

const OUTCOMES = ['blackjack', 'win', 'push', 'lose', 'bust', 'surrender'] as const

// What the cards alone decide, whatever the player does: a natural with six decks
// (2 · 4/13 · 96/311 ≈ 4,75 %). The rest depends on how each one plays.
const NATURAL = 0.0475

function RulesForm({ data }: { data: Economy }) {
  const { t } = useTranslation()
  const save = useSetRules()
  const base = data.nextRules ?? data.rules
  const [startBalance, setStartBalance] = useState(String(base.startBalance))
  const [dailyPay, setDailyPay] = useState(String(base.dailyPay))
  const parsed = { startBalance: Number(startBalance), dailyPay: Number(dailyPay) }
  const valid =
    Number.isInteger(parsed.startBalance) && parsed.startBalance >= 1 && Number.isInteger(parsed.dailyPay) && parsed.dailyPay >= 0
  const changed = parsed.startBalance !== base.startBalance || parsed.dailyPay !== base.dailyPay

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (valid && changed) save.mutate(parsed)
  }
  const discard = () => {
    setStartBalance(String(base.startBalance))
    setDailyPay(String(base.dailyPay))
  }
  const field = (label: string, value: string, set: (value: string) => void, now: number) => (
    <label className={styles.formField}>
      {label}
      <input
        className={`${styles.fieldInput} ${styles.numberInput}`}
        value={value}
        onChange={(event) => set(event.target.value.replace(/\D/g, ''))}
        inputMode="numeric"
      />
      <small className={styles.dim}>{t('admin.ruleNow', { n: number(now) })}</small>
    </label>
  )

  return (
    <form className={`card ${styles.block}`} onSubmit={submit}>
      <div className={styles.headStack}>
        <h2 className="label">{t('admin.rules')}</h2>
        <span className={styles.dim}>
          {data.nextRules ? t('admin.rulesPending', { date: data.nextWeek }) : t('admin.rulesHint')}
        </span>
      </div>
      <div className={styles.formGrid}>
        {field(t('admin.startBalance'), startBalance, setStartBalance, data.rules.startBalance)}
        {field(t('admin.dailyPay'), dailyPay, setDailyPay, data.rules.dailyPay)}
      </div>
      {save.isError && <p className="error-text">{save.error.message}</p>}
      <div className={styles.formActions}>
        <button className="btn btn-ghost" type="button" disabled={!changed} onClick={discard}>
          {t('admin.discard')}
        </button>
        <button className="btn btn-primary" type="submit" disabled={!valid || !changed || save.isPending}>
          {t('admin.saveForMonday')}
        </button>
      </div>
    </form>
  )
}

/** Gives every player the same coins, or takes them away, after a confirmation. */
function CoinsForAll({ players }: { players: number }) {
  const { t } = useTranslation()
  const adjust = useAdjustAll()
  const [sign, setSign] = useState<Sign>(1)
  const [amount, setAmount] = useState('')
  const [motivo, setMotivo] = useState('')
  const [asking, setAsking] = useState(false)
  const cantidad = signedAmount(sign, amount)
  const valid = cantidad !== 0 && Math.abs(cantidad) <= 1_000_000 && motivo.trim().length >= 3

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (valid) setAsking(true)
  }
  const apply = () =>
    adjust.mutate(
      { cantidad, motivo: motivo.trim() },
      {
        onSuccess: () => {
          setAmount('')
          setMotivo('')
        },
        onSettled: () => setAsking(false),
      },
    )

  return (
    <form className={`card ${styles.block}`} onSubmit={submit}>
      <div className={styles.headStack}>
        <h2 className="label">{t('admin.coinsAll.title')}</h2>
        <span className={styles.dim}>{t('admin.coinsAll.hint')}</span>
      </div>
      <div className={styles.adjust}>
        <SignedAmount
          sign={sign}
          digits={amount}
          onSign={(value) => {
            setSign(value)
            adjust.reset()
          }}
          onDigits={(value) => {
            setAmount(value)
            adjust.reset()
          }}
        />
        <label className="field">
          <span className="field-label">{t('admin.adjust.reason')}</span>
          <input
            className="input"
            maxLength={200}
            placeholder={t('admin.adjust.reasonHint')}
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value)
              adjust.reset()
            }}
          />
        </label>
        <button className="btn btn-secondary" type="submit" disabled={!valid || adjust.isPending}>
          {t('admin.adjust.apply')}
        </button>
      </div>
      {adjust.isError && <p className="error-text">{t('common.error')}</p>}
      {adjust.isSuccess && (
        <p className={styles.dim}>
          {t('admin.coinsAll.done', { count: adjust.data.players, total: number(Math.abs(adjust.data.total)) })}
        </p>
      )}
      <ConfirmSheet
        open={asking}
        icon={<CoinsIcon />}
        title={t(sign === 1 ? 'admin.coinsAll.confirmGive' : 'admin.coinsAll.confirmTake', {
          n: number(Math.abs(cantidad)),
          count: players,
        })}
        text={sign === 1 ? t('admin.coinsAll.confirmGiveText') : t('admin.coinsAll.confirmTakeText')}
        confirm={t('admin.adjust.apply')}
        tone={sign === 1 ? 'accent' : 'danger'}
        busy={adjust.isPending}
        onConfirm={apply}
        onCancel={() => setAsking(false)}
      />
    </form>
  )
}

export function EconomyTab() {
  const { t } = useTranslation()
  const { data, isError, refetch } = useEconomy()

  if (isError) {
    return (
      <section className="card">
        <p className="muted">{t('common.error')}</p>
        <button className="btn btn-secondary" onClick={() => void refetch()}>
          {t('common.retry')}
        </button>
      </section>
    )
  }
  if (!data) return <section className={`card ${styles.placeholder}`} aria-busy="true" />

  const hands = OUTCOMES.reduce((sum, key) => sum + data.outcomes[key], 0)
  const most = Math.max(1, ...data.histogram.map((bucket) => bucket.players))
  const range = (from: number, to: number | null) =>
    to === null ? `${number(from)}+` : to === from + 1 ? number(from) : `${number(from)}–${number(to - 1)}`
  const broke = data.histogram.find((bucket) => bucket.from === 0)?.players ?? 0

  const kpis: { label: string; value: number; sub: string; coin?: boolean }[] = [
    { label: t('admin.chipsInPlay'), value: data.chipsInPlay, sub: t('admin.chipsInPlaySub') },
    { label: t('admin.paidOut'), value: data.paid, sub: t('admin.allTime') },
    {
      label: t('admin.houseKept'),
      value: data.houseKept,
      sub: t('admin.ofWagered', { pct: percent(data.wagered ? data.houseKept / data.wagered : null, 1) }),
    },
    { label: t('admin.coinsHeld'), value: data.coins, sub: t('admin.coinsSub'), coin: true },
  ]

  return (
    <>
      <div className={`card ${styles.tiles}`}>
        {kpis.map((kpi) => (
          <div key={kpi.label} className={styles.tile}>
            <span className={`${styles.tileLabel} ${styles.dotLabel}`}>
              <span className={styles.kpiDot} data-coin={kpi.coin ?? false} />
              {kpi.label}
            </span>
            <span className={styles.tileValue}>{number(kpi.value)}</span>
            <span className={styles.dim}>{kpi.sub}</span>
          </div>
        ))}
      </div>

      <section className={`card ${styles.block}`}>
        <h2 className="label">{t('admin.balancesNow')}</h2>
        <div className={styles.columns}>
          {data.histogram.map((bucket) => (
            <div key={bucket.from} className={styles.column}>
              <span className={styles.dim}>{number(bucket.players)}</span>
              <span
                className={styles.columnBar}
                data-tone={
                  bucket.from === 0
                    ? 'broke'
                    : bucket.from <= data.rules.startBalance && (bucket.to === null || data.rules.startBalance < bucket.to)
                      ? 'start'
                      : undefined
                }
                style={{ height: `${(bucket.players / most) * 120}px` }}
              />
              <span className={styles.columnLabel}>{range(bucket.from, bucket.to)}</span>
            </div>
          ))}
        </div>
        <p className={styles.dim}>
          {t('admin.balancesHint', { n: number(data.rules.startBalance) })}{' '}
          {broke > 0 && t('admin.brokeHint', { count: broke })}
        </p>
      </section>

      <section className={`card ${styles.block}`}>
        <h2 className="label">{t('admin.fairDeck')}</h2>
        <table className={styles.oddsTable}>
          <thead>
            <tr>
              <th scope="col">{t('admin.odds.result')}</th>
              <th scope="col">{t('admin.odds.seen')}</th>
              <th scope="col">{t('admin.odds.expected')}</th>
            </tr>
          </thead>
          <tbody>
            {OUTCOMES.map((key) => (
              <tr key={key}>
                <td>{t(`admin.outcome.${key}`)}</td>
                <td>{percent(hands ? data.outcomes[key] / hands : null, 1)}</td>
                <td>{key === 'blackjack' ? percent(NATURAL, 1) : '—'}</td>
              </tr>
            ))}
            <tr>
              <td>{t('admin.dealerBlackjacks')}</td>
              <td>{percent(data.rounds ? data.dealerBlackjacks / data.rounds : null, 1)}</td>
              <td>{percent(NATURAL, 1)}</td>
            </tr>
          </tbody>
        </table>
        <p className={styles.dim}>{t('admin.fairHint', { n: number(data.rounds) })}</p>
      </section>

      <CoinsForAll players={data.players} />

      <RulesForm key={`${data.nextRules?.startBalance}:${data.nextRules?.dailyPay}`} data={data} />
    </>
  )
}
