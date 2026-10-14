'use client'

import { emailOTPClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

/**
 * Better Auth in the browser. It calls /api/auth/* on this same origin (Next
 * rewrites it to the backend), and the session lives in an httpOnly cookie.
 */
export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
})

export type AuthSession = typeof authClient.$Infer.Session
