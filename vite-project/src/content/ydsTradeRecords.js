/**
 * Manual buy trade records — localStorage only.
 * Separate from DBB episodes (`yds.dailyBottomBuy.episodes.v1`).
 * Amounts are USD · no FX · no auto orders · no sell.
 */

export const TRADE_RECORDS_STORAGE_KEY = "yds.tradeRecords.v1"

/**
 * @typedef {{
 *   id: string
 *   system: 'dbb' | 'panic'
 *   symbol: string
 *   buyDate: string
 *   buyPrice: number
 *   buyAmountUsd: number
 *   shares: number | null
 *   weightPct: number
 *   memo: string
 *   createdAt: string
 *   updatedAt: string
 * }} TradeRecord
 */

/**
 * @param {'dbb' | 'panic'} system
 * @param {string} symbol
 */
export function tradeRecordBucketKey(system, symbol) {
  const sys = system === "panic" ? "panic" : "dbb"
  const sym = String(symbol || "")
    .trim()
    .toUpperCase()
  return `${sys}:${sym}`
}

function emptyStore() {
  return /** @type {{ version: 1, records: Record<string, TradeRecord[]> }} */ ({
    version: 1,
    records: {},
  })
}

/**
 * @returns {{ version: 1, records: Record<string, TradeRecord[]> }}
 */
export function readTradeRecordsStore() {
  try {
    const raw = localStorage.getItem(TRADE_RECORDS_STORAGE_KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return emptyStore()
    const records =
      parsed.records && typeof parsed.records === "object" ? parsed.records : {}
    /** @type {Record<string, TradeRecord[]>} */
    const clean = {}
    for (const [k, list] of Object.entries(records)) {
      if (!Array.isArray(list)) continue
      clean[k] = list
        .filter((r) => r && typeof r === "object" && typeof r.id === "string")
        .map((r) => normalizeRecord(r))
        .filter(Boolean)
    }
    return { version: 1, records: clean }
  } catch {
    return emptyStore()
  }
}

/**
 * @param {{ version: 1, records: Record<string, TradeRecord[]> }} store
 */
export function writeTradeRecordsStore(store) {
  try {
    localStorage.setItem(
      TRADE_RECORDS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        records: store?.records && typeof store.records === "object" ? store.records : {},
      }),
    )
  } catch {
    /* ignore quota */
  }
}

/**
 * Legacy `buyAmountKrw` is treated as USD dollars (never convert FX).
 * @param {unknown} raw
 * @returns {TradeRecord | null}
 */
function normalizeRecord(raw) {
  if (!raw || typeof raw !== "object") return null
  const r = /** @type {Record<string, unknown>} */ (raw)
  const id = typeof r.id === "string" ? r.id : null
  const system = r.system === "panic" ? "panic" : r.system === "dbb" ? "dbb" : null
  const symbol = typeof r.symbol === "string" ? r.symbol.trim().toUpperCase() : ""
  const buyDate =
    typeof r.buyDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.buyDate) ? r.buyDate : null
  const buyPrice = Number(r.buyPrice)
  const amountRaw =
    r.buyAmountUsd != null ? Number(r.buyAmountUsd) : Number(r.buyAmountKrw)
  const weightPct = Number(r.weightPct)
  const sharesRaw = r.shares
  let shares = null
  if (sharesRaw != null && sharesRaw !== "") {
    const s = Number(sharesRaw)
    if (Number.isFinite(s) && s > 0) shares = s
  }
  if (!id || !system || !symbol || !buyDate) return null
  if (!Number.isFinite(buyPrice) || buyPrice <= 0) return null
  if (!Number.isFinite(amountRaw) || amountRaw < 0) return null
  if (!Number.isFinite(weightPct) || weightPct < 0) return null
  return {
    id,
    system,
    symbol,
    buyDate,
    buyPrice,
    buyAmountUsd: amountRaw,
    shares,
    weightPct,
    memo: typeof r.memo === "string" ? r.memo : "",
    createdAt: typeof r.createdAt === "string" ? r.createdAt : buyDate,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : buyDate,
  }
}

/**
 * @param {'dbb' | 'panic'} system
 * @param {string} symbol
 * @returns {TradeRecord[]}
 */
export function listTradeRecords(system, symbol) {
  const key = tradeRecordBucketKey(system, symbol)
  const store = readTradeRecordsStore()
  const list = store.records[key]
  return Array.isArray(list) ? list.slice().sort((a, b) => a.buyDate.localeCompare(b.buyDate)) : []
}

/**
 * @param {Omit<TradeRecord, 'id' | 'createdAt' | 'updatedAt' | 'shares'> & {
 *   id?: string
 *   shares?: number | null
 *   buyAmountUsd?: number
 *   buyAmountKrw?: number
 * }} input
 * @returns {TradeRecord | null}
 */
