'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { useUser } from '@/auth/session-context'
import { api } from '@/lib/api'
import { deviceKind, platform, standalone } from './device'

export const PUSH_KINDS = ['pay', 'overtaken', 'mention', 'message', 'reaction', 'closing', 'ceremony', 'review', 'news'] as const
export type PushKind = (typeof PUSH_KINDS)[number]
export type PushPrefs = Record<PushKind, boolean>

/** Whether this device gets notifications, or why it can't. */
export type PushState = 'loading' | 'unsupported' | 'needsInstall' | 'denied' | 'off' | 'on'

function supported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** iOS only lets a web app have notifications once it's on the home screen. */
function iosBrowser() {
  return platform() === 'ios' && !standalone()
}

/** The VAPID key comes base64url-encoded; the browser wants the bytes. */
function keyBytes(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

/** The service worker; registered here too, since the app only does it in production. */
async function registration() {
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'))
}

async function currentSubscription() {
  if (!supported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

/** This device's notifications: its state and a switch for it. */
export function usePush() {
  const [state, setState] = useState<PushState>('loading')
  const [busy, setBusy] = useState(false)
  // Why the last try didn't work: the browser didn't grant it, or something broke (with its message).
  const [problem, setProblem] = useState<{ kind: 'dismissed' | 'failed'; detail?: string } | null>(null)

  useEffect(() => {
    let live = true
    void (async () => {
      let next: PushState
      if (!supported()) next = iosBrowser() ? 'needsInstall' : 'unsupported'
      else if (Notification.permission === 'denied') next = 'denied'
      else {
        const sub = await currentSubscription().catch(() => null)
        // Tell the backend again, in case it dropped it or another account used the device.
        if (sub) void api('/push/subscribe', { method: 'POST', body: { ...sub.toJSON(), ...deviceKind() } }).catch(() => {})
        next = sub ? 'on' : 'off'
      }
      if (live) setState(next)
    })()
    return () => {
      live = false
    }
  }, [])

  const toggle = useCallback(async () => {
    setBusy(true)
    setProblem(null)
    try {
      if (state === 'on') {
        const sub = await currentSubscription()
        if (sub) {
          await api('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(() => {})
          await sub.unsubscribe()
        }
        setState('off')
        return
      }
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off')
        // Closed, or Chrome's quiet prompt (a crossed-out bell in the address bar).
        if (permission === 'default') setProblem({ kind: 'dismissed' })
        return
      }
      const reg = await registration()
      await navigator.serviceWorker.ready
      const { key } = await api<{ key: string }>('/push/key')
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }))
      await api('/push/subscribe', { method: 'POST', body: { ...sub.toJSON(), ...deviceKind() } })
      setState('on')
    } catch (error) {
      console.error('Push subscription failed', error)
      setProblem({ kind: 'failed', detail: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(false)
    }
  }, [state])

  return { state, busy, problem, toggle }
}

/** Stops this device getting the player's notifications, e.g. when signing out. */
export async function forgetDevice() {
  const sub = await currentSubscription().catch(() => null)
  if (!sub) return
  await api('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(() => {})
  await sub.unsubscribe().catch(() => {})
}

export function usePushPrefs() {
  const user = useUser()
  return useQuery({
    queryKey: ['pushPrefs', user.id],
    queryFn: () => api<PushPrefs>('/push/prefs'),
  })
}

export function useUpdatePushPrefs() {
  const user = useUser()
  const queryClient = useQueryClient()
  const key = ['pushPrefs', user.id]
  return useMutation({
    mutationFn: (patch: Partial<PushPrefs>) => api<PushPrefs>('/push/prefs', { method: 'PATCH', body: patch }),
    // Flip it straight away; the switch shouldn't wait for the network.
    onMutate: (patch) => {
      const before = queryClient.getQueryData<PushPrefs>(key)
      if (before) queryClient.setQueryData(key, { ...before, ...patch })
      return { before }
    },
    onError: (_error, _patch, context) => {
      if (context?.before) queryClient.setQueryData(key, context.before)
    },
    onSuccess: (prefs) => queryClient.setQueryData(key, prefs),
  })
}

/** Sends a test notification to the player's devices; says how many and which failed. */
export function useTestPush() {
  return useMutation({
    mutationFn: () => api<{ devices: number; failed: string[] }>('/push/test', { method: 'POST' }),
  })
}
