/**
 * US equity session helpers for Panic Index freshness (manual core metrics).
 * Time zone: America/New_York (DST-aware via Intl).
 *
 * Full-day closures: curated list aligned with vite-project
 * `ydsRecommendMarketDate.js` (2025–2027). Not a live exchange feed.
 * Early-close days are NOT modeled — regular 16:00 ET close is assumed.
 */

export const US_EQUITY_TZ = "America/New_York"

/** Regular cash session (ET). */
export const US_REGULAR_OPEN = Object.freeze({ hour: 9, minute: 30 })
export const US_REGULAR_CLOSE = Object.freeze({ hour: 16, minute: 0 })

/**
 * Manual-entry grace after regular close.
 * Reuses the existing API wall-clock intent (PANIC_STALE_AFTER_MS default = 6h)
 * but anchors it to session close instead of raw updatedAt age.
 */
export const PANIC_MANUAL_ENTRY_GRACE_MS =
  Number(process.env.PANIC_STALE_AFTER_MS) || 6 * 60 * 60 * 1000

/**
 * NYSE/Nasdaq full-day closures (2025–2027).
 * Keep in sync with vite-project/src/content/ydsRecommendMarketDate.js.
 * Incomplete outside this window — callers must not claim live exchange accuracy.
 */
export const US_EQUITY_FULL_CLOSURES = new Set([
  "2025-01-01",
  "2025-01-20",
  "2025-02-17",
  "2025-04-18",
  "2025-05-26",
  "2025-06-19",
  "2025-07-04",
  "2025-09-01",
  "2025-11-27",
  "2025-12-25",
  "2026-01-01",
  "2026-01-19",
  "2026-02-16",
  "2026-04-03",
  "2026-05-25",
  "2026-06-19",
  "2026-07-03",
  "2026-09-07",
  "2026-11-26",
  "2026-12-25",
  "2027-01-01",
  "2027-01-18",
  "2027-02-15",
  "2027-03-26",
  "2027-05-31",
  "2027-06-18",
  "2027-07-05",
  "2027-09-06",
  "2027-11-25",
  "2027-12-24",
])

/** @param {string | null | undefined} raw */
export function normalizeDateKey(raw) {
  if (!raw) return null
  const s = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null
}

/** @param {string} dateKey */
function isWeekendUtcNoon(dateKey) {
  const d = new Date(`${dateKey}T12:00:00Z`)
  const day = d.getUTCDay()
  return day === 0 || day === 6
}

/**
 * @param {string | null | undefined} dateKey
 * @returns {boolean}
 */
export function isUsEquityClosedDay(dateKey) {
  const key = normalizeDateKey(dateKey)
  if (!key) return false
  if (isWeekendUtcNoon(key)) return true
  return US_EQUITY_FULL_CLOSURES.has(key)
}

/**
 * @param {string | null | undefined} dateKey
 * @returns {string | null}
 */
export function rollBackToUsTradingDay(dateKey) {
  let key = normalizeDateKey(dateKey)
  if (!key) return null
  for (let guard = 0; guard < 14; guard += 1) {
    if (!isUsEquityClosedDay(key)) return key
    const d = new Date(`${key}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 1)
    key = d.toISOString().slice(0, 10)
  }
  return key
}

/**
 * @param {string} dateKey
 * @returns {string | null}
 */
export function previousUsTradingDay(dateKey) {
  const key = normalizeDateKey(dateKey)
  if (!key) return null
  const d = new Date(`${key}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return rollBackToUsTradingDay(d.toISOString().slice(0, 10))
}

/**
 * @param {Date | number | string} [now]
 * @returns {{
 *   year: number
 *   month: number
 *   day: number
 *   hour: number
 *   minute: number
 *   second: number
 *   weekday: string
 *   dateKey: string
 * }}
 */
export function getAmericaNyParts(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now)
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: US_EQUITY_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  })
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]))
  const year = Number(parts.year)
  const month = Number(parts.month)
  const day = Number(parts.day)
  const hour = Number(parts.hour)
  const minute = Number(parts.minute)
  const second = Number(parts.second)
  const dateKey = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekday: String(parts.weekday || ""),
    dateKey,
  }
}

