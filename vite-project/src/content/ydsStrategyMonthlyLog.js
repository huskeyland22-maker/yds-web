/**
 * YDS 3.0 Strategy monthly investment completion log.
 * Separate from Recommend Ledger / Track Record / Crash Reserve / portfolio cash.
 * Plans are not stored — only user-declared monthly completions.
 */

import {
  INVESTMENT_HOME_SETTINGS_KEY,
  loadInvestmentHomeSettings,
  normalizeInvestmentHomeSettings,
  saveInvestmentHomeSettings,
} from "./ydsInvestmentHomeStorage.js"
import {
  STRATEGY_RESERVE_BASE_TOTAL_KRW,
  sanitizeStrategyKrw,
  sanitizeStrategyMultiplier,
  sanitizeStrategyStage,
} from "./ydsStrategyReserveEngine.js"

export const STRATEGY_MONTHLY_LOG_KEY = "yds-strategy-monthly-log-v1"
export const STRATEGY_MONTHLY_LOG_VERSION = 1

/** @typedef {'completed' | 'cancelled'} StrategyMonthlyStatus */

/**
 * @typedef {{
 *   monthKey: string
 *   status: StrategyMonthlyStatus
 *   completedAt: string
 *   stage: number | null
 *   multiplier: number
 *   baseTotal: number
 *   targetTotal: number
 *   targetExtra: number
 *   actualExtra: number
 *   actualTotal: number
 *   reserveBefore: number
 *   reserveAfter: number
 *   cancelledAt?: string
 * }} StrategyMonthlyEntry
 *
 * @typedef {{
 *   version: number
 *   entries: StrategyMonthlyEntry[]
 * }} StrategyMonthlyLog
 *
 * @typedef {{ ok: true; entry: StrategyMonthlyEntry; strategyReserve: number; log: StrategyMonthlyLog }
 *   | { ok: false; error: string }} StrategyMonthlyResult
 */

const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/

/**
 * @param {unknown} value
 * @returns {string | null}
 */
export function sanitizeMonthKey(value) {
  const raw = String(value ?? "").trim()
  return MONTH_KEY_RE.test(raw) ? raw : null
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function sanitizeCompletedAt(value) {
  const raw = String(value ?? "").trim()
  return raw || new Date().toISOString()
}

/**
 * Non-negative integer KRW. Invalid → null (reject), unlike sanitizeStrategyKrw → 0.
 * @param {unknown} value
 * @returns {number | null}
 */
function parseNonNegativeKrw(value) {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n)
}

/**
 * @returns {StrategyMonthlyLog}
 */
export function createEmptyStrategyMonthlyLog() {
  return { version: STRATEGY_MONTHLY_LOG_VERSION, entries: [] }
}

/**
 * @param {unknown} raw
 * @returns {StrategyMonthlyEntry | null}
 */
function normalizeEntry(raw) {
  if (!raw || typeof raw !== "object") return null
  const row = /** @type {Record<string, unknown>} */ (raw)
  const monthKey = sanitizeMonthKey(row.monthKey)
  if (!monthKey) return null

  const statusRaw = String(row.status ?? "completed").trim()
  const status = statusRaw === "cancelled" ? "cancelled" : "completed"

  const baseTotal =
    parseNonNegativeKrw(row.baseTotal) ?? STRATEGY_RESERVE_BASE_TOTAL_KRW
  const targetTotal = parseNonNegativeKrw(row.targetTotal)
  const targetExtra = parseNonNegativeKrw(row.targetExtra)
  const actualExtra = parseNonNegativeKrw(row.actualExtra)
  const reserveBefore = parseNonNegativeKrw(row.reserveBefore)
  const reserveAfter = parseNonNegativeKrw(row.reserveAfter)
  if (
    targetTotal == null ||
    targetExtra == null ||
    actualExtra == null ||
    reserveBefore == null ||
    reserveAfter == null
  ) {
    return null
  }

  const stage = sanitizeStrategyStage(row.stage)
  const multiplier =
    row.multiplier != null && row.multiplier !== ""
      ? sanitizeStrategyMultiplier(row.multiplier)
      : 1

  /** @type {StrategyMonthlyEntry} */
  const entry = {
    monthKey,
    status,
    completedAt: sanitizeCompletedAt(row.completedAt),
    stage,
    multiplier,
    baseTotal,
    targetTotal,
    targetExtra,
    actualExtra,
    actualTotal: baseTotal + actualExtra,
    reserveBefore,
    reserveAfter,
  }
  if (status === "cancelled") {
    entry.cancelledAt = sanitizeCompletedAt(row.cancelledAt ?? row.completedAt)
  }
  return entry
}

/**
 * Keep at most one `completed` entry per monthKey (first wins). Invalid rows dropped.
 * @param {unknown} raw
 * @returns {StrategyMonthlyLog}
 */
