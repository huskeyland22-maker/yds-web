/** SPY 52주(252 거래일) rolling high drawdown + Crash Reserve 단계 검토 */

export const SPY_ROLLING_WINDOW = 252

/** ageDays > 3 이면 SPY Drawdown stale (주말·휴장 1~3일 허용) */
export const SPY_STALE_MAX_AGE_DAYS = 3

/** @type {readonly number[]} */
export const CRASH_RESERVE_DRAWDOWN_THRESHOLDS = [-15, -17, -22, -28, -32]

/** 향후 AND 조건: stage index → 최소 Market Stress 점수 */
export const CRASH_RESERVE_MIN_STRESS_SCORE = [60, 75, 75, 90, 90]

/** @typedef {'WAITING' | 'REVIEW_AVAILABLE' | 'COMPLETED'} CrashReserveStageStatus */
/** @typedef {'FRESH' | 'STALE'} SpyDrawdownFreshness */

/**
 * @param {string | null | undefined} dateStr
 * @param {Date} [now]
 */
export function ageDaysFromDate(dateStr, now = new Date()) {
  if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
  const [year, month, day] = dateStr.split("-").map(Number)
  const dataUtc = Date.UTC(year, month - 1, day)
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.max(0, Math.round((todayUtc - dataUtc) / 86400000))
}

/**
 * @param {string | null | undefined} dataDate
 * @param {Date} [now]
 */
export function resolveSpyDrawdownDataQuality(dataDate, now = new Date()) {
  const ageDays = ageDaysFromDate(dataDate, now)
  if (ageDays == null) {
    return { ageDays: null, stale: true, freshness: null }
  }
  const stale = ageDays > SPY_STALE_MAX_AGE_DAYS
  return {
    ageDays,
    stale,
    freshness: stale ? "STALE" : "FRESH",
  }
}

/**
 * @param {number} targetAmount
 * @param {number[]} percentages — stageCount 길이
 * @returns {number[]}
 */
export function computeStageAmounts(targetAmount, percentages) {
  const target = Math.max(0, Math.round(Number(targetAmount) || 0))
  const pcts = (Array.isArray(percentages) ? percentages : []).map((value) => Math.max(0, Number(value) || 0))
  if (target <= 0 || pcts.length === 0) return []

  const totalPct = pcts.reduce((sum, value) => sum + value, 0) || 100
  const normalized = pcts.map((value) => value / totalPct)
  const amounts = []
  let allocated = 0

  for (let i = 0; i < normalized.length - 1; i += 1) {
    const amount = Math.round(target * normalized[i])
    amounts.push(amount)
    allocated += amount
  }
  amounts.push(target - allocated)
  return amounts
}

/**
 * @param {Record<string, number> | null | undefined} prices
 * @param {Date} [now]
 */
export function computeSpyDrawdownFromPrices(prices, now = new Date()) {
  const empty = {
    drawdownPct: null,
    rollingHigh52w: null,
    currentClose: null,
    dataDate: null,
    symbol: "SPY",
    ageDays: null,
    stale: true,
    freshness: null,
  }

  if (!prices || typeof prices !== "object") return empty

  const entries = Object.entries(prices)
    .filter(([date, value]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Number(value)) && Number(value) > 0)
    .sort(([a], [b]) => a.localeCompare(b))

  if (!entries.length) return empty

  const windowEntries = entries.slice(-SPY_ROLLING_WINDOW)
  const [dataDate, closeRaw] = entries[entries.length - 1]
  const currentClose = Number(closeRaw)
  const rollingHigh52w = Math.max(...windowEntries.map(([, value]) => Number(value)))
  const drawdownPct =
    rollingHigh52w > 0 ? ((currentClose - rollingHigh52w) / rollingHigh52w) * 100 : null
  const quality = resolveSpyDrawdownDataQuality(dataDate, now)

  return {
    drawdownPct: drawdownPct == null ? null : Math.round(drawdownPct * 100) / 100,
    rollingHigh52w,
    currentClose,
    dataDate,
    symbol: "SPY",
    ageDays: quality.ageDays,
    stale: quality.stale,
    freshness: quality.freshness,
  }
}