/**
 * Instant for NY local wall time on a calendar dateKey (handles DST via iterative offset).
 * @param {string} dateKey
 * @param {number} hour
 * @param {number} minute
 * @param {number} [second]
 * @returns {number} epoch ms
 */
export function americaNyWallTimeToUtcMs(dateKey, hour, minute, second = 0) {
  const key = normalizeDateKey(dateKey)
  if (!key) return NaN
  const [y, m, d] = key.split("-").map(Number)
  let guess = Date.UTC(y, m - 1, d, hour, minute, second)
  for (let i = 0; i < 3; i += 1) {
    const parts = getAmericaNyParts(new Date(guess))
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
    const target = Date.UTC(y, m - 1, d, hour, minute, second)
    guess += target - asUtc
  }
  return guess
}

/**
 * @typedef {'calendar_closed' | 'pre_open' | 'open' | 'grace' | 'after_grace'} UsEquitySessionPhase
 */

/**
 * @param {Date | number | string} [now]
 * @param {{ graceMs?: number }} [opts]
 */
export function resolveUsEquitySession(now = new Date(), opts = {}) {
  const graceMs =
    Number.isFinite(Number(opts.graceMs)) && Number(opts.graceMs) >= 0
      ? Number(opts.graceMs)
      : PANIC_MANUAL_ENTRY_GRACE_MS
  const instant = now instanceof Date ? now : new Date(now)
  const parts = getAmericaNyParts(instant)
  const nyDate = parts.dateKey
  const closed = isUsEquityClosedDay(nyDate)
  const previousTradingDay = closed
    ? rollBackToUsTradingDay(nyDate)
    : previousUsTradingDay(nyDate)
  const minutes = parts.hour * 60 + parts.minute

  if (closed) {
    return {
      timeZone: US_EQUITY_TZ,
      nyDate,
      isTradingDay: false,
      phase: /** @type {UsEquitySessionPhase} */ ("calendar_closed"),
      previousTradingDay,
      lastCompletedTradingDay: previousTradingDay,
      graceMs,
      earlyCloseModeled: false,
      holidayListBounded: true,
    }
  }

  const openMinutes = US_REGULAR_OPEN.hour * 60 + US_REGULAR_OPEN.minute
  const closeMinutes = US_REGULAR_CLOSE.hour * 60 + US_REGULAR_CLOSE.minute
  const closeMs = americaNyWallTimeToUtcMs(nyDate, US_REGULAR_CLOSE.hour, US_REGULAR_CLOSE.minute, 0)
  const graceEndMs = closeMs + graceMs
  const nowMs = instant.getTime()

  /** @type {UsEquitySessionPhase} */
  let phase = "pre_open"
  if (minutes < openMinutes) phase = "pre_open"
  else if (minutes < closeMinutes) phase = "open"
  else if (nowMs < graceEndMs) phase = "grace"
  else phase = "after_grace"

  const lastCompletedTradingDay =
    phase === "after_grace" ? nyDate : previousTradingDay

  return {
    timeZone: US_EQUITY_TZ,
    nyDate,
    isTradingDay: true,
    phase,
    previousTradingDay,
    lastCompletedTradingDay,
    graceMs,
    graceEndsAt: Number.isFinite(graceEndMs) ? new Date(graceEndMs).toISOString() : null,
    earlyCloseModeled: false,
    holidayListBounded: true,
  }
}

/**
 * Panic core (VIX · CNN · Put/Call) observation freshness vs US session.
 * Does not rewrite updatedAt. Does not auto-collect metrics.
 *
 * @param {{
 *   asOfDate?: string | null
 *   coreComplete?: boolean
 *   now?: Date | number | string
 *   graceMs?: number
 * }} input
 * @returns {{
 *   status: 'live' | 'waiting' | 'delayed' | 'error'
 *   asOfDate: string | null
 *   expectedObservationDay: string | null
 *   session: ReturnType<typeof resolveUsEquitySession>
 *   isStaleCompatible: boolean
 * }}
 */
