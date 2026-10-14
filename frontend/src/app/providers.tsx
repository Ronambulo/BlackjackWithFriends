'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { SessionProvider } from '@/auth/SessionProvider'
import '@/i18n'
import { NoZoom } from '@/pwa/NoZoom'
import { RegisterServiceWorker } from '@/pwa/RegisterServiceWorker'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false } },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>{children}</SessionProvider>
      <RegisterServiceWorker />
      <NoZoom />
    </QueryClientProvider>
  )
}