/** @param {number | null | undefined} drawdownPct */
export function resolveDrawdownLevel(drawdownPct) {
  if (!Number.isFinite(drawdownPct)) {
    return { id: "UNKNOWN", label: "데이터 확인 필요" }
  }
  const dd = Number(drawdownPct)
  if (dd > -5) return { id: "NORMAL", label: "정상 변동" }
  if (dd > -10) return { id: "PULLBACK", label: "단기 조정" }
  if (dd > -15) return { id: "CORRECTION", label: "일반 조정" }
  if (dd > -20) return { id: "BEAR_ENTRY", label: "약세장 진입" }
  if (dd > -30) return { id: "CRASH", label: "폭락장" }
  return { id: "SEVERE_CRASH", label: "역사적 급락" }
}

/**
 * @param {{
 *   drawdownPct?: number | null
 *   dataDate?: string | null
 *   stale?: boolean
 *   ageDays?: number | null
 * } | null | undefined} drawdown
 */
export function isSpyDrawdownAvailableForStages(drawdown) {
  if (!drawdown || drawdown.drawdownPct == null) return false
  if (typeof drawdown.dataDate !== "string" || !drawdown.dataDate) return false
  if (drawdown.stale === true) return false
  if (drawdown.ageDays != null && drawdown.ageDays > SPY_STALE_MAX_AGE_DAYS) return false
  return true
}

/**
 * @param {import("./ydsInvestmentStressResolver.js").resolveMarketStressReport extends (...args: any) => infer R ? R : never} stressReport
 */
export function isMarketStressAvailableForStages(stressReport) {
  if (!stressReport || stressReport.score == null) return false
  if (stressReport.level?.id === "UNKNOWN") return false
  if (stressReport.dataQuality?.stale === true) return false
  return true
}

/**
 * @param {{
 *   completed: boolean
 *   drawdownPct: number | null | undefined
 *   drawdownThreshold: number
 *   stressScore: number | null | undefined
 *   minStressScore: number
 *   spyAvailable: boolean
 *   stressAvailable: boolean
 * }}
 * @returns {{ status: CrashReserveStageStatus, statusLabel: string }}
 */
export function resolveCrashReserveStageState({
  completed,
  drawdownPct,
  drawdownThreshold,
  stressScore,
  minStressScore,
  spyAvailable,
  stressAvailable,
}) {
  if (completed) {
    return { status: "COMPLETED", statusLabel: "완료" }
  }

  if (!spyAvailable || !stressAvailable || drawdownPct == null || stressScore == null) {
    return { status: "WAITING", statusLabel: "시장 데이터 확인 필요" }
  }

  const ddMet = Number(drawdownPct) <= drawdownThreshold
  const stressMet = Number(stressScore) >= minStressScore

  if (ddMet && stressMet) {
    return { status: "REVIEW_AVAILABLE", statusLabel: "투입 검토 가능" }
  }

  return { status: "WAITING", statusLabel: "대기" }
}

/**
 * @param {{
 *   targetAmount?: number
 *   currentAmount?: number
 *   stageCount?: number
 *   stagePercentages?: number[]
 *   stageStatuses?: boolean[]
 * } | null | undefined} crashReserve
 * @param {{
 *   drawdown?: ReturnType<typeof computeSpyDrawdownFromPrices>
 *   stressReport?: ReturnType<typeof import("./ydsInvestmentStressResolver.js").resolveMarketStressReport>
 *   now?: Date
 * }} [context]
 */
