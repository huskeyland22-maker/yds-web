/**
 * 추천 검증 — 생성 시각(createdAt) vs 기준 거래일(marketDate) vs 기준 종가
 */

/** @param {number} recordedAt */
function formatCreatedAtIso(recordedAt) {
  const d = new Date(recordedAt)
  const pad = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** @param {unknown} v */
function toPositivePrice(v) {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** NYSE/Nasdaq full-day closures (2025–2027) */
const US_MARKET_CLOSED = new Set([
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
function isWeekend(dateKey) {
  const d = new Date(`${dateKey}T12:00:00Z`)
  const day = d.getUTCDay()
  return day === 0 || day === 6
}

/**
 * @param {string} dateKey
 * @param {'US' | 'KR'} [country]
 */
export function isMarketClosedDay(dateKey, country = "US") {
  const key = normalizeDateKey(dateKey)
  if (!key) return false
  if (isWeekend(key)) return true
  if (country === "US") return US_MARKET_CLOSED.has(key)
  return false
}

/**
 * @param {string} dateKey
 * @param {'US' | 'KR'} [country]
 */
export function rollBackToTradingDay(dateKey, country = "US") {
  let key = normalizeDateKey(dateKey)
  if (!key) return null
  for (let guard = 0; guard < 14; guard += 1) {
    if (!isMarketClosedDay(key, country)) return key
    const d = new Date(`${key}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() - 1)
    key = d.toISOString().slice(0, 10)
  }
  return key
}

/** @param {object | null | undefined} apiBody */
export function extractPickMarketMeta(apiBody) {
  const ps = apiBody?.priceSummary ?? {}
  const bars = Array.isArray(apiBody?.chart?.bars) ? apiBody.chart.bars : []
  return {
    priceSummary: ps,
    chartBars: bars,
    regularClose: toPositivePrice(ps.regularClose ?? ps.todayClose ?? apiBody?.regularClose),
    previousClose: toPositivePrice(ps.previousClose),
    todayBarDate: normalizeDateKey(ps.todayBarDate),
    sessionBadgeKey: String(ps.sessionBadgeKey ?? "regular_close"),
    showLive: Boolean(ps.showLive),
  }
}

/**
 * @param {Array<{ date?: string; close?: number }>} bars
 * @param {string | null | undefined} dateKey
 */
function findBarClose(bars, dateKey) {
  const target = normalizeDateKey(dateKey)
  if (!target || !Array.isArray(bars) || !bars.length) return null
  for (let i = bars.length - 1; i >= 0; i -= 1) {
    const d = normalizeDateKey(bars[i]?.date)
    if (d === target) return toPositivePrice(bars[i]?.close)
  }
  return null
}

/**
 * @param {Array<{ date?: string }>} bars
 * @param {string | null | undefined} refDate
 */
function findPriorBarDate(bars, refDate) {
  const ref = normalizeDateKey(refDate)
  if (!Array.isArray(bars) || !bars.length) return null
  let prior = null
  for (const bar of bars) {
    const d = normalizeDateKey(bar?.date)
    if (!d) continue
    if (ref && d >= ref) break
    prior = d
  }
  if (prior) return prior
  if (bars.length >= 2) return normalizeDateKey(bars[bars.length - 2]?.date)
  return null
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 * @param {'US' | 'KR'} [country]
 * @returns {{ marketDate: string | null; marketClose: number | null }}
 */
export function resolveRecommendMarketAnchor(stock, country = "US") {
  const c = country === "KR" ? "KR" : "US"
  const pm = stock?.pickMarket ?? {}
  const ps = pm.priceSummary ?? {}
  const sessionKey = String(ps.sessionBadgeKey ?? pm.sessionBadgeKey ?? "regular_close")
  const isLiveSession =
    sessionKey === "intraday" || sessionKey === "pre" || Boolean(ps.showLive ?? pm.showLive)
  const todayBarDate = normalizeDateKey(ps.todayBarDate ?? pm.todayBarDate)
  const regularClose = toPositivePrice(ps.regularClose ?? ps.todayClose ?? pm.regularClose)
  const previousClose = toPositivePrice(ps.previousClose ?? pm.previousClose)
  const bars = pm.chartBars ?? []

  if (isLiveSession && previousClose != null) {
    const priorDate =
      findPriorBarDate(bars, todayBarDate) ??
      (todayBarDate ? rollBackToTradingDay(todayBarDate, c) : null)
    const priorClose = (priorDate ? findBarClose(bars, priorDate) : null) ?? previousClose
    if (priorDate && priorClose != null) {
      return { marketDate: rollBackToTradingDay(priorDate, c), marketClose: priorClose }
    }
  }

  if (todayBarDate && regularClose != null) {
    const marketDate = rollBackToTradingDay(todayBarDate, c)
    let marketClose = regularClose
    if (marketDate !== todayBarDate) {
      marketClose = findBarClose(bars, marketDate) ?? previousClose ?? regularClose
    }
    return { marketDate, marketClose }
  }

  const snapClose = toPositivePrice(stock?.snapshot?.close)
  if (snapClose != null) {
    const fallbackDate = rollBackToTradingDay(new Date().toISOString().slice(0, 10), c)
    return { marketDate: fallbackDate, marketClose: snapClose }
  }

  return { marketDate: null, marketClose: null }
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord | null | undefined} record
 */
export function resolvePickMarketDate(record) {
  if (!record) return null
  const raw =
    record.lockedMarketDate ??
    record.marketDate ??
    record.lockedRecommendedAt ??
    record.recommendedAt ??
    null
  const key = normalizeDateKey(raw)
  if (!key) return null
  const country = record.country === "KR" ? "KR" : "US"
  return rollBackToTradingDay(key, country)
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord | null | undefined} record
 */
export function resolvePickCreatedAt(record) {
  if (!record) return null
  const ts = record.createdAt ?? record.recordedAt
  return Number.isFinite(Number(ts)) && Number(ts) > 0 ? Number(ts) : null
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord | null | undefined} record
 */
export function formatPickCreatedAtLabel(record) {
  const ts = resolvePickCreatedAt(record)
  if (ts == null) {
    const iso = record?.recommendedAtIso ?? record?.lockedRecommendedAtIso
    return iso ? String(iso) : null
  }
  return formatCreatedAtIso(ts)
}

/**
 * @param {string | null | undefined} dateKey
 * @param {'US' | 'KR'} [country]
 */
export function correctStoredMarketDate(dateKey, country = "US") {
  return rollBackToTradingDay(dateKey, country)
}

/**
 * @param {import("./ydsValidationStorage.js").ValidationPickRecord} record
 */
export function repairPickMarketFields(record) {
  const country = record.country === "KR" ? "KR" : "US"
  const marketDate = correctStoredMarketDate(
    record.marketDate ?? record.lockedMarketDate ?? record.recommendedAt,
    country,
  )
  const createdAt = resolvePickCreatedAt(record) ?? record.recordedAt ?? Date.now()

  return {
    marketDate,
    lockedMarketDate: marketDate,
    createdAt,
    recommendedAt: marketDate ?? record.recommendedAt,
    lockedRecommendedAt: marketDate ?? record.lockedRecommendedAt,
  }
}
