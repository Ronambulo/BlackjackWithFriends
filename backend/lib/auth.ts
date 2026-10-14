import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { username } from 'better-auth/plugins'
import { db } from './db.js'
import { HttpError } from './http.js'
import { authSchema } from './schema.js'

const USERNAME_MIN = 3
const USERNAME_MAX = 20
const PASSWORD_MIN = 8

function createAuth() {
  // The frontend URL: the app calls /api/auth/* on its own origin (Next rewrites
  // it here), so the session cookie belongs to the frontend's domain.
  const appUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:5173'
  // More addresses the app may be opened from (the server's LAN IP, a tunnel...), comma separated.
  const extraOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  return betterAuth({
    appName: 'Blackjack with Friends',
    baseURL: appUrl,
    basePath: '/api/auth',
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [appUrl, ...extraOrigins, 'http://localhost:5173', 'http://localhost:3000'],
    database: drizzleAdapter(db(), { provider: 'sqlite', schema: authSchema }),
    session: {
      // Players stay signed in until they sign out themselves: 400 days is the most
      // browsers allow for a cookie, and every day of use pushes the expiry forward again.
      expiresIn: 60 * 60 * 24 * 400,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    rateLimit: { storage: 'database' },
    // Players come through Cloudflare and Next's rewrite, so x-forwarded-for is a chain
    // Better Auth won't trust. Without a client IP every player shares one rate-limit
    // bucket and a few sign-ins lock everyone out. cf-connecting-ip is the real client.
    advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'] } },
    // Classic username + password. Better Auth still wants an email, so the app
    // signs up with a made-up one (see frontend/src/auth/LoginScreen.tsx); nothing is ever emailed.
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    plugins: [username({ minUsernameLength: USERNAME_MIN, maxUsernameLength: USERNAME_MAX })],
  })
}

let instance: ReturnType<typeof createAuth> | undefined

export function auth() {
  return (instance ??= createAuth())
}

export interface SessionUser {
  id: string
  /** The username as the player typed it when signing up */
  name: string
}

/** The signed-in user, from the session cookie. */
export async function requireUser(request: Request): Promise<SessionUser> {
  const result = await auth().api.getSession({ headers: request.headers })
  if (!result) throw new HttpError(401, 'Falta la sesión')
  return { id: result.user.id, name: result.user.name }
}
