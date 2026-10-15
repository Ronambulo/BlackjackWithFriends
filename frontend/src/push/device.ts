'use client'

import { useEffect } from 'react'
import { useUser } from '@/auth/session-context'
import { api } from '@/lib/api'

// What this device is, as the admins' audiences see it: iPhone, Android or a
// computer, and whether the app runs from the home screen. The app tells the
// backend on opening (POST /api/devices), under an id kept in this device's storage.

export type Platform = 'ios' | 'android' | 'desktop'
export type Audience = 'all' | 'ios' | 'android' | 'desktop' | 'pwa' | 'browser' | 'push' | 'noPush'

export function platform(): Platform {
  const agent = navigator.userAgent
  // iPads ask for the desktop site and say they're Macs, but have a touch screen.
  if (/iPad|iPhone|iPod/.test(agent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/i.test(agent)) return 'android'
  return 'desktop'
}

/** Opened from the home screen (or as an installed app), not in a browser tab. */
export function standalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function deviceKind() {
  return { plataforma: platform(), pwa: standalone() }
}

const ID = 'device.id'

function deviceId() {
  try {
    let id = localStorage.getItem(ID)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(ID, id)
    }
    return id
  } catch {
    // No storage (private mode): this visit only.
    return null
  }
}

async function subscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return null
  if (Notification.permission !== 'granted') return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

/** Whether this device gets notifications now. */
export async function pushOn() {
  return (await subscription().catch(() => null)) !== null
}

/** Whether a notice for this audience is for this device. */
export function inAudience(audience: Audience, push: boolean) {
  switch (audience) {
    case 'all':
      return true
    case 'ios':
    case 'android':
    case 'desktop':
      return platform() === audience
    case 'pwa':
      return standalone()
    case 'browser':
      return !standalone()
    case 'push':
      return push
    case 'noPush':
      return !push
  }
}

/** Tells the backend what this device is, once per player and visit. */
export function useReportDevice() {
  const user = useUser()
  useEffect(() => {
    const id = deviceId()
    if (!id) return
    void (async () => {
      const sub = await subscription().catch(() => null)
      await api('/devices', {
        method: 'POST',
        body: { id, ...deviceKind(), push: sub !== null, endpoint: sub?.endpoint },
      }).catch(() => {})
    })()
  }, [user.id])
}