export function classifyPanicCoreFreshness(input = {}) {
  const now = input.now ?? new Date()
  const session = resolveUsEquitySession(now, { graceMs: input.graceMs })
  const asOfDate = normalizeDateKey(input.asOfDate)
  const coreComplete = input.coreComplete !== false

  if (!coreComplete || !asOfDate) {
    return {
      status: "error",
      asOfDate,
      expectedObservationDay: session.lastCompletedTradingDay,
      session,
      isStaleCompatible: true,
    }
  }

  const { phase, nyDate, previousTradingDay, lastCompletedTradingDay, isTradingDay } = session

  if (phase === "calendar_closed") {
    const expected = lastCompletedTradingDay
    if (asOfDate >= expected) {
      return {
        status: "live",
        asOfDate,
        expectedObservationDay: expected,
        session,
        isStaleCompatible: false,
      }
    }
    return {
      status: "delayed",
      asOfDate,
      expectedObservationDay: expected,
      session,
      isStaleCompatible: true,
    }
  }

  if (phase === "pre_open") {
    const expected = previousTradingDay
    if (asOfDate >= expected) {
      return {
        status: "live",
        asOfDate,
        expectedObservationDay: expected,
        session,
        isStaleCompatible: false,
      }
    }
    return {
      status: "delayed",
      asOfDate,
      expectedObservationDay: expected,
      session,
      isStaleCompatible: true,
    }
  }

  if (phase === "open") {
    const expected = previousTradingDay
    if (asOfDate >= nyDate) {
      return {
        status: "live",
        asOfDate,
        expectedObservationDay: expected,
        session,
        isStaleCompatible: false,
      }
    }
    if (asOfDate >= expected) {
      return {
        status: "waiting",
        asOfDate,
        expectedObservationDay: expected,
        session,
        isStaleCompatible: false,
      }
    }
    return {
      status: "delayed",
      asOfDate,
      expectedObservationDay: expected,
      session,
      isStaleCompatible: true,
    }
  }

  if (phase === "grace") {
    const expected = previousTradingDay
    if (asOfDate >= nyDate) {
      return {
        status: "live",
        asOfDate,
        expectedObservationDay: nyDate,
        session,
        isStaleCompatible: false,
      }
    }
    if (asOfDate >= expected) {
      return {
        status: "waiting",
        asOfDate,
        expectedObservationDay: nyDate,
        session,
        isStaleCompatible: false,
      }
    }
    return {
      status: "delayed",
      asOfDate,
      expectedObservationDay: nyDate,
      session,
      isStaleCompatible: true,
    }
  }

  // after_grace on a trading day — today's observation is required
  if (isTradingDay && phase === "after_grace") {
    if (asOfDate >= nyDate) {
      return {
        status: "live",
        asOfDate,
        expectedObservationDay: nyDate,
        session,
        isStaleCompatible: false,
      }
    }
    return {
      status: "delayed",
      asOfDate,
      expectedObservationDay: nyDate,
      session,
      isStaleCompatible: true,
    }
  }

  return {
    status: "error",
    asOfDate,
    expectedObservationDay: lastCompletedTradingDay,
    session,
    isStaleCompatible: true,
  }
}

/**
 * @param {Record<string, unknown> | null | undefined} data
 */
export function panicCoreMetricsComplete(data) {
  if (!data || typeof data !== "object") return false
  const vix = Number(data.vix)
  const fg = Number(data.fearGreed ?? data.fear_greed)
  const pc = Number(data.putCall ?? data.put_call)
  return Number.isFinite(vix) && Number.isFinite(fg) && Number.isFinite(pc)
}

/**
 * Observation date for freshness: prefer business date, not save clock.
 * @param {Record<string, unknown> | null | undefined} data
 */
export function panicObservationDateKey(data) {
  if (!data || typeof data !== "object") return null
  return (
    normalizeDateKey(data.date) ??
    normalizeDateKey(data.asOfDate) ??
    normalizeDateKey(data.tradeDate) ??
    normalizeDateKey(data.updatedAt) ??
    normalizeDateKey(data.updated_at)
  )
}
