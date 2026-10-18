// Database tables (SQLite via Drizzle). Change this file, then run
// `npm run db:generate -w @bwf/backend` to create a migration in drizzle/;
// the server applies pending migrations when it starts.
import { sql } from 'drizzle-orm'
import type { Card, Outcome, RoundState } from '@bwf/engine'
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core'

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

export const PUSH_KINDS = ['pay', 'overtaken', 'mention', 'message', 'reaction', 'closing', 'ceremony', 'review', 'news'] as const
export type PushKind = (typeof PUSH_KINDS)[number]
export type PushPrefs = Partial<Record<PushKind, boolean>>

export const PLATFORMS = ['ios', 'android', 'desktop'] as const
export type Platform = (typeof PLATFORMS)[number]

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
    // The style picked for each kind ('tapete' → 'tapete.neon'); a kind not here uses its free one (lib/cosmetics.ts).
    estilosEquipados: text('estilos_equipados', { mode: 'json' }).$type<Partial<Record<CosmeticKind, string>>>().notNull().default({}),
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
    // Up to when they've read the global chat; null: never opened it.
    chatLeido: timestamp('chat_leido'),
    // Push notifications switched off, by kind; a kind not here is on (lib/push.ts).
    avisos: text('avisos', { mode: 'json' }).$type<PushPrefs>().notNull().default({}),
    // When the player last changed their own username (not an admin), for the wait between changes.
    usuarioCambiado: timestamp('usuario_cambiado'),
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

/** The daily deck (lib/daily.ts): one seed a day, so everyone gets the same cards. */
export const dailyDecks = sqliteTable('daily_decks', {
  // 'YYYY-MM-DD', Madrid time
  dia: text('dia').primaryKey(),
  semilla: text('semilla').notNull(),
  // When the day's prizes went out; null until the day is over and closed.
  premiada: timestamp('premiada'),
  createdAt: createdAt(),
})

/** A player's go at a daily deck: virtual chips, nothing to do with the league balance. */
export const dailyRuns = sqliteTable(
  'daily_runs',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    dia: text('dia').notNull(),
    fichas: integer('fichas').notNull(),
    // One letter per finished hand: w won, l lost, p push.
    resultados: text('resultados').notNull().default(''),
    // The hand being played, or the last one.
    ronda: text('ronda', { mode: 'json' }).$type<RoundState>(),
    version: integer('version').notNull().default(0),
    terminada: timestamp('terminada'),
    // For the shared link (/r/<codigo>), once it's over.
    codigo: text('codigo').unique(),
    // Coins it won (1st of the day in a group), and when the player saw that they had.
    premio: integer('premio'),
    premioVisto: timestamp('premio_visto'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.dia] }), index('daily_runs_dia_idx').on(t.dia, t.fichas)],
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
    // Up to when they've read the group's chat; null: nothing read since joining.
    chatLeido: timestamp('chat_leido'),
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

export const ADJUSTMENT_KINDS = ['saldo', 'monedas'] as const
export type AdjustmentKind = (typeof ADJUSTMENT_KINDS)[number]

/** A balance or coins put right by hand from the admin panel, and why. */
export const adjustments = sqliteTable(
  'adjustments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    tipo: text('tipo', { enum: ADJUSTMENT_KINDS }).notNull(),
    // added (negative: taken away)
    cantidad: integer('cantidad').notNull(),
    motivo: text('motivo').notNull(),
    // username of the admin
    por: text('por').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('adjustments_user_idx').on(t.userId, t.createdAt)],
)

/** Something that went wrong, as a player tells it from the app. */
export const reports = sqliteTable(
  'reports',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    texto: text('texto').notNull(),
    // The app's screen and the browser it was sent from.
    ruta: text('ruta'),
    dispositivo: text('dispositivo'),
    resuelto: integer('resuelto', { mode: 'boolean' }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('reports_created_idx').on(t.createdAt), index('reports_user_idx').on(t.userId, t.createdAt)],
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

// ── Weekly seasons ──────────────────────────────────────────────────────────
// Written once, when a week closes (lib/season.ts), and never changed after.

/** A closed week, by its Monday ('YYYY-MM-DD', Madrid). */
export const seasons = sqliteTable('seasons', {
  semana: text('semana').primaryKey(),
  createdAt: createdAt(),
})

/** What a closed week's numbers were for one player, worked out from their hands. */
export interface SeasonStats {
  hands: number
  wins: number
  pushes: number
  losses: number
  blackjacks: number
  net: number
  bestWin: number
  /** The most staked in one round, doubles and splits included. */
  biggestBet: number
  /** Losses in a row, at most. */
  worstStreak: number
  insurances: number
}

/** Each player who played a closed week, once: final balance, numbers and the coins they got. */
export const seasonResults = sqliteTable(
  'season_results',
  {
    semana: text('semana')
      .notNull()
      .references(() => seasons.semana, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    saldoFinal: integer('saldo_final').notNull(),
    estadisticas: text('estadisticas', { mode: 'json' }).$type<SeasonStats>().notNull(),
    // The prize of their best place, plus the one for having played.
    monedas: integer('monedas').notNull(),
    // Best place among the groups that gave prizes; null if none did.
    mejorPuesto: integer('mejor_puesto'),
    // Whether they've watched that week's ceremony.
    vista: integer('vista', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.semana, t.userId] }), index('season_results_user_id_idx').on(t.userId)],
)

