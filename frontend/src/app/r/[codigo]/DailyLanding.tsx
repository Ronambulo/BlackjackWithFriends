'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Splash } from '@/ui/Splash'

/** Sends a person on to today's deck (signing in first if they have to). */
export function DailyLanding() {
  const router = useRouter()
  useEffect(() => router.replace('/jugar/baraja'), [router])
  return <Splash />
}
