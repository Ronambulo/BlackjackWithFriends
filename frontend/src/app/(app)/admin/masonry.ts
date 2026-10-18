import { useEffect, type RefObject } from 'react'

/** Height of one grid row in the masonry grid, and the space wanted between cards. */
const ROW = 4
const GAP = 20

/**
 * Lets the cards of a grid stack like a masonry wall: each one takes as many short rows as it is
 * tall, so a short card doesn't leave a hole next to a tall one. Column spans (span2, full) still
 * work. Only while the grid is a grid: on a phone it's a single column and nothing changes.
 */
export function useMasonry(ref: RefObject<HTMLElement | null>, key: unknown) {
  useEffect(() => {
    const grid = ref.current
    if (!grid) return

    const place = (card: HTMLElement) => {
      if (getComputedStyle(grid).display !== 'grid') {
        card.style.gridRowEnd = ''
        return
      }
      card.style.gridRowEnd = `span ${Math.ceil((card.getBoundingClientRect().height + GAP) / ROW)}`
    }
    const cards = () => [...grid.children].filter((c): c is HTMLElement => c instanceof HTMLElement)

    const resize = new ResizeObserver((entries) => {
      for (const entry of entries) place(entry.target as HTMLElement)
    })
    const watch = () => {
      resize.disconnect()
      for (const card of cards()) resize.observe(card)
    }
    const children = new MutationObserver(watch)
    children.observe(grid, { childList: true })
    // Crossing the phone breakpoint switches the grid on or off without any card changing size.
    const media = window.matchMedia('(min-width: 900px)')
    const relayout = () => cards().forEach(place)
    media.addEventListener('change', relayout)
    watch()

    return () => {
      resize.disconnect()
      children.disconnect()
      media.removeEventListener('change', relayout)
      for (const card of cards()) card.style.gridRowEnd = ''
    }
  }, [ref, key])
}
