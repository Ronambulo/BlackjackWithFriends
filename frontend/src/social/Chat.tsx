'use client'

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@/auth/session-context'
import { currentLanguage } from '@/i18n'
import { Avatar } from '@/ui/Avatar'
import { CloseIcon, ReplyIcon, SendIcon, TrashIcon } from '@/ui/icons'
import { HandCard } from './HandCard'
import { StatsCard } from './StatsCard'
import { REACTIONS, TEXT_MAX, useChat, useDeleteMessage, useReact, useSendMessage, type ChatMessage } from './useChat'
import styles from './Chat.module.css'

/** Two messages from the same player this close together share one header. */
const RUN_MS = 5 * 60 * 1000
/** How far a bubble has to be dragged sideways to answer it. */
const SWIPE_PX = 56
/** How long a bubble has to be held to open its menu. */
const HOLD_MS = 450

/** A chat ('global' or a group's), showing its last week. Remount it (key) to switch chats. */
export function Chat({ chatId, name }: { chatId: string; name: string }) {
  const { t } = useTranslation()
  const me = useUser()
  const { data, isError, refetch } = useChat(chatId)
  const [picked, setPicked] = useState<string | null>(null)
  const [replying, setReplying] = useState<ChatMessage | null>(null)
  const end = useRef<HTMLDivElement>(null)

  // To the newest message on opening, and again when one arrives while near the bottom.
  const last = data ? (data.messages.at(-1)?.id ?? '') : undefined
  const seen = useRef<string | undefined>(undefined)
  useLayoutEffect(() => {
    if (last === undefined || last === seen.current) return
    const first = seen.current === undefined
    seen.current = last
    const scroller = end.current?.closest('main')
    if (!scroller) return
    const near = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 240
    // A frame later: on opening, after the router's own scroll to the top of the page
    if (first || near) requestAnimationFrame(() => toBottom(end.current, first ? 'instant' : 'smooth'))
  }, [last])

  useEffect(() => {
    if (!picked) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setPicked(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [picked])

  const reply = (message: ChatMessage) => {
    setPicked(null)
    setReplying(message)
  }

  // To the quoted message, lit up for a moment.
  const jump = (messageId: string) => {
    const el = end.current?.parentElement?.querySelector<HTMLElement>(`[data-message="${messageId}"]`)
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    el.classList.remove(styles.flash)
    void el.offsetWidth
    el.classList.add(styles.flash)
  }

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

  const list = data?.messages ?? []
  return (
    <div className={styles.chat}>
      <div className={styles.messages} aria-busy={!data} aria-live="polite">
        {data && list.length === 0 && (
          <p className={`muted ${styles.hint}`}>{t('social.first', { name })}</p>
        )}
        {data?.more && <p className={`muted ${styles.hint}`}>{t('social.older')}</p>}
        {picked && <div className={styles.backdrop} onClick={() => setPicked(null)} aria-hidden="true" />}
        {list.map((message, i) => {
          const prev = list[i - 1]
          const run =
            prev &&
            prev.userId === message.userId &&
            new Date(message.createdAt).getTime() - new Date(prev.createdAt).getTime() < RUN_MS
          return (
            <Message
              key={message.id}
              message={message}
              chatId={chatId}
              mine={message.userId === me.id}
              canDelete={message.userId === me.id || Boolean(data?.moderator)}
              head={!run}
              open={picked === message.id}
              onToggle={() => setPicked((id) => (id === message.id ? null : message.id))}
              onReply={() => reply(message)}
              onJump={jump}
            />
          )
        })}
        <div ref={end} />
      </div>

      <Composer
        chatId={chatId}
        replying={replying}
        onCancelReply={() => setReplying(null)}
        onSent={() => {
          setReplying(null)
          toBottom(end.current, 'smooth')
        }}
      />
    </div>
  )
}

/** Scrolls the page to its very end, so the sticky composer doesn't cover the last message. */
function toBottom(el: HTMLElement | null, behavior: ScrollBehavior) {
  const scroller = el?.closest('main')
  scroller?.scrollTo({ top: scroller.scrollHeight, behavior })
}

const buzz = () => navigator.vibrate?.(8)

function Message({
  message,
  chatId,
  mine,
  canDelete,
  head,
  open,
  onToggle,
  onReply,
  onJump,
}: {
  message: ChatMessage
  chatId: string
  mine: boolean
  canDelete: boolean
  head: boolean
  open: boolean
  onToggle: () => void
  onReply: () => void
  onJump: (messageId: string) => void
}) {
  const { t } = useTranslation()
  const react = useReact(chatId)
  const remove = useDeleteMessage(chatId)
  const swipe = useGestures({ onHold: onToggle, onSwipe: onReply, dir: mine ? -1 : 1 })
  // The emoji that flies off the bubble when picked
  const [burst, setBurst] = useState<{ emoji: string; n: number } | null>(null)
  const own = message.reactions.find((r) => r.mine)?.emoji ?? null
  const time = new Date(message.createdAt).toLocaleString(currentLanguage(), {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  const pick = (emoji: string) => {
    const taking = emoji === own
    buzz()
    react.mutate({ messageId: message.id, emoji: taking ? null : emoji })
    if (!taking) setBurst((last) => ({ emoji, n: (last?.n ?? 0) + 1 }))
    if (open) onToggle()
  }

  return (
    <div
      data-message={message.id}
      className={`${styles.message} ${mine ? styles.mine : ''} ${head ? styles.head : ''} ${open ? styles.open : ''}`}
    >
      {!mine && (
        <span className={styles.avatar}>
          {head && <Avatar seed={message.userId} name={message.nombre} src={message.avatarUrl} size={30} />}
        </span>
      )}
      <div className={styles.body}>
        {head && !mine && <span className={styles.author}>{message.nombre}</span>}

        <div className={styles.swipe} style={swipe.style}>
          <span className={styles.swipeHint} style={{ opacity: swipe.progress }} aria-hidden="true">
            <ReplyIcon width={18} height={18} />
          </span>

          {open && (
            <div className={styles.picker} role="toolbar" aria-label={t('social.react')}>
              {REACTIONS.map((emoji, i) => (
                <button
                  key={emoji}
                  type="button"
                  className={`${styles.pick} ${emoji === own ? styles.pickMine : ''}`}
                  style={{ '--i': i } as CSSProperties}
                  aria-label={emoji}
                  aria-pressed={emoji === own}
                  onClick={() => pick(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <div
            role="button"
            tabIndex={0}
            className={`${styles.bubble} ${message.mano || message.estadisticas ? styles.handBubble : ''} ${swipe.pressing ? styles.pressing : ''}`}
            aria-expanded={open}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onToggle()
              }
            }}
            {...swipe.handlers}
          >
            {message.reply && (
              <Quote
                reply={message.reply}
                onClick={(event) => {
                  event.stopPropagation()
                  onJump(message.reply!.id)
                }}
              />
            )}
            {message.mano && <span className={styles.shared}>{t('social.sharedHand')}</span>}
            {message.estadisticas && <span className={styles.shared}>{t('social.sharedStats')}</span>}
            {message.mano ? (
              <HandCard hand={message.mano} />
            ) : message.estadisticas ? (
              <StatsCard stats={message.estadisticas} />
            ) : (
              <span className={styles.text}>{message.texto}</span>
            )}
            <time className={styles.time} dateTime={message.createdAt}>
              {time}
            </time>
          </div>

          {burst && (
            <span key={burst.n} className={styles.burst} aria-hidden="true" onAnimationEnd={() => setBurst(null)}>
              {burst.emoji}
            </span>
          )}
        </div>

        {message.reactions.length > 0 && (
          <div className={styles.reactions}>
            {message.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                className={`${styles.reaction} ${r.mine ? styles.reactionMine : ''}`}
                aria-pressed={r.mine}
                onClick={() => pick(r.emoji)}
              >
                {r.emoji}
                {r.count > 1 && <b key={r.count}>{r.count}</b>}
              </button>
            ))}
          </div>
        )}

        {open && (
          <div className={styles.menu} role="menu">
            <button type="button" role="menuitem" onClick={onReply}>
              <ReplyIcon width={18} height={18} />
              {t('social.reply')}
            </button>
            {canDelete && (
              <button
                type="button"
                role="menuitem"
                className={styles.menuDanger}
                disabled={remove.isPending}
                onClick={() => remove.mutate(message.id, { onSuccess: onToggle })}
              >
                <TrashIcon width={18} height={18} />
                {t('social.delete')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** The answered message, quoted on top of a reply (or over the composer while writing one). */
function Quote({
  reply,
  onClick,
}: {
  reply: NonNullable<ChatMessage['reply']>
  onClick?: (event: MouseEvent) => void
}) {
  const { t } = useTranslation()
  const me = useUser()
  return (
    <span className={`${styles.quote} ${onClick ? styles.quoteLink : ''}`} onClick={onClick}>
      <b className={styles.quoteName}>{reply.userId === me.id ? t('social.you') : reply.nombre}</b>
      <span className={styles.quoteText}>{reply.mano ? t('social.handQuote') : reply.estadisticas ? t('social.statsQuote') : reply.texto}</span>
    </span>
  )
}

/**
 * The bubble's touch gestures, like in iOS / WhatsApp: hold it to open its menu,
 * drag it sideways (right, or left for your own) to answer it. Vertical moves are left to the scroll.
 */
function useGestures({ onHold, onSwipe, dir }: { onHold: () => void; onSwipe: () => void; dir: 1 | -1 }) {
  const [dx, setDx] = useState(0)
  const [pressing, setPressing] = useState(false)
  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const dragging = useRef(false)

  const stopHold = () => {
    window.clearTimeout(timer.current)
    setPressing(false)
  }

  const end = () => {
    stopHold()
    if (dragging.current && dx >= SWIPE_PX) onSwipe()
    start.current = null
    dragging.current = false
    setDx(0)
  }

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return {
    pressing,
    progress: Math.min(dx / SWIPE_PX, 1),
    style: dx ? { transform: `translateX(${dx * dir}px)`, transition: 'none' } : undefined,
    handlers: {
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (event.button !== 0) return
        start.current = { x: event.clientX, y: event.clientY, id: event.pointerId }
        setPressing(true)
        timer.current = window.setTimeout(() => {
          start.current = null
          setPressing(false)
          buzz()
          onHold()
        }, HOLD_MS)
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        const from = start.current
        if (!from || from.id !== event.pointerId) return
        const x = (event.clientX - from.x) * dir
        const y = event.clientY - from.y
        if (!dragging.current) {
          if (Math.abs(y) > 10 || x < -10) {
            stopHold()
            start.current = null
            return
          }
          if (x < 10) return
          stopHold()
          dragging.current = true
          event.currentTarget.setPointerCapture(event.pointerId)
        }
        const next = Math.max(0, Math.min(x, SWIPE_PX * 1.4))
        if (next >= SWIPE_PX && dx < SWIPE_PX) buzz()
        setDx(next)
      },
      onPointerUp: end,
      onPointerCancel: end,
      onPointerLeave: stopHold,
      // No browser menu or text selection on a long press
      onContextMenu: (event: MouseEvent) => event.preventDefault(),
    },
  }
}

function Composer({
  chatId,
  replying,
  onCancelReply,
  onSent,
}: {
  chatId: string
  replying: ChatMessage | null
  onCancelReply: () => void
  onSent: () => void
}) {
  const { t } = useTranslation()
  const send = useSendMessage(chatId)
  const [text, setText] = useState('')
  const field = useRef<HTMLTextAreaElement>(null)
  const ready = text.trim().length > 0 && !send.isPending

  // Straight to writing once a message is picked to answer.
  useEffect(() => {
    if (replying) field.current?.focus()
  }, [replying])

  // Grows with what's written, up to a few lines.
  useEffect(() => {
    const el = field.current
    if (!el) return
    el.style.height = 'auto'
    // scrollHeight leaves out the border
    el.style.height = `${Math.min(el.scrollHeight + el.offsetHeight - el.clientHeight, 120)}px`
  }, [text])

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    if (!ready) return
    send.mutate(
      { texto: text.trim(), replyTo: replying?.id },
      {
        onSuccess: () => {
          setText('')
          onSent()
        },
      },
    )
  }
  // Enter sends; Shift+Enter starts a new line; Escape drops the reply.
  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) submit(event)
    if (event.key === 'Escape' && replying) onCancelReply()
  }

  return (
    <form className={styles.composer} onSubmit={submit}>
      {send.isError && (
        <p className={`error-text ${styles.sendError}`} role="alert">
          {send.error.message.startsWith('Demasiados') ? t('social.slowDown') : t('common.error')}
        </p>
      )}
      {replying && (
        <div className={styles.replying}>
          <ReplyIcon className={styles.replyingIcon} width={18} height={18} />
          <Quote reply={{ ...replying, mano: Boolean(replying.mano), estadisticas: Boolean(replying.estadisticas) }} />
          <button
            type="button"
            className={styles.replyingClose}
            aria-label={t('social.cancelReply')}
            onClick={onCancelReply}
          >
            <CloseIcon width={18} height={18} />
          </button>
        </div>
      )}
      <div className={styles.composerRow}>
        <textarea
          ref={field}
          className={styles.field}
          rows={1}
          maxLength={TEXT_MAX}
          placeholder={t('social.placeholder')}
          aria-label={t('social.placeholder')}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKey}
        />
        <button className={styles.send} type="submit" disabled={!ready} aria-label={t('social.send')}>
          <SendIcon width={20} height={20} />
        </button>
      </div>
    </form>
  )
}
