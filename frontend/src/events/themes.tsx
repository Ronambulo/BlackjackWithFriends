import type { CSSProperties, ReactNode } from 'react'
import type { EventId } from '@/cosmetics/useCosmetics'
import { halloween } from './halloween/Halloween'

type Vars = CSSProperties & Record<`--${string}`, string>

/**
 * How an event looks: everything else about its box (banner, page, opening it) is shared.
 * A new event is one more theme here, next to its entry in backend/lib/cosmetics.ts.
 */
export interface EventTheme {
  /** The --event-* colours of its banner, page and box (EventBox.module.css). */
  style: Vars
  /** What the whole app turns to on the event's page: the shell's own colours, --event-sky and --event-line. */
  sky: Vars
  /** The box itself, drawn by the event. It rattles while it opens. */
  Icon: (props: { className?: string }) => ReactNode
  /** Decorations behind the banner on the home screen. */
  BannerArt: () => ReactNode
  /** Decorations behind the header of the event's page. */
  HeroArt: () => ReactNode
}

export const EVENT_THEMES: Record<EventId, EventTheme> = { halloween }

export const isEventId = (value: string): value is EventId => Object.hasOwn(EVENT_THEMES, value)

/** The event whose page this is, if any: /eventos/halloween. */
export function eventOfPath(pathname: string): EventId | null {
  const id = /^\/eventos\/([^/]+)/.exec(pathname)?.[1]
  return id && isEventId(id) ? id : null
}

export const eventPath = (id: EventId) => `/eventos/${id}`
