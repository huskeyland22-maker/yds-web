/**
 * 패닉 히스토리 localStorage — panic_history / cycle_history (차트 복구용)
 */

import { calendarKeyFromPanic } from "./cycleHistoryHygiene.js"
import { panicIndexRowToCycleChart } from "./panicIndexHistory.js"

export const PANIC_HISTORY_LS_KEY = "panic_history"
export const CYCLE_HISTORY_LS_KEY = "cycle_history"
const MAX_ROWS = 500

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

/** @param {object} panicData @param {string} [tradeDate] */
export function buildPanicHistoryRow(panicData, tradeDate) {
  if (!panicData || typeof panicData !== "object") return null
  const date =
    (typeof tradeDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(tradeDate.slice(0, 10))
      ? tradeDate.slice(0, 10)
      : null) ?? calendarKeyFromPanic(panicData)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null

  return {
    date,
    vix: toNum(panicData.vix),
    fearGreed: toNum(panicData.fearGreed ?? panicData.fear_greed),
    putCall: toNum(panicData.putCall ?? panicData.put_call),
    move: toNum(panicData.move),
    bofa: toNum(panicData.bofa),
    skew: toNum(panicData.skew),
    hyOas: toNum(panicData.highYield ?? panicData.hyOas ?? panicData.hy_oas),
    gsSentiment: toNum(panicData.gsBullBear ?? panicData.gsSentiment ?? panicData.gs_sentiment),
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
  return readJsonArray(PANIC_HISTORY_LS_KEY)
}

export function readCycleHistoryLocal() {
  return readJsonArray(CYCLE_HISTORY_LS_KEY)
}

/** @param {object} historyRow */
export function appendHistory(historyRow) {
  if (!historyRow?.date) return readPanicHistoryLocal()
  const prev = readPanicHistoryLocal()
  const without = prev.filter((r) => String(r.date).slice(0, 10) !== String(historyRow.date).slice(0, 10))
  const merged = [...without, historyRow].sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const trimmed = merged.length > MAX_ROWS ? merged.slice(-MAX_ROWS) : merged
  writeJsonArray(PANIC_HISTORY_LS_KEY, trimmed)
  console.log("history save", historyRow)
  return trimmed
}

/** @param {object[]} historyRows */
export function saveHistory(historyRows) {
  const rows = Array.isArray(historyRows) ? historyRows.filter((r) => r?.date) : []
  const trimmed = rows.slice(-MAX_ROWS)
  writeJsonArray(PANIC_HISTORY_LS_KEY, trimmed)
  if (trimmed.length) console.log("history save", trimmed[trimmed.length - 1])
  return trimmed
}

/**
 * @param {object} panicData
 * @param {string} [tradeDate]
 * @param {{ marketState?: string, sector?: string }} [opts]
 */
export function persistHistory(panicData, tradeDate, opts = {}) {
  const historyRow = buildPanicHistoryRow(panicData, tradeDate)
  let historyRows = readPanicHistoryLocal()
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
    .map((r) =>
      panicIndexRowToCycleChart({
        date: r.date,
        vix: r.vix,
        fearGreed: r.fearGreed,
        fear_greed: r.fearGreed,
        putCall: r.putCall,
        put_call: r.putCall,
        move: r.move,
        bofa: r.bofa,
        skew: r.skew,
        hyOas: r.hyOas,
        hy_oas: r.hyOas,
        gsSentiment: r.gsSentiment,
        gs_sentiment: r.gsSentiment,
      }),
    )
    .filter(Boolean)
}

/** @param {object[]} cycleRows — cycleMetricHistory → panic_history 동기화 */
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
  saveHistory(historyRows)
  console.log("history rows", historyRows.length)
  return { historyRows, cycleRows }
}