export function normalizeStrategyMonthlyLog(raw) {
  const empty = createEmptyStrategyMonthlyLog()
  if (!raw || typeof raw !== "object") return empty
  const row = /** @type {Record<string, unknown>} */ (raw)
  const version = Number(row.version)
  if (Number.isFinite(version) && version !== STRATEGY_MONTHLY_LOG_VERSION) {
    // Unknown future/past version: still try to salvage entries if array present.
  }
  if (!Array.isArray(row.entries)) return empty

  /** @type {StrategyMonthlyEntry[]} */
  const out = []
  const completedMonths = new Set()
  for (const item of row.entries) {
    const entry = normalizeEntry(item)
    if (!entry) continue
    if (entry.status === "completed") {
      if (completedMonths.has(entry.monthKey)) continue
      completedMonths.add(entry.monthKey)
    }
    out.push(entry)
  }
  return { version: STRATEGY_MONTHLY_LOG_VERSION, entries: out }
}

/** @returns {StrategyMonthlyLog} */
export function loadStrategyMonthlyLog() {
  try {
    const raw = localStorage.getItem(STRATEGY_MONTHLY_LOG_KEY)
    if (!raw) return createEmptyStrategyMonthlyLog()
    return normalizeStrategyMonthlyLog(JSON.parse(raw))
  } catch {
    return createEmptyStrategyMonthlyLog()
  }
}

/**
 * Persist log. Always re-normalizes (dedupes completed monthKeys).
 * @param {unknown} log
 * @returns {StrategyMonthlyLog}
 */
export function saveStrategyMonthlyLog(log) {
  const normalized = normalizeStrategyMonthlyLog(log)
  try {
    localStorage.setItem(STRATEGY_MONTHLY_LOG_KEY, JSON.stringify(normalized))
  } catch {
    /* ignore quota / private mode */
  }
  return normalized
}

/**
 * Active (completed) entry for a month, or null.
 * @param {string} monthKey
 * @param {StrategyMonthlyLog} [log]
 * @returns {StrategyMonthlyEntry | null}
 */
export function getStrategyMonthlyEntry(monthKey, log = loadStrategyMonthlyLog()) {
  const key = sanitizeMonthKey(monthKey)
  if (!key) return null
  return log.entries.find((e) => e.monthKey === key && e.status === "completed") ?? null
}

/**
 * @param {{ includeCancelled?: boolean }} [opts]
 * @param {StrategyMonthlyLog} [log]
 * @returns {StrategyMonthlyEntry[]}
 */
export function listStrategyMonthlyEntries(opts = {}, log = loadStrategyMonthlyLog()) {
  const includeCancelled = Boolean(opts.includeCancelled)
  return log.entries.filter((e) => includeCancelled || e.status === "completed")
}

/** @returns {number} */
function readStrategyReserveAmount() {
  return loadInvestmentHomeSettings().strategyReserve.currentAmount
}

/** @param {number} amount */
function writeStrategyReserveAmount(amount) {
  const settings = loadInvestmentHomeSettings()
  const next = normalizeInvestmentHomeSettings({
    ...settings,
    strategyReserve: { currentAmount: sanitizeStrategyKrw(amount) },
  })
  saveInvestmentHomeSettings(next)
  return next.strategyReserve.currentAmount
}

/**
 * Complete monthly investment (user-declared). Updates Strategy Reserve SSOT.
 *
 * @param {{
 *   monthKey: unknown
 *   completedAt?: unknown
 *   stage?: unknown
 *   multiplier?: unknown
 *   baseTotal?: unknown
 *   targetTotal?: unknown
 *   targetExtra?: unknown
 *   actualExtra?: unknown
 *   actualTotal?: unknown
 *   reserveBefore?: unknown
 *   reserveAfter?: unknown
 * }} input
 * @returns {StrategyMonthlyResult}
 */
export function completeStrategyMonthlyInvestment(input = {}) {
  const monthKey = sanitizeMonthKey(input.monthKey)
  if (!monthKey) {
    return { ok: false, error: "invalid_month_key" }
  }

  const log = loadStrategyMonthlyLog()
  if (getStrategyMonthlyEntry(monthKey, log)) {
    return { ok: false, error: "already_completed" }
  }

  const reserveBefore = readStrategyReserveAmount()
  const baseTotal =
    parseNonNegativeKrw(input.baseTotal) ?? STRATEGY_RESERVE_BASE_TOTAL_KRW
  const targetTotal = parseNonNegativeKrw(input.targetTotal)
  const targetExtra = parseNonNegativeKrw(input.targetExtra)
  const actualExtraRaw = parseNonNegativeKrw(input.actualExtra)

  if (targetTotal == null || targetExtra == null || actualExtraRaw == null) {
    return { ok: false, error: "invalid_amounts" }
  }

  if (actualExtraRaw > targetExtra) {
    return { ok: false, error: "actual_extra_exceeds_target" }
  }
  if (actualExtraRaw > reserveBefore) {
    return { ok: false, error: "actual_extra_exceeds_reserve" }
  }

  const actualExtra = actualExtraRaw
  const actualTotal = baseTotal + actualExtra
  const reserveAfter = reserveBefore - actualExtra

  const stage = sanitizeStrategyStage(input.stage)
  const multiplier =
    input.multiplier != null && input.multiplier !== ""
      ? sanitizeStrategyMultiplier(input.multiplier)
      : 1

  /** @type {StrategyMonthlyEntry} */
  const entry = {
    monthKey,
    status: "completed",
    completedAt: sanitizeCompletedAt(input.completedAt),
    stage,
    multiplier,
    baseTotal,
    targetTotal,
    targetExtra,
    actualExtra,
    actualTotal,
    reserveBefore,
    reserveAfter,
  }

  const nextLog = saveStrategyMonthlyLog({
    version: STRATEGY_MONTHLY_LOG_VERSION,
    entries: [...log.entries, entry],
  })
  const strategyReserve = writeStrategyReserveAmount(reserveAfter)

  return {
    ok: true,
    entry: getStrategyMonthlyEntry(monthKey, nextLog) ?? entry,
    strategyReserve,
    log: nextLog,
  }
}