export function upsertTradeRecord(input) {
  const system = input?.system === "panic" ? "panic" : input?.system === "dbb" ? "dbb" : null
  const symbol = String(input?.symbol || "")
    .trim()
    .toUpperCase()
  if (!system || !symbol) return null

  const now = new Date().toISOString()
  const store = readTradeRecordsStore()
  const key = tradeRecordBucketKey(system, symbol)
  const existing = (store.records[key] || []).find((r) => r.id === input.id)
  const id =
    typeof input.id === "string" && input.id
      ? input.id
      : `tr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const amountUsd =
    input.buyAmountUsd != null ? input.buyAmountUsd : input.buyAmountKrw

  const record = normalizeRecord({
    id,
    system,
    symbol,
    buyDate: input.buyDate,
    buyPrice: input.buyPrice,
    buyAmountUsd: amountUsd,
    shares: input.shares,
    weightPct: input.weightPct,
    memo: input.memo ?? "",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  })
  if (!record) return null

  const next = (store.records[key] || []).filter((r) => r.id !== record.id)
  next.push(record)
  store.records[key] = next
  writeTradeRecordsStore(store)
  return record
}

/**
 * @param {'dbb' | 'panic'} system
 * @param {string} symbol
 * @param {string} id
 * @returns {boolean}
 */
export function deleteTradeRecord(system, symbol, id) {
  const key = tradeRecordBucketKey(system, symbol)
  const store = readTradeRecordsStore()
  const list = store.records[key]
  if (!Array.isArray(list) || !list.length) return false
  const next = list.filter((r) => r.id !== id)
  if (next.length === list.length) return false
  if (next.length) store.records[key] = next
  else delete store.records[key]
  writeTradeRecordsStore(store)
  return true
}

/**
 * @param {TradeRecord[]} records
 * @returns {number}
 */
export function sumTradeWeightPct(records) {
  if (!Array.isArray(records) || !records.length) return 0
  return records.reduce((s, r) => s + (Number(r.weightPct) || 0), 0)
}

/**
 * Shares-weighted average when shares exist; else USD-amount-weighted.
 * @param {TradeRecord[]} records
 * @returns {number | null}
 */
export function averageTradeBuyPrice(records) {
  if (!Array.isArray(records) || !records.length) return null
  let pSum = 0
  let wSum = 0
  for (const r of records) {
    const p = Number(r.buyPrice)
    if (!Number.isFinite(p) || p <= 0) continue
    const sh = Number(r.shares)
    const amt = Number(r.buyAmountUsd)
    const weight =
      Number.isFinite(sh) && sh > 0
        ? sh
        : Number.isFinite(amt) && amt > 0
          ? amt
          : 1
    pSum += p * weight
    wSum += weight
  }
  return wSum > 0 ? pSum / wSum : null
}

/**
 * @param {TradeRecord[]} records
 * @returns {string | null}
 */
export function earliestTradeBuyDate(records) {
  if (!Array.isArray(records) || !records.length) return null
  let min = null
  for (const r of records) {
    if (!r?.buyDate) continue
    if (!min || r.buyDate < min) min = r.buyDate
  }
  return min
}

/**
 * @param {string | null | undefined} fromDate
 * @param {string | null | undefined} toDate
 * @returns {number | null}
 */
export function daysBetweenDayKeys(fromDate, toDate) {
  if (
    typeof fromDate !== "string" ||
    typeof toDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(fromDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(toDate)
  ) {
    return null
  }
  const a = Date.UTC(
    Number(fromDate.slice(0, 4)),
    Number(fromDate.slice(5, 7)) - 1,
    Number(fromDate.slice(8, 10)),
  )
  const b = Date.UTC(
    Number(toDate.slice(0, 4)),
    Number(toDate.slice(5, 7)) - 1,
    Number(toDate.slice(8, 10)),
  )
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

/**
 * @param {number | null | undefined} buyPrice
 * @param {number | null | undefined} currentPrice
 * @returns {number | null}
 */
export function tradeReturnPct(buyPrice, currentPrice) {
  const b = Number(buyPrice)
  const c = Number(currentPrice)
  if (!Number.isFinite(b) || b <= 0 || !Number.isFinite(c) || c <= 0) return null
  return ((c - b) / b) * 100
}

/** ETF USD price — always $0.00 */
export function formatUsdPrice(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—"
  return `$${Number(n).toFixed(2)}`
}

/** USD amount — $1,080.00 */
export function formatUsdAmount(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—"
  return `$${Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/** @param {number | null | undefined} shares */
export function formatShares(shares) {
  if (shares == null || shares === "") return "—"
  const s = Number(shares)
  if (!Number.isFinite(s) || s <= 0) return "—"
  const text = Number.isInteger(s) ? String(s) : String(s)
  return `${text}주`
}

/**
 * @param {number | null | undefined} pct
 * @returns {string}
 */
export function formatReturnPct(pct) {
  if (pct == null || !Number.isFinite(Number(pct))) return "—"
  const x = Number(pct)
  if (Object.is(x, -0) || Math.abs(x) < 0.0000001) return "0.00%"
  if (x > 0) return `+${x.toFixed(2)}%`
  return `${x.toFixed(2)}%`
}
