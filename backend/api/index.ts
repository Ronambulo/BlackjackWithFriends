// The whole API in one fetch handler, routed by pathname. server.ts serves it.
import { DEFAULT_RULES } from '@bwf/engine'
import { clientIp, isAdmin, isBanned, roleOf } from '../lib/admin.js'
import { record, recordError } from '../lib/metrics.js'
import { isOn, maintenance } from '../lib/settings.js'
import { auth, requireUser } from '../lib/auth.js'
import { sql } from 'drizzle-orm'
import { db } from '../lib/db.js'
import { eventStream, groupmates, notifyAll, notifyGroups } from '../lib/events.js'
import { HttpError, json } from '../lib/http.js'
import { watchOvertakes } from '../lib/push.js'
import { closePastWeeks } from '../lib/season.js'
import { closePastDays } from '../lib/daily.js'
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
  downloadBackup,
  getBackups,
  postBackup,
  renameUser,
  postFlag,
  postRules,
  getAdminEvents,
  getAdminShop,
  postAdminEvent,
  postShopItem,
  postShopOrder,
  postShopSale,
  getEconomy,
  getAdminLeague,
  getModeration,
  getSystem,
  getUserDetail,
  adjustAll,
  adjustUser,
  postRestore,
  postMaintenance,
  getReports,
  resolveReport,
  deleteReport,
  getExport,
  getAdminStats,
  listBans,
  listUsers,
  unbanIp,
} from '../routes/admin.js'
import {
  closeSessions,
  resetWeek,
  deleteEvent,
  deleteNote,
  dismissInbox,
  endTest,
  getAutomations,
  getCalendar,
  getCoinFlow,
  getEvents,
  getFeed,
  getInbox,
  getLive,
  getSegments,
  getTeam,
  getTests,
  postAutomation,
  postEvent,
  postMarks,
  postNote,
  postSegment,
  postTeam,
  postTest,
  removeAvatar,
  undoLog,
  viewAsPlayer,
  pushUser,
} from '../routes/admin-tools.js'
import {
  closePoll,
  deleteCampaign,
  deletePoll,
  endNotice,
  getAdminNotices,
  getAdminPolls,
  getNotices,
  getPolls,
  legacyAnnouncement,
  postCampaign,
  postDevice,
  postNotice,
  postNoticeSeen,
  postPoll,
  postVote,
} from '../routes/notices.js'
import { getAchievements, postAchievementsSeen } from '../routes/achievements.js'
import { getCosmetics, postBuy, postEquip, postEventBox } from '../routes/cosmetics.js'
import { getAdminChallenges, getChallenges, postAdminChallenges } from '../routes/challenges.js'
import { deleteMessage, getChat, getLatest, getUnread, postMessage, postReaction, share } from '../routes/chat.js'
import { getLeague, postPay } from '../routes/league.js'
import { getFriendsRanking, getGlobalRanking } from '../routes/ranking.js'
import { getTable, postPlay } from '../routes/play.js'
import { getDaily, getDailyPreview, getDailyRanking, postDaily, postDailySeen } from '../routes/daily.js'
import { getPushKey, getPushPrefs, patchPushPrefs, postPushTest, postSubscribe, postUnsubscribe } from '../routes/push.js'
import { getProfile, patchProfile, postAvatar } from '../routes/profile.js'
import { getCeremony, getCeremonyReplay, getGroupSeasons, postCeremonySeen } from '../routes/season.js'
import { getStats } from '../routes/stats.js'
import { postReport } from '../routes/reports.js'

type Route = (request: Request) => Promise<Response> | Response

// What still works for players while the app is in maintenance: signing in, knowing who they are and when it's back.
const OPEN_IN_MAINTENANCE = new Set(['/api/health', '/api/status', '/api/me'])

