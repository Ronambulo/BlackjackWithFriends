// The whole API in one fetch handler, routed by pathname. server.ts serves it.
import { DEFAULT_RULES } from '@bwf/engine'
import { clientIp, isAdmin, isBanned } from '../lib/admin.js'
import { record, recordError } from '../lib/metrics.js'
import { announcement, isOn } from '../lib/settings.js'
import { auth, requireUser } from '../lib/auth.js'
import { sql } from 'drizzle-orm'
import { db } from '../lib/db.js'
import { eventStream, groupmates, notifyAll, notifyGroups } from '../lib/events.js'
import { HttpError, json } from '../lib/http.js'
import { watchOvertakes } from '../lib/push.js'
import { closePastWeeks } from '../lib/season.js'
import { serveMedia } from '../lib/storage.js'
import {
  createGroup,
  getGroup,
  getGroupHistory,
  getInvite,
  getInvitePreview,
  joinGroup,
  kickMember,
  leaveGroup,
  listGroups,
  patchGroup,
  renewCode,
} from '../routes/groups.js'
import {
  banIp,
  decideReview,
  deleteUser,
  getAdminLog,
  getAdminSettings,
  getBackups,
  postAnnouncement,
  postBackup,
  postFlag,
  postRules,
  getEconomy,
  getAdminLeague,
  getModeration,
  getSystem,
  getUserDetail,
  getAdminStats,
  listBans,
  listUsers,
  unbanIp,
} from '../routes/admin.js'
import { getAchievements, postAchievementsSeen } from '../routes/achievements.js'
import { getAdminChallenges, getChallenges, postAdminChallenges } from '../routes/challenges.js'
import { deleteMessage, getChat, getUnread, postMessage, postReaction, share } from '../routes/chat.js'
import { getLeague, postPay } from '../routes/league.js'
import { getFriendsRanking, getGlobalRanking } from '../routes/ranking.js'
import { getTable, postPlay } from '../routes/play.js'
import { getPushKey, getPushPrefs, patchPushPrefs, postPushTest, postSubscribe, postUnsubscribe } from '../routes/push.js'
import { getProfile, patchProfile, postAvatar } from '../routes/profile.js'
import { getCeremony, getGroupSeasons, postCeremonySeen } from '../routes/season.js'
import { getStats } from '../routes/stats.js'

type Route = (request: Request) => Promise<Response> | Response
type Routes = Record<string, Partial<Record<string, Route>>>

/**
 * A change other players see in their rankings: once it succeeds, everyone who shared
 * a group with the player before or after it (so joins, leaves and kicks count) is told.
 */
function live(fn: Route): Route {
  return async (request) => {
    const me = await requireUser(request)
    const before = groupmates(me.id)
    const response = await fn(request)
    if (response.ok) {
      const others = new Set([...before, ...groupmates(me.id)])
      // The player's own app already refreshes after its own change.
      others.delete(me.id)
      notifyGroups(others)
    }
    return response
  }
}

/** A change to the player's balance: groupmates they go past may get a notification (lib/push.ts). */
function race(fn: Route): Route {
  return async (request) => {
    const me = await requireUser(request)
    return watchOvertakes(me.id, async () => fn(request))
  }
}

