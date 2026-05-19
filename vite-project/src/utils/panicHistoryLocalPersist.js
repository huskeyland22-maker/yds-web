/**
 * 패닉 히스토리 localStorage — panic_history / cycle_history (차트 복구용)
 */

import { calendarKeyFromPanic } from "./cycleHistoryHygiene.js"
import { panicIndexRowToCycleChart } from "./panicIndexHistory.js"
import { PANIC_HISTORY_SEED, PANIC_HISTORY_SEED_MIN_DAYS } from "./panicHistorySeed.js"

export const PANIC_HISTORY_LS_KEY = "panic_history"
export const CYCLE_HISTORY_LS_KEY = "cycle_history"
const MAX_ROWS = 500

/** @typedef {{ date: string, vix?: number | null, fearGreed?: number | null, putCall?: number | null, move?: number | null, bofa?: number | null, skew?: number | null, highYield?: number | null, hyOas?: number | null, gsBullBear?: number | null, gsSentiment?: number | null, panicIndex?: number | null }} PanicHistoryRow */

const SEED_METRIC_CHECK_KEYS = ["fearGreed", "bofa", "putCall", "highYield", "move", "skew", "gsBullBear"]

function rowHasSeedMetrics(row) {
  if (!row) return false
  return SEED_METRIC_CHECK_KEYS.every((k) => {
    const v = k === "highYield" ? (row.highYield ?? row.hyOas) : k === "gsBullBear" ? (row.gsBullBear ?? row.gsSentiment) : row[k]
    return v != null && Number.isFinite(Number(v))
  })
}

function storedNeedsSeedUpgrade(stored) {
  if (!Array.isArray(stored) || stored.length < PANIC_HISTORY_SEED_MIN_DAYS) return true
  const fullRows = stored.filter(rowHasSeedMetrics).length
  return fullRows < PANIC_HISTORY_SEED_MIN_DAYS
}

function toNum(v) {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function readJsonArray(key) {
  if (typeof window === "undefined") return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "[]")
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeJsonArray(key, rows) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(key, JSON.stringify(rows))
  } catch (e) {
    console.warn("[YDS] localStorage write failed", key, e)
  }
}