export function buildCrashReservePlan(crashReserve, context = {}) {
  const now = context.now instanceof Date ? context.now : new Date()
  const targetAmount = Math.max(0, Math.round(Number(crashReserve?.targetAmount) || 0))
  const currentAmount = Math.max(0, Math.round(Number(crashReserve?.currentAmount) || 0))
  const stageCount = Math.max(3, Math.min(5, Math.round(Number(crashReserve?.stageCount) || 5)))
  const rawPercentages = Array.isArray(crashReserve?.stagePercentages)
    ? crashReserve.stagePercentages.slice(0, stageCount).map((value) => Math.max(0, Number(value) || 0))
    : []
  while (rawPercentages.length < stageCount) rawPercentages.push(20)

  const totalPct = rawPercentages.reduce((sum, value) => sum + value, 0)
  const stagePercentages =
    totalPct > 0
      ? rawPercentages.map((value) => Math.round((value / totalPct) * 1000) / 10)
      : Array(stageCount).fill(Math.round((100 / stageCount) * 10) / 10)

  const stageStatuses = Array.isArray(crashReserve?.stageStatuses)
    ? crashReserve.stageStatuses.slice(0, stageCount).map((value) => Boolean(value))
    : Array(stageCount).fill(false)

  const readyPctRaw = targetAmount > 0 ? (currentAmount / targetAmount) * 100 : null
  const readyPct =
    readyPctRaw == null ? null : Math.round(Math.min(100, Math.max(0, readyPctRaw)) * 10) / 10

  const rawDrawdown = context.drawdown ?? computeSpyDrawdownFromPrices(null, now)
  const drawdownQuality = resolveSpyDrawdownDataQuality(rawDrawdown.dataDate, now)
  const drawdown = {
    ...rawDrawdown,
    ageDays: rawDrawdown.ageDays ?? drawdownQuality.ageDays,
    stale: rawDrawdown.stale ?? drawdownQuality.stale,
    freshness: rawDrawdown.freshness ?? drawdownQuality.freshness,
  }
  const drawdownLevel = resolveDrawdownLevel(drawdown.drawdownPct)
  const stressReport = context.stressReport ?? null
  const stressAvailable = isMarketStressAvailableForStages(stressReport)
  const spyAvailable = isSpyDrawdownAvailableForStages(drawdown)
  const stressScore = stressReport?.score ?? null
  const marketStressLevel = stressReport?.level?.id ?? "UNKNOWN"

  const amounts = targetAmount > 0 ? computeStageAmounts(targetAmount, stagePercentages) : []
  const thresholds = CRASH_RESERVE_DRAWDOWN_THRESHOLDS.slice(0, stageCount)
  const minStressScores = CRASH_RESERVE_MIN_STRESS_SCORE.slice(0, stageCount)

  const stages = stagePercentages.map((pct, index) => {
    const { status, statusLabel } = resolveCrashReserveStageState({
      completed: stageStatuses[index] ?? false,
      drawdownPct: drawdown.drawdownPct,
      drawdownThreshold: thresholds[index] ?? -32,
      stressScore,
      minStressScore: minStressScores[index] ?? 90,
      spyAvailable,
      stressAvailable,
    })

    return {
      id: `stage-${index + 1}`,
      label: `${index + 1}차 투입`,
      pct,
      amount: targetAmount > 0 ? (amounts[index] ?? null) : null,
      drawdownThreshold: thresholds[index] ?? null,
      minStressScore: minStressScores[index] ?? null,
      completed: stageStatuses[index] ?? false,
      status,
      statusLabel,
    }
  })

  return {
    targetAmount: targetAmount > 0 ? targetAmount : null,
    currentAmount: targetAmount > 0 || currentAmount > 0 ? currentAmount : null,
    availableAmount: targetAmount > 0 || currentAmount > 0 ? currentAmount : null,
    stageCount,
    stagePercentages,
    readyPct,
    readyPctRaw: readyPctRaw == null ? null : Math.round(readyPctRaw * 10) / 10,
    drawdown: {
      pct: drawdown.drawdownPct,
      level: drawdownLevel,
      rollingHigh52w: drawdown.rollingHigh52w,
      currentClose: drawdown.currentClose,
      dataDate: drawdown.dataDate,
      symbol: drawdown.symbol,
      ageDays: drawdown.ageDays,
      stale: drawdown.stale,
      freshness: drawdown.freshness,
    },
    marketStress: {
      score: stressScore,
      level: marketStressLevel,
      label: stressReport?.level?.label ?? "데이터 확인 필요",
      available: stressAvailable,
      stale: stressReport?.dataQuality?.stale ?? null,
      dataDate: stressReport?.dataQuality?.dataDate ?? null,
      ageDays: stressReport?.dataQuality?.ageDays ?? null,
    },
    stages,
    stageAmountTotal: amounts.reduce((sum, value) => sum + value, 0),
  }
}