/**
 * Update actualExtra and/or completedAt for a completed month.
 * Reverses prior Reserve effect, then applies new actualExtra.
 *
 * @param {unknown} monthKeyRaw
 * @param {{ actualExtra?: unknown; completedAt?: unknown }} patch
 * @returns {StrategyMonthlyResult}
 */
export function updateStrategyMonthlyInvestment(monthKeyRaw, patch = {}) {
  const monthKey = sanitizeMonthKey(monthKeyRaw)
  if (!monthKey) {
    return { ok: false, error: "invalid_month_key" }
  }

  const log = loadStrategyMonthlyLog()
  const existing = getStrategyMonthlyEntry(monthKey, log)
  if (!existing) {
    return { ok: false, error: "not_found" }
  }

  const currentReserve = readStrategyReserveAmount()
  const restoredReserve = currentReserve + existing.actualExtra

  const nextExtra =
    patch.actualExtra === undefined
      ? existing.actualExtra
      : parseNonNegativeKrw(patch.actualExtra)

  if (nextExtra == null) {
    return { ok: false, error: "invalid_amounts" }
  }
  if (nextExtra > existing.targetExtra) {
    return { ok: false, error: "actual_extra_exceeds_target" }
  }
  if (nextExtra > restoredReserve) {
    return { ok: false, error: "actual_extra_exceeds_reserve" }
  }

  const reserveBefore = existing.reserveBefore
  const reserveAfter = reserveBefore - nextExtra
  const strategyReserve = writeStrategyReserveAmount(restoredReserve - nextExtra)

  /** @type {StrategyMonthlyEntry} */
  const updated = {
    ...existing,
    status: "completed",
    actualExtra: nextExtra,
    actualTotal: existing.baseTotal + nextExtra,
    reserveAfter,
    completedAt:
      patch.completedAt !== undefined
        ? sanitizeCompletedAt(patch.completedAt)
        : existing.completedAt,
  }

  const entries = log.entries.map((e) =>
    e.monthKey === monthKey && e.status === "completed" ? updated : e,
  )
  const nextLog = saveStrategyMonthlyLog({ version: STRATEGY_MONTHLY_LOG_VERSION, entries })

  return {
    ok: true,
    entry: updated,
    strategyReserve,
    log: nextLog,
  }
}

/**
 * Soft-cancel a completed month and restore Strategy Reserve by actualExtra.
 * Keeps the cancelled entry for history; same monthKey can be completed again.
 *
 * @param {unknown} monthKeyRaw
 * @returns {StrategyMonthlyResult}
 */
export function cancelStrategyMonthlyInvestment(monthKeyRaw) {
  const monthKey = sanitizeMonthKey(monthKeyRaw)
  if (!monthKey) {
    return { ok: false, error: "invalid_month_key" }
  }

  const log = loadStrategyMonthlyLog()
  const existing = getStrategyMonthlyEntry(monthKey, log)
  if (!existing) {
    return { ok: false, error: "not_found" }
  }

  const strategyReserve = writeStrategyReserveAmount(
    readStrategyReserveAmount() + existing.actualExtra,
  )

  /** @type {StrategyMonthlyEntry} */
  const cancelled = {
    ...existing,
    status: "cancelled",
    cancelledAt: new Date().toISOString(),
  }

  const entries = log.entries.map((e) =>
    e.monthKey === monthKey && e.status === "completed" ? cancelled : e,
  )
  const nextLog = saveStrategyMonthlyLog({ version: STRATEGY_MONTHLY_LOG_VERSION, entries })

  return {
    ok: true,
    entry: cancelled,
    strategyReserve,
    log: nextLog,
  }
}

/** Exported for tests — settings key used as Strategy Reserve SSOT companion. */
export { INVESTMENT_HOME_SETTINGS_KEY }
