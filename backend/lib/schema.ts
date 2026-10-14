// Database tables (Neon Postgres via Drizzle). Change this file, then run
// `npm run db:generate -w @bwf/backend` to create a migration in drizzle/.
import { sql } from 'drizzle-orm'
import { bigint, boolean, check, index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())

// ── Better Auth ─────────────────────────────────────────────────────────────
// Same fields as Better Auth's core tables (user, session, account, verification,
// rateLimit). The property names are what Better Auth reads; columns are snake_case.

export const user = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const session = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('sessions_user_id_idx').on(t.userId)],
)

export const account = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('accounts_user_id_idx').on(t.userId)],
)

export const verification = pgTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('verifications_identifier_idx').on(t.identifier)],
)

export const rateLimit = pgTable('rate_limits', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
})

// ── App ─────────────────────────────────────────────────────────────────────

export const LANGUAGES = ['es', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

/** One per user, created the first time they open the app. */
export const profiles = pgTable(
  'profiles',
  {
    id: text('id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    // null until the player picks one on first sign-in
    nombre: text('nombre'),
    avatarUrl: text('avatar_url'),
    idioma: text('idioma', { enum: LANGUAGES }).notNull().default('es'),
    // only the server changes them (prizes, shop)
    monedas: integer('monedas').notNull().default(0),
    estilosEquipados: jsonb('estilos_equipados').notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    check('profiles_nombre_len', sql`${t.nombre} is null or char_length(btrim(${t.nombre})) between 2 and 20`),
    check('profiles_idioma', sql`${t.idioma} in ('es', 'en')`),
    check('profiles_monedas', sql`${t.monedas} >= 0`),
  ],
)

export const authSchema = { user, session, account, verification, rateLimit }
