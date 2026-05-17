/**
 * 일별 패닉 지표 스냅샷 — 동일 date 는 update, 다른 date 는 append.
 * 서버: Supabase panic_index_history · 로컬: localStorage
 */

import { isStaleHistoryCalendarDate } from "./cycleHistoryHygiene.js"

export const PANIC_INDEX_HISTORY_KEY = "yds-panic-index-history-v1"
const MAX_ROWS = 500

function toNum(v) {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function calendarDateFromPanic(panicData) {
  const u = panicData?.updatedAt ?? panicData?.updated_at
  if (typeof u === "string" && /^\d{4}-\d{2}-\d{2}/.test(u)) return u.slice(0, 10)
  return new Date().toISOString().slice(0, 10)
}

/**
 * @param {Record<string, unknown>} panicData
 * @param {string} [dateOverride] YYYY-MM-DD
 */
export function buildPanicIndexSnapshot(panicData, dateOverride) {
  if (!panicData || typeof panicData !== "object") return null
  const date = dateOverride || calendarDateFromPanic(panicData)
  return {
    date,
    vix: toNum(panicData.vix),
    vxn: toNum(panicData.vxn),
    fearGreed: toNum(panicData.fearGreed),
    move: toNum(panicData.move),
    bofa: toNum(panicData.bofa),
    skew: toNum(panicData.skew),
    hyOas: toNum(panicData.highYield ?? panicData.hyOas),
    gsSentiment: toNum(panicData.gsBullBear ?? panicData.gsSentiment ?? panicData.gs),
    createdAt: new Date().toISOString(),
  }
}

function readRaw() {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(PANIC_INDEX_HISTORY_KEY)
    const parsed = JSON.parse(raw || "[]")
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRaw(rows) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(PANIC_INDEX_HISTORY_KEY, JSON.stringify(rows))
  } catch {
    // quota / private mode
  }
}

export function normalizePanicIndexHistoryRow(row) {
  if (!row || typeof row !== "object") return null
  const date = String(row.date ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isStaleHistoryCalendarDate(date)) return null
  const snap = {
    date,
    vix: toNum(row.vix),
    vxn: toNum(row.vxn),
    fearGreed: toNum(row.fearGreed),
    move: toNum(row.move),
    bofa: toNum(row.bofa),
    skew: toNum(row.skew),
    hyOas: toNum(row.hyOas ?? row.highYield),
    gsSentiment: toNum(row.gsSentiment ?? row.gsBullBear ?? row.gs),
    createdAt: row.createdAt ?? row.created_at ?? null,
  }
  const core = ["vix", "fearGreed", "bofa", "hyOas"]
  if (!core.every((k) => snap[k] != null)) return null
  return snap
}

/** @returns {ReturnType<typeof buildPanicIndexSnapshot>[]} */
export function getPanicIndexHistory() {
  return readRaw()
    .map(normalizePanicIndexHistoryRow)
    .filter(Boolean)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

/**
 * 동일 날짜 → replace, 다른 날짜 → append
 * @returns {ReturnType<typeof getPanicIndexHistory>}
 */
export function appendPanicIndexHistory(panicData, dateOverride) {
  const u = panicData?.updatedAt ?? panicData?.updated_at
  if (typeof u === "string" && isStaleHistoryCalendarDate(u.slice(0, 10))) return getPanicIndexHistory()
  const entry = buildPanicIndexSnapshot(panicData, dateOverride)
  if (!entry) return getPanicIndexHistory()
  const normalized = normalizePanicIndexHistoryRow(entry)
  if (!normalized) return getPanicIndexHistory()

  const prev = getPanicIndexHistory()
  const withoutDate = prev.filter((r) => r.date !== normalized.date)
  const merged = [...withoutDate, normalized].sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const trimmed = merged.length > MAX_ROWS ? merged.slice(-MAX_ROWS) : merged
  writeRaw(trimmed)
  return trimmed
}

/** 서버 rows 로 로컬 스냅샷 동기화 */
export function replacePanicIndexHistory(rows) {
  const merged = mergePanicIndexHistoryRows(getPanicIndexHistory(), rows)
  writeRaw(merged)
  return merged
}

/** 서버·로컬 병합 (date 키, 나중 행 우선) */
export function mergePanicIndexHistoryRows(rowsA, rowsB) {
  const out = new Map()
  for (const row of [...(rowsA || []), ...(rowsB || [])]) {
    const n = normalizePanicIndexHistoryRow(row)
    if (!n) continue
    const prev = out.get(n.date)
    out.set(n.date, prev ? { ...prev, ...n, createdAt: n.createdAt ?? prev.createdAt } : n)
  }
  return [...out.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

/** cycle-metrics 차트 호환 */
export function panicIndexRowToCycleChart(row) {
  if (!row) return null
  const date = String(row.date).slice(0, 10)
  return {
    date,
    ts: `${date}T12:00:00.000Z`,
    vix: row.vix,
    vxn: row.vxn,
    fearGreed: row.fearGreed,
    move: row.move,
    bofa: row.bofa,
    skew: row.skew,
    highYield: row.hyOas ?? row.highYield,
    gsBullBear: row.gsSentiment ?? row.gsBullBear,
    putCall: row.putCall ?? null,
  }
}
