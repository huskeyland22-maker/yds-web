/**
 * YDS 3.0 투자전략 — S&P500(SPY 대용) 완료 주봉 + MA40 기반 투자 단계
 * Panic Index / Crash Reserve 와 독립. Reserve·ETF 배분·주문 미포함.
 */

export const STRATEGY_BASE_MONTHLY_KRW = 300_000
export const STRATEGY_MA_WEEKS = 40
/** 최근 완료 주봉이 asOf 기준 이보다 오래되면 신뢰 불가 */
export const STRATEGY_WEEK_STALE_MAX_DAYS = 14

export const STRATEGY_STAGE_TABLE = [
  { stage: 1, multiplier: 1.0, rule: "MA40 대비 -5% 미만", maxDeviationExclusive: -0.05 },
  { stage: 2, multiplier: 1.25, rule: "MA40 대비 -5% 이하", maxDeviationInclusive: -0.05 },
  { stage: 3, multiplier: 1.5, rule: "MA40 대비 -10% 이하", maxDeviationInclusive: -0.1 },
  { stage: 4, multiplier: 2.0, rule: "MA40 대비 -20% 이하", maxDeviationInclusive: -0.2 },
]

/** @param {string | Date | null | undefined} value */
export function toIsoDateOnly(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  const s = String(value || "").slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

/** @param {string} iso YYYY-MM-DD */
function parseUtcDate(iso) {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}

/** @param {Date} dt */
function formatUtcDate(dt) {
  return dt.toISOString().slice(0, 10)
}

/**
 * Calendar week Friday (UTC) for a trading date.
 * @param {string} iso
 */
export function fridayOfWeek(iso) {
  const dt = parseUtcDate(iso)
  const day = dt.getUTCDay() // 0 Sun .. 5 Fri
  const delta = (5 - day + 7) % 7
  dt.setUTCDate(dt.getUTCDate() + delta)
  return formatUtcDate(dt)
}

/**
 * @param {string} fromIso
 * @param {string} toIso
 */
export function calendarDaysBetween(fromIso, toIso) {
  const a = parseUtcDate(fromIso).getTime()
  const b = parseUtcDate(toIso).getTime()
  return Math.floor((b - a) / 86_400_000)
}

/**
 * Daily closes → completed weekly bars only (Friday label ≤ asOf).
 * Incomplete / future-Friday weeks are excluded.
 *
 * @param {Record<string, number> | null | undefined} dailyPrices
 * @param {string | Date | null | undefined} [asOf]
 * @returns {Array<{ weekEnd: string; close: number; lastTradeDate: string }>}
 */
export function buildCompletedWeeklyBars(dailyPrices, asOf = new Date()) {
  const asOfIso = toIsoDateOnly(asOf)
  if (!asOfIso || !dailyPrices || typeof dailyPrices !== "object") return []

  /** @type {Map<string, { close: number; lastTradeDate: string }>} */
  const byFriday = new Map()
  const dates = Object.keys(dailyPrices)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Number(dailyPrices[d])))
    .filter((d) => d <= asOfIso)
    .sort()

  for (const date of dates) {
    const friday = fridayOfWeek(date)
    // Future-labeled week (e.g. Mon–Thu of current week → upcoming Friday): skip.
    if (friday > asOfIso) continue
    const close = Number(dailyPrices[date])
    const prev = byFriday.get(friday)
    if (!prev || date >= prev.lastTradeDate) {
      byFriday.set(friday, { close, lastTradeDate: date })
    }
  }

  return [...byFriday.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .filter(([friday, row]) => isCompletedWeekSnapshot(friday, row.lastTradeDate))
    .map(([weekEnd, row]) => ({
      weekEnd,
      close: row.close,
      lastTradeDate: row.lastTradeDate,
    }))
}

/**
 * Reject weeks that only have early-week prints (e.g. Mon–Wed) when Friday label is used.
 * Accept Thu/Fri closes for that week.
 * @param {string} friday
 * @param {string} lastTradeDate
 */
export function isCompletedWeekSnapshot(friday, lastTradeDate) {
  if (!friday || !lastTradeDate) return false
  if (lastTradeDate > friday) return false
  if (fridayOfWeek(lastTradeDate) !== friday) return false
  const dow = parseUtcDate(lastTradeDate).getUTCDay()
  return dow === 4 || dow === 5
}

/**
 * @param {Array<{ close: number }>} weeklyBars ascending
 * @param {number} [weeks]
 */
export function computeMa40(weeklyBars, weeks = STRATEGY_MA_WEEKS) {
  if (!Array.isArray(weeklyBars) || weeklyBars.length < weeks) return null
  const slice = weeklyBars.slice(-weeks)
  const sum = slice.reduce((acc, bar) => acc + Number(bar.close), 0)
  const ma = sum / weeks
  return Number.isFinite(ma) ? ma : null
}

/**
 * deviation = (close - ma40) / ma40  (e.g. -0.05 = -5%)
 * @param {number} close
 * @param {number} ma40
 */
export function computeMa40Deviation(close, ma40) {
  if (!Number.isFinite(close) || !Number.isFinite(ma40) || ma40 === 0) return null
  return (close - ma40) / ma40
}

/**
 * Boundaries inclusive → stronger stage.
 * @param {number} deviation
 * @returns {{ stage: number; multiplier: number; label: string } | null}
 */
