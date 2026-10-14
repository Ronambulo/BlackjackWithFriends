'use client'

import QRCode from 'qrcode'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './InviteQr.module.css'

const MODULE = 12
/** Blank modules around the code; scanners want a quiet edge. */
const QUIET = 3
const PAPER = '#f4f1ea'
const INK = '#0b3f25'
/** Share of the code the icon covers; level H recovers up to 30 % of it. */
const LOGO = 0.24

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fill()
}

function loadIcon(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = '/icon.svg'
  })
}

/** Paints the invite's QR: rounded dots and eyes, in the app's green, with its icon in the middle. */
async function paint(canvas: HTMLCanvasElement, link: string) {
  const { modules } = QRCode.create(link, { errorCorrectionLevel: 'H' })
  const count = modules.size
  const side = (count + QUIET * 2) * MODULE
  canvas.width = side
  canvas.height = side
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = PAPER
  roundRect(ctx, 0, 0, side, side, MODULE * 2)

  const logoModules = Math.ceil(count * LOGO) | 1
  const logoStart = (count - logoModules) / 2
  const inEye = (row: number, col: number) =>
    (row < 7 && col < 7) || (row < 7 && col >= count - 7) || (row >= count - 7 && col < 7)
  const inLogo = (row: number, col: number) =>
    row >= logoStart - 0.5 && row < logoStart + logoModules + 0.5 && col >= logoStart - 0.5 && col < logoStart + logoModules + 0.5

  ctx.fillStyle = INK
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!modules.get(row, col) || inEye(row, col) || inLogo(row, col)) continue
      ctx.beginPath()
      ctx.arc((QUIET + col + 0.5) * MODULE, (QUIET + row + 0.5) * MODULE, MODULE * 0.46, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // The three eyes: a rounded ring and a rounded centre.
  for (const [row, col] of [[0, 0], [0, count - 7], [count - 7, 0]]) {
    const x = (QUIET + col) * MODULE
    const y = (QUIET + row) * MODULE
    ctx.fillStyle = INK
    roundRect(ctx, x, y, MODULE * 7, MODULE * 7, MODULE * 2)
    ctx.fillStyle = PAPER
    roundRect(ctx, x + MODULE, y + MODULE, MODULE * 5, MODULE * 5, MODULE * 1.4)
    ctx.fillStyle = INK
    roundRect(ctx, x + MODULE * 2, y + MODULE * 2, MODULE * 3, MODULE * 3, MODULE)
  }

  const icon = await loadIcon()
  if (!icon) return
  const size = logoModules * MODULE
  const at = (QUIET + logoStart) * MODULE
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(at, at, size, size, size * 0.22)
  ctx.clip()
  ctx.drawImage(icon, at, at, size, size)
  ctx.restore()
}

export function InviteQr({ link, name }: { link: string; name: string }) {
  const { t } = useTranslation()
  const canvas = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  // Repainted when the code is renewed.
  useEffect(() => {
    if (!canvas.current) return
    setReady(false)
    let current = true
    void paint(canvas.current, link).then(() => current && setReady(true))
    return () => {
      current = false
    }
  }, [link])

  function onSave() {
    canvas.current?.toBlob(async (blob) => {
      if (!blob) return
      const file = new File([blob], `${t('groupSettings.qrFile', { name })}.png`, { type: 'image/png' })
      // Phones save images from the share sheet; elsewhere it downloads.
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] })
        } catch {
          // Cancelled by the player.
        }
        return
      }
      const url = URL.createObjectURL(file)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = file.name
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, 'image/png')
  }

  return (
    <div className={styles.qr}>
      <canvas ref={canvas} className={styles.canvas} role="img" aria-label={t('groupSettings.qrAlt', { name })} />
      <p className={styles.hint}>{t('groupSettings.qrHint')}</p>
      <button className={`btn ${styles.save}`} type="button" disabled={!ready} onClick={onSave}>
        {t('groupSettings.qrSave')}
      </button>
    </div>
  )
}
