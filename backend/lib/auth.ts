import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { emailOTP } from 'better-auth/plugins'
import { db } from './db.js'
import { languageFrom, sendOtpEmail } from './email.js'
import { HttpError } from './http.js'
import { authSchema } from './schema.js'

function createAuth() {
  // The frontend URL: the app calls /api/auth/* on its own origin (Next rewrites
  // it here), so the session cookie belongs to the frontend's domain.
  const appUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:5173'
  return betterAuth({
    appName: 'Blackjack with Friends',
    baseURL: appUrl,
    basePath: '/api/auth',
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [appUrl, 'http://localhost:5173', 'http://localhost:4173'],
    database: drizzleAdapter(db(), { provider: 'pg', schema: authSchema }),
    session: {
      // Players stay signed in; the session renews while they keep using the app.
      expiresIn: 60 * 60 * 24 * 60,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    rateLimit: { storage: 'database' },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 5 * 60,
        allowedAttempts: 5,
        storeOTP: 'hashed',
        async sendVerificationOTP({ email, otp }, ctx) {
          await sendOtpEmail(email, otp, languageFrom(ctx?.headers))
        },
      }),
    ],
  })
}

let instance: ReturnType<typeof createAuth> | undefined

export function auth() {
  return (instance ??= createAuth())
}

export interface SessionUser {
  id: string
  email: string
}

/** The signed-in user, from the session cookie. */
export async function requireUser(request: Request): Promise<SessionUser> {
  const result = await auth().api.getSession({ headers: request.headers })
  if (!result) throw new HttpError(401, 'Falta la sesión')
  return { id: result.user.id, email: result.user.email }
}
