import { requireUser } from '../lib/auth.js'
import { db } from '../lib/db.js'
import { HttpError, json } from '../lib/http.js'
import { claimPay, leagueClock, rollover, selectLeague } from '../lib/league.js'

// GET /api/league: the player's balance, the pay waiting to be claimed and when the week closes.
export async function getLeague(request: Request): Promise<Response> {
  const user = await requireUser(request)
  const clock = leagueClock()
  return json(
    db().transaction((tx) => {
      rollover(tx, user.id, clock)
      return selectLeague(tx, user.id, clock)
    }),
  )
}

// POST /api/league/pay: claims every unclaimed day of pay this week.
export async function postPay(request: Request): Promise<Response> {
  const user = await requireUser(request)
  const clock = leagueClock()
  const state = db().transaction((tx) => {
    rollover(tx, user.id, clock)
    return claimPay(tx, user.id, clock) ? selectLeague(tx, user.id, clock) : null
  })
  if (!state) throw new HttpError(409, 'Ya has cobrado la paga de hoy')
  return json(state)
}