export const JOKE_PRIZES = ['blackjacks', 'biggestBet', 'worstStreak', 'hands', 'insurances'] as const
export type JokePrize = (typeof JOKE_PRIZES)[number]

/** A group's frozen ranking when a week closed: only the members who played that week. */
export const seasonStandings = sqliteTable(
  'season_standings',
  {
    semana: text('semana')
      .notNull()
      .references(() => seasons.semana, { onDelete: 'cascade' }),
    groupId: text('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    posicion: integer('posicion').notNull(),
    saldoFinal: integer('saldo_final').notNull(),
    // Whether the group gave prizes that week (2 or more players).
    conPremios: integer('con_premios', { mode: 'boolean' }).notNull(),
    trofeo: integer('trofeo', { mode: 'boolean' }).notNull().default(false),
    // The joke prizes this player took in this group.
    premios: text('premios', { mode: 'json' }).$type<JokePrize[]>().notNull().default([]),
  },
  (t) => [
    primaryKey({ columns: [t.semana, t.groupId, t.userId] }),
    index('season_standings_group_idx').on(t.groupId, t.semana),
    index('season_standings_user_idx').on(t.userId),
  ],
)

// ── Achievements ────────────────────────────────────────────────────────────

/** Each achievement a player has unlocked, once (lib/achievements.ts); the reward was paid then. */
export const achievements = sqliteTable(
  'achievements',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    logro: text('logro').notNull(),
    // Whether the player has been shown it (the toast at the table).
    visto: integer('visto', { mode: 'boolean' }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.logro] })],
)

// ── Daily challenges ────────────────────────────────────────────────────────

/** Each daily challenge a player has completed, once (lib/challenges.ts); the coins were paid then. */
export const challengeCompletions = sqliteTable(
  'challenge_completions',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // 'YYYY-MM-DD', Madrid
    dia: text('dia').notNull(),
    reto: text('reto').notNull(),
    monedas: integer('monedas').notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.dia, t.reto] }), index('challenge_completions_dia_idx').on(t.dia)],
)

// ── Styles ──────────────────────────────────────────────────────────────────

export const COSMETIC_KINDS = ['tapete', 'dorso', 'cartas', 'fichas', 'marco'] as const
export type CosmeticKind = (typeof COSMETIC_KINDS)[number]

/** Each style a player bought in the shop, once (lib/cosmetics.ts); free, achievement and trophy ones aren't stored. */
export const userCosmetics = sqliteTable(
  'user_cosmetics',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    estilo: text('estilo').notNull(),
    // What it cost then, in coins.
    monedas: integer('monedas').notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.estilo] }), index('user_cosmetics_estilo_idx').on(t.estilo)],
)

// ── Push notifications ──────────────────────────────────────────────────────

/** A device the player let send them notifications (lib/push.ts). */
export const pushSubscriptions = sqliteTable(
  'push_subscriptions',
  {
    endpoint: text('endpoint').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    // What the device said it is when it last opened the app; null until then.
    plataforma: text('plataforma', { enum: PLATFORMS }),
    pwa: integer('pwa', { mode: 'boolean' }),
    createdAt: createdAt(),
  },
  (t) => [index('push_subscriptions_user_idx').on(t.userId)],
)

// ── Devices, notices, campaigns and polls ──────────────────────────────────

/** Who an admin's notice, push or poll is for, judged per device. */
export const AUDIENCES = ['all', 'ios', 'android', 'desktop', 'pwa', 'browser', 'push', 'noPush'] as const
export type Audience = (typeof AUDIENCES)[number]

/** Each browser or installed app a player opens the app on, as it reports itself on opening. */
export const devices = sqliteTable(
  'devices',
  {
    // Made up by the device and kept in its storage.
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    plataforma: text('plataforma', { enum: PLATFORMS }).notNull(),
    // Opened from the home screen, not a browser tab.
    pwa: integer('pwa', { mode: 'boolean' }).notNull(),
    // Notifications allowed and subscribed on this device.
    push: integer('push', { mode: 'boolean' }).notNull(),
    createdAt: createdAt(),
    lastSeen: timestamp('last_seen').notNull(),
  },
  (t) => [index('devices_user_idx').on(t.userId), index('devices_last_seen_idx').on(t.lastSeen)],
)