const routes: Routes = {
  // Quick check that the API is up and wired correctly.
  '/api/health': {
    GET: () =>
      json({
        ok: true,
        time: new Date().toISOString(),
        // The container's healthcheck: fails if the database can't be read.
        database: db().get<{ ok: number }>(sql`select 1 as ok`)?.ok === 1,
        // Proves the shared engine is wired in.
        rules: DEFAULT_RULES,
      }),
  },
  '/api/me': {
    GET: async (request) => {
      const me = await requireUser(request)
      return json({ ...me, admin: isAdmin(me.id) })
    },
  },
  '/api/profile': {
    GET: getProfile,
    PATCH: live(patchProfile),
  },
  '/api/profile/avatar': { POST: live(postAvatar) },
  '/api/profile/stats': { GET: getStats },
  '/api/achievements': { GET: getAchievements },
  '/api/achievements/seen': { POST: postAchievementsSeen },
  '/api/challenges': { GET: getChallenges },
  '/api/push/key': { GET: getPushKey },
  '/api/push/subscribe': { POST: postSubscribe },
  '/api/push/unsubscribe': { POST: postUnsubscribe },
  '/api/push/prefs': { GET: getPushPrefs, PATCH: patchPushPrefs },
  '/api/push/test': { POST: postPushTest },
  '/api/play': {
    GET: getTable,
    POST: live(race(postPlay)),
  },
  '/api/league': { GET: getLeague },
  '/api/league/pay': { POST: live(race(postPay)) },
  '/api/ranking/friends': { GET: getFriendsRanking },
  '/api/ranking/global': { GET: getGlobalRanking },
  '/api/groups': { GET: listGroups, POST: createGroup },
  '/api/groups/join': { POST: live(joinGroup) },
  '/api/group': { GET: getGroup, PATCH: live(patchGroup) },
  '/api/group/history': { GET: getGroupHistory },
  '/api/group/seasons': { GET: getGroupSeasons },
  '/api/ceremony': { GET: getCeremony },
  '/api/ceremony/seen': { POST: postCeremonySeen },
  '/api/group/leave': { POST: live(leaveGroup) },
  '/api/group/renew': { POST: live(renewCode) },
  '/api/group/kick': { POST: live(kickMember) },
  '/api/chat': { GET: getChat, POST: postMessage },
  '/api/chat/share': { POST: share },
  '/api/chat/unread': { GET: getUnread },
  '/api/chat/react': { POST: postReaction },
  '/api/chat/delete': { POST: deleteMessage },
  '/api/invite': { GET: getInvite },
  '/api/invite/preview': { GET: getInvitePreview },
  // The app's own admins (ADMIN_USERNAMES); a 404 for everyone else.
  '/api/admin/stats': { GET: getAdminStats },
  '/api/admin/economy': { GET: getEconomy },
  '/api/admin/league': { GET: getAdminLeague },
  '/api/admin/system': { GET: getSystem },
  '/api/admin/moderation': { GET: getModeration },
  '/api/admin/users': { GET: listUsers },
  '/api/admin/users/detail': { GET: getUserDetail },
  '/api/admin/users/delete': { POST: deleteUser },
  '/api/admin/bans': { GET: listBans, POST: banIp },
  '/api/admin/bans/delete': { POST: unbanIp },
  '/api/admin/reviews': { POST: decideReview },
  '/api/admin/settings': { GET: getAdminSettings },
  '/api/admin/flags': { POST: postFlag },
  '/api/admin/announcement': { POST: postAnnouncement },
  '/api/admin/rules': { POST: postRules },
  '/api/admin/challenges': { GET: getAdminChallenges, POST: postAdminChallenges },
  '/api/admin/backups': { GET: getBackups, POST: postBackup },
  '/api/admin/log': { GET: getAdminLog },
  // The notice the admins put on top of the app, for everyone.
  '/api/announcement': { GET: async () => json(announcement()) },
  // Live updates (lib/events.ts).
  '/api/events': {
    GET: async (request) => eventStream((await requireUser(request)).id),
  },
}

async function route(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url)
  const path = pathname.replace(/\/+$/, '') || '/'
  // Banned addresses get nothing, signing in included.
  if (isBanned(clientIp(request))) throw new HttpError(403, 'Acceso bloqueado')

  // Switches from the admin panel (lib/settings.ts).
  if (path.startsWith('/api/auth/sign-up') && !isOn('signups')) throw new HttpError(503, 'Ahora mismo no se pueden crear cuentas')
  if (path === '/api/groups/join' && !isOn('invites')) throw new HttpError(503, 'Las invitaciones están paradas un momento')
  if (path === '/api/auth' || path.startsWith('/api/auth/')) return auth().handler(request)
  // Uploaded photos (lib/storage.ts): public, like any picture on a page.
  if (path.startsWith('/api/media/') && request.method === 'GET') return serveMedia(path)

  const methods = routes[path]
  if (!methods) throw new HttpError(404, 'No existe')
  const fn = methods[request.method]
  if (!fn) throw new HttpError(405, 'Método no permitido')
  // A week that ended while the server was off closes before anyone's balance resets.
  if (closePastWeeks()) notifyAll()
  return fn(request)
}

export default {
  async fetch(request: Request): Promise<Response> {
    const started = performance.now()
    const path = new URL(request.url).pathname
    let response: Response
    try {
      response = await route(request)
    } catch (err) {
      if (err instanceof HttpError) response = json({ error: err.message }, err.status)
      else {
        console.error(err)
        recordError(path, 500, err)
        response = json({ error: 'Error interno' }, 500)
      }
    }
    // The event stream stays open; its time says nothing.
    if (path !== '/api/events') record(path, response.status, performance.now() - started)
    return response
  },
}