async function signedInAdmin(request: Request): Promise<boolean> {
  try {
    return isAdmin((await requireUser(request)).id)
  } catch {
    return false
  }
}
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
  // Whether the app is open; public, so the maintenance screen can tell when it's back.
  '/api/status': { GET: () => json({ maintenance: maintenance() }) },
  '/api/me': {
    GET: async (request) => {
      const me = await requireUser(request)
      const role = roleOf(me.id)
      return json({ ...me, admin: role !== null, role })
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
  '/api/cosmetics': { GET: getCosmetics },
  // The frame shows next to the player's name for their groupmates too.
  '/api/cosmetics/equip': { POST: live(postEquip) },
  '/api/cosmetics/buy': { POST: live(postBuy) },
  '/api/cosmetics/box': { POST: postEventBox },
  '/api/push/key': { GET: getPushKey },
  '/api/push/subscribe': { POST: postSubscribe },
  '/api/push/unsubscribe': { POST: postUnsubscribe },
  '/api/push/prefs': { GET: getPushPrefs, PATCH: patchPushPrefs },
  '/api/push/test': { POST: postPushTest },
  '/api/play': {
    GET: getTable,
    POST: live(race(postPlay)),
  },
  // The daily deck: virtual chips, apart from the league; its prizes are coins (lib/daily.ts).
  '/api/daily': { GET: getDaily, POST: postDaily },
  '/api/daily/seen': { POST: postDailySeen },
  '/api/daily/ranking': { GET: getDailyRanking },
  '/api/daily/preview': { GET: getDailyPreview },
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
  '/api/ceremony/replay': { GET: getCeremonyReplay },
  '/api/ceremony/seen': { POST: postCeremonySeen },
  '/api/group/leave': { POST: live(leaveGroup) },
  '/api/group/renew': { POST: live(renewCode) },
  '/api/group/kick': { POST: live(kickMember) },
  '/api/chat': { GET: getChat, POST: postMessage },
  '/api/chat/share': { POST: share },
  '/api/chat/unread': { GET: getUnread },
  '/api/chat/latest': { GET: getLatest },
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
  '/api/admin/users/rename': { POST: renameUser },
  '/api/admin/users/adjust': { POST: adjustUser },
  '/api/admin/users/adjust-all': { POST: adjustAll },
  '/api/admin/bans': { GET: listBans, POST: banIp },
  '/api/admin/bans/delete': { POST: unbanIp },
  '/api/admin/reviews': { POST: decideReview },
  '/api/admin/settings': { GET: getAdminSettings },
  '/api/admin/flags': { POST: postFlag },
  '/api/admin/notices': { GET: getAdminNotices, POST: postNotice },
  '/api/admin/notices/end': { POST: endNotice },
  '/api/admin/campaigns': { POST: postCampaign },
  '/api/admin/campaigns/delete': { POST: deleteCampaign },
  '/api/admin/polls': { GET: getAdminPolls, POST: postPoll },
  '/api/admin/polls/close': { POST: closePoll },
  '/api/admin/polls/delete': { POST: deletePoll },
  '/api/admin/rules': { POST: postRules },
  '/api/admin/shop': { GET: getAdminShop },
  '/api/admin/shop/item': { POST: postShopItem },
  '/api/admin/shop/order': { POST: postShopOrder },
  '/api/admin/shop/sale': { POST: postShopSale },
  '/api/admin/event-boxes': { GET: getAdminEvents, POST: postAdminEvent },
  '/api/admin/challenges': { GET: getAdminChallenges, POST: postAdminChallenges },
  '/api/admin/backups': { GET: getBackups, POST: postBackup },
  '/api/admin/backups/download': { GET: downloadBackup },
  '/api/admin/backups/restore': { POST: postRestore },
  '/api/admin/maintenance': { POST: postMaintenance },
  '/api/admin/reports': { GET: getReports },
  '/api/admin/reports/resolve': { POST: resolveReport },
  '/api/admin/reports/delete': { POST: deleteReport },
  '/api/admin/export': { GET: getExport },
  '/api/admin/log': { GET: getAdminLog },
  '/api/admin/log/undo': { POST: undoLog },
  '/api/admin/inbox': { GET: getInbox },
  '/api/admin/inbox/dismiss': { POST: dismissInbox },
  '/api/admin/live': { GET: getLive },
  '/api/admin/feed': { GET: getFeed },
  '/api/admin/marks': { POST: postMarks },
  '/api/admin/notes': { POST: postNote },
  '/api/admin/notes/delete': { POST: deleteNote },
  '/api/admin/users/sessions': { POST: closeSessions },
  '/api/admin/users/reset-week': { POST: resetWeek },
  '/api/admin/users/avatar': { POST: removeAvatar },
  '/api/admin/users/view': { GET: viewAsPlayer },
  '/api/admin/users/push': { POST: pushUser },
  '/api/admin/events': { GET: getEvents, POST: postEvent },
  '/api/admin/events/delete': { POST: deleteEvent },
  '/api/admin/tests': { GET: getTests, POST: postTest },
  '/api/admin/tests/end': { POST: endTest },
  '/api/admin/team': { GET: getTeam, POST: postTeam },
  '/api/admin/automations': { GET: getAutomations, POST: postAutomation },
  '/api/admin/calendar': { GET: getCalendar },
  '/api/admin/economy/flow': { GET: getCoinFlow },
  '/api/admin/segments': { GET: getSegments, POST: postSegment },
  // The notice the admins put on top of the app, for everyone.
  // Apps from before /api/notices.
  '/api/announcement': { GET: async () => json(legacyAnnouncement()) },
  '/api/notices': { GET: getNotices },
  '/api/notices/seen': { POST: postNoticeSeen },
  '/api/devices': { POST: postDevice },
  '/api/polls': { GET: getPolls },
  '/api/polls/vote': { POST: postVote },
  '/api/reports': { POST: postReport },
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

  // Maintenance (lib/settings.ts): only the admins get past this. The panel checks for itself.
  if (maintenance() && !OPEN_IN_MAINTENANCE.has(path) && !path.startsWith('/api/admin/') && !(await signedInAdmin(request))) {
    throw new HttpError(503, 'La app está en mantenimiento')
  }

  const methods = routes[path]
  if (!methods) throw new HttpError(404, 'No existe')
  const fn = methods[request.method]
  if (!fn) throw new HttpError(405, 'Método no permitido')
  // A week that ended while the server was off closes before anyone's balance resets.
  if (closePastWeeks()) notifyAll()
  // And a day of the daily deck: its winners get their coins.
  if (closePastDays()) notifyAll()
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
