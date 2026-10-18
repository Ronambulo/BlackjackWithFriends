'use client'

import type { Action } from '@bwf/engine'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { currentLanguage } from '@/i18n'
import { ApiError } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { play as playSound, preloadSounds } from '@/sound/sounds'
import { BetStack, FeltHand, FeltPrint, HandControls, netTone, signed, soundFor, useDealTiming } from '@/table/Table'
import { ChevronLeftIcon } from '@/ui/icons'
import { DailyResults } from './DailyResults'
import { Progress } from './Progress'
import { useDaily, useDailyPlay } from './useDaily'
import table from '@/table/Table.module.css'
import styles from './Daily.module.css'

/** The daily deck's table: the same 10 hands for everyone, a fixed bet and chips of its own. */
export function DailyTable() {
  const { t } = useTranslation()
  const lang = currentLanguage()
  const { data, isPending, isError, refetch } = useDaily()
  const play = useDailyPlay()
  const dealing = play.isPending && play.variables.action === 'deal'
  // Finished in this visit: the last hand stays on the felt until the player asks for the results.
  const [dismissed, setDismissed] = useState(false)
  const finishing = Boolean(play.data?.done) && !dismissed
  // While the results show, there's no felt: no hand to deal again and make heard behind them.
  const results = Boolean(data?.done) && !finishing
  const hand = dealing || results ? null : (data?.hand ?? null)
  const { schedule, ready } = useDealTiming(hand)

  const [shownChips, setShownChips] = useState<number | null>(null)
  if (ready && data && shownChips !== data.chips) setShownChips(data.chips)
  const chips = data ? (ready ? data.chips : (shownChips ?? data.chips)) - (dealing ? data.bet : 0) : 0

  useEffect(preloadSounds, [])
  const resultSound = hand?.phase === 'settled' && ready && !dealing ? soundFor(hand) : null
  useEffect(() => {
    if (resultSound) playSound(resultSound)
  }, [resultSound, hand?.id])

  if (isPending) return <div className={table.loading} aria-busy="true" />
  if (isError || !data) {
    return (
      <div className={table.message}>
        <p>{t('common.error')}</p>
        <button className={table.gold} onClick={() => void refetch()}>
          {t('common.retry')}
        </button>
      </div>
    )
  }
  if (results) return <DailyResults daily={data} />

  const busy = play.isPending || !ready
  const fmt = (n: number) => formatNumber(n, lang)
  const send = (action: 'deal' | Action) =>
    play.mutate({ action, version: data.version }, { onSuccess: () => setDismissed(false) })
  const act = (action: Action) => {
    if (action === 'double' || action === 'split') playSound(action)
    send(action)
  }

  const settled = hand?.phase === 'settled' ? hand.settlement : null
  const showResult = Boolean(settled) && ready && !dealing
  const inPlay = hand !== null && hand.phase !== 'settled'
  // The server already counts the hand that just settled; its square waits, glowing, for the dealer to finish.
  const revealing = hand?.phase === 'settled' && !ready
  const shownResults = revealing ? data.results.slice(0, -1) : data.results
  // The hand about to be dealt, or being played, 1 to 10.
  const current = Math.min(data.total, data.results.length + 1)
  const errorText = play.error ? t(play.error instanceof ApiError && play.error.status === 409 ? 'play.changed' : 'common.error') : null

  return (
    <div className={table.table}>
      <section className={table.felt}>
        <div className={`${table.feltTop} ${styles.top}`}>
          <Link href="/" className={styles.back} aria-label={t('daily.backHome')}>
            <ChevronLeftIcon width={18} height={18} />
          </Link>
          <div className={styles.heading}>
            <span className={styles.title}>{t('daily.title', { number: data.number })}</span>
            <Progress results={shownResults} total={data.total} current={inPlay || dealing || revealing ? shownResults.length : -1} />
          </div>
          <div className={table.shoe} aria-hidden="true" />
        </div>

        {hand ? (
          <FeltHand key={hand.id} hand={hand} schedule={schedule} ready={ready} />
        ) : (
          <div className={table.idle}>
            <FeltPrint payout={t('daily.title', { number: data.number })} rules={t('daily.tableRules')} />
            <div className={table.spot}>{dealing && <BetStack amount={data.bet} />}</div>
            <p className={table.spotLabel}>{t('daily.fixedBet', { amount: fmt(data.bet) })}</p>
          </div>
        )}

        <span className={table.pill} aria-label={`${t('daily.chips')}: ${t('play.chips', { count: chips })}`}>
          <span className={table.chipIcon} aria-hidden="true" />
          {fmt(chips)}
        </span>
      </section>

      <section className={table.rail} aria-live="polite">
        {errorText && <p className={table.error}>{errorText}</p>}

        {settled && showResult && <p className={`${table.net} ${table[netTone(settled.net)]}`}>{signed(settled.net, lang)}</p>}

        {!inPlay && !dealing && (!hand || showResult) && (
          <>
            {!hand && data.results.length === 0 && <p className={table.note}>{t('daily.intro', { total: data.total, start: fmt(data.start) })}</p>}
            <div className={table.row}>
              {data.done ? (
                <button className={`${table.gold} ${table.wide}`} onClick={() => setDismissed(true)}>
                  {t('daily.seeResults')}
                </button>
              ) : (
                <button className={`${table.gold} ${table.wide}`} disabled={busy} onClick={() => send('deal')}>
                  {t('daily.deal', { current, total: data.total })}
                </button>
              )}
            </div>
          </>
        )}

        <HandControls hand={hand} pendingBet={dealing ? data.bet : null} busy={busy} act={act} />
      </section>
    </div>
  )
}
