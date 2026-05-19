import { supabaseRest, isSupabaseConfigured } from "./supabaseRest.js"
import { panicObjectFromRows, fetchPanicMetricsRows } from "./panicMetricsHub.js"

function kstDateYmd(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d)
}

function toNum(v) {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** @param {Record<string, number | null>} panic */
export function approximatePanicIndex(panic) {
  if (!panic) return null
  const vix = toNum(panic.vix)
  const fg = toNum(panic.fearGreed)
  const pc = toNum(panic.putCall)
  const bofa = toNum(panic.bofa)
  const hy = toNum(panic.highYield)
  if (vix == null && fg == null) return null

  const scoreVix = vix == null ? 50 : Math.min(100, Math.max(0, ((vix - 12) / 28) * 100))
  const scorePc = pc == null ? 50 : Math.min(100, Math.max(0, ((pc - 0.65) / 0.6) * 100))
  const scoreFg = fg == null ? 50 : Math.min(100, Math.max(0, 100 - fg))
  const scoreBofa = bofa == null ? 50 : Math.min(100, Math.max(0, ((6 - Math.min(6, Math.max(0, bofa))) / 6) * 100))
  const scoreHy = hy == null ? 50 : Math.min(100, Math.max(0, 100 - ((hy - 3) / 7) * 100))

  const short = scoreVix * 0.6 + scorePc * 0.4
  const mid = scoreFg * 0.4 + scoreBofa * 0.35 + scoreHy * 0.25
  let wShort = 0.5
  let wMid = 0.5
  if (hy != null && hy > 6) {
    wShort = 0.4
    wMid = 0.6
  } else if (vix != null && vix > 25) {
    wShort = 0.7
    wMid = 0.3
  }
  return Math.round(short * wShort + mid * wMid)
}

/** @returns {Promise<number | null>} */
export async function fetchLatestPanicIndex() {
  if (!isSupabaseConfigured()) return null
  try {
    const rows = await fetchPanicMetricsRows()
    const panic = panicObjectFromRows(rows)
    return approximatePanicIndex(panic)
  } catch {
    return null
  }
}

/**
 * @param {{
 *   ticker: string
 *   price?: number | null
 *   ma10?: number | null
 *   ma20?: number | null
 *   rsi?: number | null
 *   position_52w?: number | null
 *   volume_change_pct?: number | null
 *   sector_score?: number | null
 *   panic_index?: number | null
 *   signal: string
 *   date?: string
 * }} row
 */
export async function upsertStockSignalHistory(row) {
  if (!isSupabaseConfigured()) return null
  const ticker = String(row.ticker || "").trim()
  if (!ticker) return null

  const payload = {
    date: row.date || kstDateYmd(),
    ticker,
    price: toNum(row.price),
    ma10: toNum(row.ma10),
    ma20: toNum(row.ma20),
    rsi: toNum(row.rsi),
    position_52w: toNum(row.position_52w),
    volume_change_pct: toNum(row.volume_change_pct),
    sector_score: toNum(row.sector_score),
    panic_index: toNum(row.panic_index),
    signal: String(row.signal),
    updated_at: new Date().toISOString(),
  }

  return supabaseRest("stock_signal_history?on_conflict=date,ticker", {
    method: "POST",
    body: payload,
    prefer: "resolution=merge-duplicates,return=representation",
  })
}

/**
 * @param {string} ticker
 * @param {{ days?: number }} [opts]
 */
export async function fetchStockSignalHistory(ticker, opts = {}) {
  if (!isSupabaseConfigured()) return []
  const code = String(ticker || "").trim()
  if (!code) return []
  const days = Math.min(Math.max(Number(opts.days) || 30, 1), 365)
  const path =
    `stock_signal_history?select=*&ticker=eq.${encodeURIComponent(code)}` +
    `&order=date.desc&limit=${days}`
  const rows = await supabaseRest(path)
  return Array.isArray(rows) ? rows : []
}

/**
 * @param {string[]} tickers
 */
export async function fetchLatestSignalsByTickers(tickers) {
  if (!isSupabaseConfigured()) return {}
  const uniq = [...new Set(tickers.map((t) => String(t || "").trim()).filter(Boolean))]
  if (!uniq.length) return {}

  const inList = uniq.map((t) => encodeURIComponent(t)).join(",")
  const today = kstDateYmd()
  const path =
    `stock_signal_history?select=ticker,signal,price,rsi,position_52w,sector_score,panic_index,date,updated_at` +
    `&ticker=in.(${inList})&date=eq.${today}`
  let rows = await supabaseRest(path)
  if (!Array.isArray(rows)) rows = []

  /** @type {Record<string, object>} */
  const out = {}
  for (const r of rows) {
    if (r?.ticker) out[String(r.ticker)] = r
  }
  return out
}