export function resolveStrategyStage(deviation) {
  if (!Number.isFinite(deviation)) return null
  if (deviation <= -0.2) {
    return { stage: 4, multiplier: 2.0, label: "4단계" }
  }
  if (deviation <= -0.1) {
    return { stage: 3, multiplier: 1.5, label: "3단계" }
  }
  if (deviation <= -0.05) {
    return { stage: 2, multiplier: 1.25, label: "2단계" }
  }
  return { stage: 1, multiplier: 1.0, label: "1단계" }
}

/**
 * @param {number} multiplier
 * @param {number} [baseMonthly]
 */
export function computeTargetMonthlyKrw(multiplier, baseMonthly = STRATEGY_BASE_MONTHLY_KRW) {
  if (!Number.isFinite(multiplier) || !Number.isFinite(baseMonthly)) return null
  return Math.round(baseMonthly * multiplier)
}

/**
 * @param {number} deviation
 */
export function formatDeviationPct(deviation) {
  if (!Number.isFinite(deviation)) return null
  const pct = deviation * 100
  const rounded = Math.round(pct * 100) / 100
  const sign = rounded > 0 ? "+" : ""
  return `${sign}${rounded.toFixed(2)}%`
}

/**
 * Full market judgment for YDS 3.0 (display-only).
 * Does not invent 1.0x when data is bad.
 *
 * @param {Record<string, number> | null | undefined} dailyPrices SPY daily closes
 * @param {{ asOf?: string | Date | null }} [opts]
 */
export function buildStrategyMa40Judgment(dailyPrices, opts = {}) {
  const asOf = toIsoDateOnly(opts.asOf ?? new Date())
  const base = {
    ok: false,
    reason: null,
    asOf,
    indexLabel: "S&P500",
    dataProxy: "SPY",
    barBasis: "최근 완료 주봉",
    weekEnd: null,
    lastTradeDate: null,
    close: null,
    ma40: null,
    deviation: null,
    deviationLabel: null,
    stage: null,
    multiplier: null,
    stageLabel: null,
    baseMonthlyKrw: STRATEGY_BASE_MONTHLY_KRW,
    targetMonthlyKrw: null,
    weeklyBarCount: 0,
    ageDays: null,
    stale: false,
    stageTable: STRATEGY_STAGE_TABLE.map((row) => ({
      stage: row.stage,
      multiplier: row.multiplier,
      rule: row.rule,
    })),
  }

  if (!asOf) {
    return { ...base, reason: "기준일(asOf)을 확인할 수 없습니다." }
  }
  if (!dailyPrices || typeof dailyPrices !== "object") {
    return { ...base, reason: "S&P500(SPY) 일봉 데이터가 없습니다." }
  }

  const weekly = buildCompletedWeeklyBars(dailyPrices, asOf)
  base.weeklyBarCount = weekly.length
  if (weekly.length < STRATEGY_MA_WEEKS) {
    return {
      ...base,
      reason: `완료 주봉이 ${STRATEGY_MA_WEEKS}주 미만입니다. (현재 ${weekly.length}주)`,
    }
  }

  const latest = weekly[weekly.length - 1]
  const ageDays = calendarDaysBetween(latest.weekEnd, asOf)
  base.ageDays = ageDays
  if (ageDays > STRATEGY_WEEK_STALE_MAX_DAYS) {
    return {
      ...base,
      weekEnd: latest.weekEnd,
      lastTradeDate: latest.lastTradeDate,
      close: latest.close,
      stale: true,
      reason: `최근 완료 주봉이 ${ageDays}일 전입니다. 데이터를 확인할 때까지 투자단계를 계산하지 않습니다.`,
    }
  }

  const ma40 = computeMa40(weekly)
  if (ma40 == null) {
    return {
      ...base,
      weekEnd: latest.weekEnd,
      lastTradeDate: latest.lastTradeDate,
      close: latest.close,
      reason: "MA40을 계산할 수 없습니다.",
    }
  }

  const deviation = computeMa40Deviation(latest.close, ma40)
  if (deviation == null) {
    return {
      ...base,
      weekEnd: latest.weekEnd,
      lastTradeDate: latest.lastTradeDate,
      close: latest.close,
      ma40,
      reason: "MA40 대비 괴리율을 계산할 수 없습니다.",
    }
  }

  const stageInfo = resolveStrategyStage(deviation)
  if (!stageInfo) {
    return {
      ...base,
      weekEnd: latest.weekEnd,
      lastTradeDate: latest.lastTradeDate,
      close: latest.close,
      ma40,
      deviation,
      deviationLabel: formatDeviationPct(deviation),
      reason: "투자단계를 결정할 수 없습니다.",
    }
  }

  const targetMonthlyKrw = computeTargetMonthlyKrw(stageInfo.multiplier)

  return {
    ...base,
    ok: true,
    reason: null,
    weekEnd: latest.weekEnd,
    lastTradeDate: latest.lastTradeDate,
    close: latest.close,
    ma40: Math.round(ma40 * 10000) / 10000,
    deviation,
    deviationLabel: formatDeviationPct(deviation),
    stage: stageInfo.stage,
    multiplier: stageInfo.multiplier,
    stageLabel: stageInfo.label,
    targetMonthlyKrw,
    stale: false,
  }
}