/** A notice on top of the app, from `startsAt` until `expiresAt` (null: until removed). */
export const notices = sqliteTable('notices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  texto: text('texto').notNull(),
  audiencia: text('audiencia', { enum: AUDIENCES }).notNull().default('all'),
  startsAt: timestamp('starts_at').notNull(),
  expiresAt: timestamp('expires_at'),
  // username of the admin
  por: text('por').notNull(),
  createdAt: createdAt(),
})

/** Who has had a notice on screen. */
export const noticeViews = sqliteTable(
  'notice_views',
  {
    noticeId: integer('notice_id')
      .notNull()
      .references(() => notices.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // Closed it with the ✕, not just seen it.
    cerrado: integer('cerrado', { mode: 'boolean' }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.noticeId, t.userId] })],
)

/** A push an admin sends to everyone in an audience, now or at `sendAt`. */
export const pushCampaigns = sqliteTable(
  'push_campaigns',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    titulo: text('titulo').notNull(),
    cuerpo: text('cuerpo').notNull(),
    url: text('url').notNull().default('/'),
    audiencia: text('audiencia', { enum: AUDIENCES }).notNull().default('all'),
    sendAt: timestamp('send_at').notNull(),
    // null until it goes out
    sentAt: timestamp('sent_at'),
    dispositivos: integer('dispositivos').notNull().default(0),
    fallidos: integer('fallidos').notNull().default(0),
    por: text('por').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('push_campaigns_pending_idx').on(t.sentAt, t.sendAt)],
)

/** A question for the players, with two to six answers. */
export const polls = sqliteTable('polls', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pregunta: text('pregunta').notNull(),
  opciones: text('opciones', { mode: 'json' }).$type<string[]>().notNull(),
  // null: open until an admin closes it
  endsAt: timestamp('ends_at'),
  por: text('por').notNull(),
  createdAt: createdAt(),
})

/** One answer per player and poll; answering again replaces it. */
export const pollVotes = sqliteTable(
  'poll_votes',
  {
    pollId: integer('poll_id')
      .notNull()
      .references(() => polls.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // index into opciones
    opcion: integer('opcion').notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.pollId, t.userId] })],
)

// ── Chat ────────────────────────────────────────────────────────────────────

/** A finished hand as it's shown in the chat: no shoe, nothing hidden. */
export interface SharedHand {
  dealer: Card[]
  dealerTotal: number
  dealerBlackjack: boolean
  hands: { cards: Card[]; bet: number; total: number; outcome: Outcome }[]
  insurance: number
  net: number
}

/** A player's numbers, as published from their profile: this week's or all-time. */
export interface SharedStats {
  range: 'week' | 'total'
  hands: number
  wins: number
  pushes: number
  losses: number
  blackjacks: number
  bestWin: number
  bestStreak: number
  net: number
  wagered: number
}

/** A chat's message: text, or a hand or stats someone chose to publish (routes/chat.ts). */
export const messages = sqliteTable(
  'messages',
  {
    id: text('id').primaryKey(),
    // null: the global chat, open to every player.
    groupId: text('group_id').references(() => groups.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    texto: text('texto'),
    mano: text('mano', { mode: 'json' }).$type<SharedHand>(),
    estadisticas: text('estadisticas', { mode: 'json' }).$type<SharedStats>(),
    handId: text('hand_id').references(() => hands.id, { onDelete: 'set null' }),
    // The message this one answers; it stays a reply (to nothing) if that one goes.
    replyTo: text('reply_to').references((): AnySQLiteColumn => messages.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    index('messages_group_idx').on(t.groupId, t.createdAt),
    index('messages_created_idx').on(t.createdAt),
    // A hand goes to each chat once.
    uniqueIndex('messages_hand_idx').on(t.groupId, t.handId).where(sql`${t.handId} is not null`),
    uniqueIndex('messages_hand_global_idx').on(t.handId).where(sql`${t.handId} is not null and ${t.groupId} is null`),
    check('messages_content', sql`${t.texto} is not null or ${t.mano} is not null or ${t.estadisticas} is not null`),
  ],
)

export const REACTIONS = ['🔥', '😂', '💀', '👏', '😱'] as const

/** One reaction per player and message; picking another replaces it. */
export const reactions = sqliteTable(
  'reactions',
  {
    messageId: text('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    emoji: text('emoji').notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.userId] })],
)

export const authSchema = { user, session, account, verification, rateLimit }
