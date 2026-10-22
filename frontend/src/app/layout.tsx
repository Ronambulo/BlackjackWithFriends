import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Metadata, Viewport } from 'next'
import { Fraunces, IM_Fell_English_SC, Manrope, Tiny5 } from 'next/font/google'
import type { ReactNode } from 'react'
import './globals.css'
import { Providers } from './providers'

const manrope = Manrope({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
// Only for the lettering printed on the felt.
const fraunces = Fraunces({ subsets: ['latin'], style: 'italic', weight: '600', variable: '--font-felt', display: 'swap' })
// Only for the letters on the ouija felt, so it isn't preloaded.
const fell = IM_Fell_English_SC({ subsets: ['latin'], weight: '400', variable: '--font-ouija', display: 'swap', preload: false })
// Only for the numbers on the pixel-art chips, so it isn't preloaded.
const tiny5 = Tiny5({ subsets: ['latin'], weight: '400', variable: '--font-pixel', display: 'swap', preload: false })

// iOS 27.2 ignores manifest icons and only fetches apple-touch-icon lazily, so
// an installed PWA ends up with the letter fallback. Inlining the 180x180 PNG
// as a data: URI makes the icon part of the HTML itself (read at build time).
const appleTouchIcon = `data:image/png;base64,${readFileSync(
  join(process.cwd(), 'public/apple-touch-icon-180x180.png'),
).toString('base64')}`

// Link previews need absolute image URLs: SITE_URL (or else BETTER_AUTH_URL) is the address the app is reached at.
const siteUrl = process.env.SITE_URL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:5173'

const title = 'Blackjack with Friends'
const description = 'Tu liga semanal de blackjack con amigos. Juega cada día, sube en el ranking y gana la semana.'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: title,
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico?v=4', sizes: '48x48' },
      { url: '/icon.svg?v=4', type: 'image/svg+xml' },
    ],
    apple: [{ url: appleTouchIcon, sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: 'Blackjack', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    siteName: title,
    title,
    description,
    locale: 'es_ES',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: title }],
  },
  twitter: { card: 'summary_large_image', title, description, images: ['/og-image.png'] },
  // Next only emits mobile-web-app-capable; older iOS still wants the apple- one.
  other: { 'apple-mobile-web-app-capable': 'yes' },
}

export const viewport: Viewport = {
  themeColor: '#0a0c0f',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  // No zoom in the app (pinch and double tap); see also NoZoom and globals.css.
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${manrope.variable} ${fraunces.variable} ${tiny5.variable} ${fell.variable}`} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
