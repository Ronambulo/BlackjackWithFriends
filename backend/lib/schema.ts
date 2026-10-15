// Database tables (SQLite via Drizzle). Change this file, then run
// `npm run db:generate -w @bwf/backend` to create a migration in drizzle/;
// the server applies pending migrations when it starts.
import { sql } from 'drizzle-orm'
import type { RoundState } from '@bwf/engine'
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

// Timestamps are milliseconds since 1970; Drizzle turns them into Dates.
const timestamp = (name: string) => integer(name, { mode: 'timestamp_ms' })
const createdAt = () =>
  timestamp('created_at')
    .notNull()
    .$defaultFn(() => new Date())
const updatedAt = () =>
  timestamp('updated_at')
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())

// ── Better Auth ─────────────────────────────────────────────────────────────
// Same fields as Better Auth's core tables (user, session, account, verification,
// rateLimit, plus the username plugin). The property names are what Better Auth reads; columns are snake_case.

export const user = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  // username plugin: lowercased for sign in, and as typed for display
  username: text('username').unique(),
  displayUsername: text('display_username'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const session = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
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

export const account = sqliteTable(
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
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('accounts_user_id_idx').on(t.userId)],
)

export const verification = sqliteTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('verifications_identifier_idx').on(t.identifier)],
)

export const rateLimit = sqliteTable('rate_limits', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: integer('last_request').notNull(),
})

// ── App ─────────────────────────────────────────────────────────────────────

export const LANGUAGES = ['es', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

/** One per user, created the first time they open the app. */
export const profiles = sqliteTable(
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
    estilosEquipados: text('estilos_equipados', { mode: 'json' }).notNull().default({}),
    // League chips: one balance shared by all the player's groups (see lib/league.ts).
    saldo: integer('saldo').notNull().default(1000),
    // Dates are 'YYYY-MM-DD' in Madrid time, set by the server (lib/league.ts):
    // SQLite knows nothing about time zones.
    // Monday of the week the balance belongs to; an older one means it's due a
    // reset to the starting balance.
    semana: text('semana').notNull(),
    // Last day whose pay was claimed, null if none this week.
    ultimaPaga: text('ultima_paga'),
    // The balance at the start of `dia`, for the day's change in the ranking.
    saldoInicioDia: integer('saldo_inicio_dia').notNull().default(1000),
    dia: text('dia').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check('profiles_nombre_len', sql`${t.nombre} is null or length(trim(${t.nombre})) between 2 and 20`),
    check('profiles_idioma', sql`${t.idioma} in ('es', 'en')`),
    check('profiles_monedas', sql`${t.monedas} >= 0`),
    // Also what stops a bet or a double the player can't afford (see routes/play.ts).
    check('profiles_saldo', sql`${t.saldo} >= 0`),
  ],
)

export const HAND_MODES = ['liga'] as const
export const HAND_PHASES = ['insurance', 'player', 'settled'] as const

/** One round at the table, saved after every action so it can be resumed. */
export const hands = sqliteTable(
  'hands',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // 'baraja_del_dia' arrives later
    modo: text('modo', { enum: HAND_MODES }).notNull(),
    apuesta: integer('apuesta').notNull(),
    // The engine's whole state, shoe included: never sent to the app as is.
    ronda: text('ronda', { mode: 'json' }).$type<RoundState>().notNull(),
    fase: text('fase', { enum: HAND_PHASES }).notNull(),
    // Bumped on every action, so two taps at once can't both apply.
    version: integer('version').notNull().default(0),
    // Chips won or lost, once settled.
    neto: integer('neto'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('hands_user_id_idx').on(t.userId, t.createdAt),
    // At most one unfinished hand per player and mode.
    uniqueIndex('hands_one_open_idx').on(t.userId, t.modo).where(sql`${t.fase} <> 'settled'`),
    check('hands_apuesta', sql`${t.apuesta} > 0`),
  ],
)

/** Every claim of the daily pay this week, for the groups' chart; older ones are deleted. */
export const pays = sqliteTable(
  'pays',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    cantidad: integer('cantidad').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('pays_user_id_idx').on(t.userId, t.createdAt)],
)

export const GROUP_ROLES = ['admin', 'miembro'] as const
export type GroupRole = (typeof GROUP_ROLES)[number]

export interface GroupSettings {
  /** Leave the ranking out of the invite link preview. */
  ocultarRanking?: boolean
}

/** A group of friends: a ranking of its members by their league balance. */
export const groups = sqliteTable(
  'groups',
  {
    id: text('id').primaryKey(),
    nombre: text('nombre').notNull(),
    // Long and random so it can't be guessed; the admin can renew it.
    codigoInvitacion: text('codigo_invitacion').notNull().unique(),
    ajustes: text('ajustes', { mode: 'json' }).$type<GroupSettings>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [check('groups_nombre_len', sql`length(trim(${t.nombre})) between 2 and 30`)],
)

export const groupMembers = sqliteTable(
  'group_members',
  {
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // The creator is the admin; if they leave, the longest-standing member takes over.
    rol: text('rol', { enum: GROUP_ROLES }).notNull().default('miembro'),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.groupId, t.userId] }),
    index('group_members_user_id_idx').on(t.userId),
    check('group_members_rol', sql`${t.rol} in ('admin', 'miembro')`),
  ],
)

/** Addresses the admin has shut out: every request from them gets a 403. */
export const ipBans = sqliteTable('ip_bans', {
  ip: text('ip').primaryKey(),
  motivo: text('motivo'),
  // null: for good
  expiresAt: timestamp('expires_at'),
  // username of the admin who put it in place
  por: text('por'),
  createdAt: createdAt(),
})

export const REVIEW_KINDS = ['foto', 'nombre'] as const

/**
 * Photos and names waiting for an admin to look at them. They show in the app
 * straight away; rejecting one takes it down. A newer change replaces the older one.
 */
export const reviews = sqliteTable(
  'reviews',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    tipo: text('tipo', { enum: REVIEW_KINDS }).notNull(),
    // the name, or the photo's URL
    valor: text('valor').notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.tipo] }), check('reviews_tipo', sql`${t.tipo} in ('foto', 'nombre')`)],
)

/** What each admin did and to whom, newest last. */
export const adminLog = sqliteTable(
  'admin_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    // username, kept even if the account goes
    admin: text('admin').notNull(),
    accion: text('accion').notNull(),
    objetivo: text('objetivo'),
    detalle: text('detalle'),
    createdAt: createdAt(),
  },
  (t) => [index('admin_log_created_at_idx').on(t.createdAt)],
)

/** Small switches and values the admins change from the panel (feature flags, the notice for everyone). */
export const settings = sqliteTable('settings', {
  clave: text('clave').primaryKey(),
  valor: text('valor', { mode: 'json' }).notNull(),
  updatedAt: updatedAt(),
})

/** The league economy from a given Monday on; the newest row not after a week is that week's. */
export const economyRules = sqliteTable(
  'economy_rules',
  {
    semana: text('semana').primaryKey(),
    saldoInicial: integer('saldo_inicial').notNull(),
    pagaDiaria: integer('paga_diaria').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check('economy_rules_saldo', sql`${t.saldoInicial} between 1 and 1000000`),
    check('economy_rules_paga', sql`${t.pagaDiaria} between 0 and 1000000`),
  ],
)

export const authSchema = { user, session, account, verification, rateLimit }