/** @param {PanicHistoryRow[]} rows */
function mergePanicHistoryRowsByDate(...rowLists) {
  const byDate = new Map()
  for (const list of rowLists) {
    if (!Array.isArray(list)) continue
    for (const r of list) {
      if (!r?.date) continue
      const d = String(r.date).slice(0, 10)
      byDate.set(d, { ...byDate.get(d), ...r, date: d })
    }
  }
  return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

/**
 * panic_history 로드 + seed fallback (immutable)
 * @returns {PanicHistoryRow[]}
 */
export function loadStoredPanicHistory() {
  let stored = readJsonArray(PANIC_HISTORY_LS_KEY)
  console.log("loaded history", stored.length, stored)

  if (stored.length === 0) {
    const seededHistory = [...PANIC_HISTORY_SEED]
    window.localStorage.setItem(PANIC_HISTORY_LS_KEY, JSON.stringify(seededHistory))
    console.log("seed save", seededHistory.length)
    return seededHistory
  }

  if (storedNeedsSeedUpgrade(stored)) {
    const seededHistory = mergePanicHistoryRowsByDate(stored, PANIC_HISTORY_SEED)
    window.localStorage.setItem(PANIC_HISTORY_LS_KEY, JSON.stringify(seededHistory))
    console.log("seed save", seededHistory.length, "(merged full metrics PANIC_HISTORY_SEED)")
    return seededHistory
  }

  return stored
}

/** @param {object} panicData @param {string} [tradeDate] */
export function buildPanicHistoryRow(panicData, tradeDate) {
  if (!panicData || typeof panicData !== "object") return null
  const date =
    (typeof tradeDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(tradeDate.slice(0, 10))
      ? tradeDate.slice(0, 10)
      : null) ?? calendarKeyFromPanic(panicData)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null

  const highYield = toNum(panicData.highYield ?? panicData.hyOas ?? panicData.hy_oas)
  const gsBullBear = toNum(panicData.gsBullBear ?? panicData.gsSentiment ?? panicData.gs_sentiment)
  return {
    date,
    vix: toNum(panicData.vix),
    fearGreed: toNum(panicData.fearGreed ?? panicData.fear_greed),
    putCall: toNum(panicData.putCall ?? panicData.put_call),
    move: toNum(panicData.move),
    bofa: toNum(panicData.bofa),
    skew: toNum(panicData.skew),
    highYield,
    hyOas: highYield,
    gsBullBear,
    gsSentiment: gsBullBear,
    panicIndex: toNum(
      panicData.panicIndex ?? panicData.panicScore ?? panicData.panic_score ?? panicData.finalScore,
    ),
  }
}

/** @param {object} panicData @param {string} [tradeDate] @param {{ marketState?: string, sector?: string }} [meta] */
export function buildCycleHistoryMetaRow(panicData, tradeDate, meta = {}) {
  const date =
    (typeof tradeDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(tradeDate.slice(0, 10))
      ? tradeDate.slice(0, 10)
      : null) ?? calendarKeyFromPanic(panicData)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  return {
    date,
    marketState:
      meta.marketState ??
      panicData?.marketState ??
      panicData?.market_state ??
      panicData?.regimeLabel ??
      null,
    sector: meta.sector ?? panicData?.priority_sector ?? panicData?.sector ?? null,
  }
}

export function readPanicHistoryLocal() {
  return loadStoredPanicHistory()
}

export function readCycleHistoryLocal() {
  return readJsonArray(CYCLE_HISTORY_LS_KEY)
}

/** @param {object} historyRow */
export function appendHistory(historyRow) {
  if (!historyRow?.date) return readPanicHistoryLocal()
  const prev = loadStoredPanicHistory()
  const merged = mergePanicHistoryRowsByDate(prev, [historyRow])
  const trimmed = merged.length > MAX_ROWS ? merged.slice(-MAX_ROWS) : merged
  writeJsonArray(PANIC_HISTORY_LS_KEY, trimmed)
  console.log("history save", historyRow)
  return trimmed
}

/**
 * @param {object[]} historyRows
 * @param {{ merge?: boolean }} [opts]
 */
export function saveHistory(historyRows, opts = { merge: true }) {
  const incoming = Array.isArray(historyRows) ? historyRows.filter((r) => r?.date) : []
  const rows = opts.merge
    ? mergePanicHistoryRowsByDate(loadStoredPanicHistory(), incoming)
    : incoming
  const trimmed = rows.slice(-MAX_ROWS)
  writeJsonArray(PANIC_HISTORY_LS_KEY, trimmed)
  if (trimmed.length) console.log("history save", trimmed[trimmed.length - 1])
  console.log("history rows", trimmed.length)
  return trimmed
}

/**
 * @param {object} panicData
 * @param {string} [tradeDate]
 * @param {{ marketState?: string, sector?: string }} [opts]
 */
export function persistHistory(panicData, tradeDate, opts = {}) {
  const historyRow = buildPanicHistoryRow(panicData, tradeDate)
  let historyRows = loadStoredPanicHistory()
  if (historyRow) {
    historyRows = appendHistory(historyRow)
  }

  const metaRow = buildCycleHistoryMetaRow(panicData, tradeDate, opts)
  if (metaRow) {
    const prev = readCycleHistoryLocal()
    const without = prev.filter((r) => r.date !== metaRow.date)
    const cycleMeta = [...without, metaRow].sort((a, b) => String(a.date).localeCompare(String(b.date)))
    writeJsonArray(CYCLE_HISTORY_LS_KEY, cycleMeta.slice(-MAX_ROWS))
  }

  console.log("history rows", historyRows.length)
  return { historyRows, historyRow, metaRow }
}

/** panic_history → cycle 차트 row[] */
export function panicHistoryLocalToCycleRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return []
  return rows
    .map((r) => {
      const highYield = r.highYield ?? r.hyOas
      const gsBullBear = r.gsBullBear ?? r.gsSentiment
      return panicIndexRowToCycleChart({
        date: r.date,
        vix: r.vix,
        fearGreed: r.fearGreed,
        fear_greed: r.fearGreed,
        putCall: r.putCall,
        put_call: r.putCall,
        move: r.move,
        bofa: r.bofa,
        skew: r.skew,
        highYield,
        high_yield: highYield,
        hyOas: highYield,
        hy_oas: highYield,
        gsBullBear,
        gs_sentiment: gsBullBear,
        gsSentiment: gsBullBear,
        panicScore: r.panicIndex ?? r.panic_score,
      })
    })
    .filter(Boolean)
}

/** @param {object[]} cycleRows — cycleMetricHistory → panic_history 동기화 (기존 seed 유지 병합) */
export function persistHistoryFromCycleRows(cycleRows) {
  if (!Array.isArray(cycleRows) || !cycleRows.length) return { historyRows: [], cycleRows: [] }
  const historyRows = cycleRows
    .map((r) =>
      buildPanicHistoryRow(
        {
          ...r,
          highYield: r.highYield ?? r.hyOas,
          gsBullBear: r.gsBullBear ?? r.gsSentiment,
        },
        r.date,
      ),
    )
    .filter(Boolean)
  const merged = saveHistory(historyRows, { merge: true })
  console.log("history rows", merged.length)
  return { historyRows: merged, cycleRows }
}
