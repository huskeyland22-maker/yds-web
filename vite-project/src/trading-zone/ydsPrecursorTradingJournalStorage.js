import { getTradingZonePositions } from "./tacticalTradingZoneData.js"

export const PRECURSOR_TRADING_JOURNAL_STORAGE_KEY = "yds-precursor-trading-journal-v1"

/** @typedef {'holding' | 'takeProfit' | 'stopLoss'} JournalTradeStatusId */

/** @typedef {{
 *   id: string
 *   name: string
 *   symbol: string
 *   code?: string | null
 *   entryDate: string
 *   entryPrice: number
 *   currentPrice: number | null
 *   exitPrice?: number | null
 *   returnPct: number | null
 *   status: JournalTradeStatusId
 *   statusLabel: string
 *   source?: string
 *   entryGrade?: string | null
 *   candidateId?: string | null
 *   closedAt?: string | null
 *   updatedAt?: string
 * }} JournalTradeRow
 */

export const JOURNAL_STATUS_LABELS = {
  holding: "보유중",
  takeProfit: "익절",
  stopLoss: "손절",
}

function uid() {
  return `tj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function num(v) {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/,/g, ""))
  return Number.isFinite(n) ? n : null
}

function emptyState() {
  return { version: 1, trades: /** @type {JournalTradeRow[]} */ ([]) }
}

/**
 * @param {number | null} entry
 * @param {number | null} current
 */
export function computeReturnPct(entry, current) {
  if (entry == null || current == null || entry <= 0) return null
  return Math.round(((current - entry) / entry) * 1000) / 10
}

/**
 * @param {JournalTradeStatusId} status
 */
export function journalStatusLabel(status) {
  return JOURNAL_STATUS_LABELS[status] ?? "보유중"
}

/**
 * @param {import("./tacticalTradingZoneData.js").TradingZonePosition} pos
 * @returns {JournalTradeStatusId}
 */
function statusFromTradingStage(stage) {
  if (stage === "takeProfit") return "takeProfit"
  if (stage === "risk") return "stopLoss"
  return "holding"
}

/**
 * @param {import("./tacticalTradingZoneData.js").TradingZonePosition} pos
 * @returns {JournalTradeRow | null}
 */
function tradeFromPosition(pos) {
  const entryPrice = pos.stopNum != null && pos.targetNum != null ? (pos.stopNum + pos.targetNum) / 2 : pos.currentPrice
  const avgFromEntry = typeof pos.entry === "string" ? num(pos.entry.replace(/[^\d.]/g, "")) : null
  const entry = num(pos.currentPrice) ?? avgFromEntry ?? entryPrice
  if (entry == null) return null

  const current = num(pos.currentPrice) ?? entry
  const status = statusFromTradingStage(pos.stage)
  const history = pos.stageHistory ?? []
  const entryDate = history[0]?.at ?? "2026-05-15"

  return {
    id: `seed-${pos.id}`,
    name: pos.symbol,
    symbol: pos.symbol,
    code: null,
    entryDate: String(entryDate).slice(0, 10),
    entryPrice: Math.round(entry),
    currentPrice: status === "holding" ? Math.round(current) : null,
    exitPrice: status !== "holding" ? Math.round(current) : null,
    returnPct: computeReturnPct(entry, current),
    status,
    statusLabel: journalStatusLabel(status),
    source: "trading-zone-seed",
    entryGrade: null,
    candidateId: pos.id,
    closedAt: status !== "holding" ? String(history[history.length - 1]?.at ?? entryDate).slice(0, 10) : null,
  }
}

/** @returns {JournalTradeRow[]} */
export function buildSeedJournalTrades() {
  const positions = getTradingZonePositions()
  /** @type {JournalTradeRow[]} */
  const rows = []

  const silicon = positions.find((p) => p.id === "kr-silicon")
  if (silicon) {
    rows.push({
      id: "seed-kr-silicon",
      name: "실리콘투",
      symbol: "257720",
      code: "257720",
      entryDate: "2026-06-05",
      entryPrice: 42000,
      currentPrice: 48500,
      returnPct: computeReturnPct(42000, 48500),
      status: "holding",
      statusLabel: journalStatusLabel("holding"),
      source: "entry-radar-demo",
      entryGrade: "A",
      candidateId: "kr-silicon",
    })
  }

  for (const pos of positions) {
    if (pos.id === "kr-silicon") continue
    const row = tradeFromPosition(pos)
    if (row) rows.push(row)
  }

  rows.push({
    id: "seed-us-avgo-closed",
    name: "브로드컴",
    symbol: "AVGO",
    code: null,
    entryDate: "2026-04-18",
    entryPrice: 168,
    currentPrice: null,
    exitPrice: 154.5,
    returnPct: computeReturnPct(168, 154.5),
    status: "stopLoss",
    statusLabel: journalStatusLabel("stopLoss"),
    source: "seed-closed",
    entryGrade: "C",
    closedAt: "2026-05-20",
  })

  rows.push({
    id: "seed-us-meta-closed",
    name: "메타",
    symbol: "META",
    code: null,
    entryDate: "2026-03-10",
    entryPrice: 480,
    currentPrice: null,
    exitPrice: 537.6,
    returnPct: computeReturnPct(480, 537.6),
    status: "takeProfit",
    statusLabel: journalStatusLabel("takeProfit"),
    source: "seed-closed",
    entryGrade: "B",
    closedAt: "2026-05-08",
  })

  return rows
}

export function loadPrecursorTradingJournal() {
  if (typeof window === "undefined") {
    return { ...emptyState(), trades: buildSeedJournalTrades() }
  }
  try {
    const raw = window.localStorage.getItem(PRECURSOR_TRADING_JOURNAL_STORAGE_KEY)
    if (!raw) {
      const seeded = { version: 1, trades: buildSeedJournalTrades() }
      window.localStorage.setItem(PRECURSOR_TRADING_JOURNAL_STORAGE_KEY, JSON.stringify(seeded))
      return seeded
    }
    const parsed = JSON.parse(raw)
    const trades = Array.isArray(parsed.trades) ? parsed.trades : []
    if (trades.length === 0) {
      const seeded = { version: 1, trades: buildSeedJournalTrades() }
      savePrecursorTradingJournal(seeded)
      return seeded
    }
    return { version: 1, trades }
  } catch {
    return { version: 1, trades: buildSeedJournalTrades() }
  }
}

/** @param {{ version?: number; trades: JournalTradeRow[] }} state */
export function savePrecursorTradingJournal(state) {
  if (typeof window === "undefined") return
  const trimmed = {
    version: 1,
    trades: (state.trades ?? []).slice(0, 200),
  }
  window.localStorage.setItem(PRECURSOR_TRADING_JOURNAL_STORAGE_KEY, JSON.stringify(trimmed))
}

/** @param {JournalTradeRow[]} trades */
export function sortTradesRecentFirst(trades) {
  return [...trades].sort((a, b) => {
    const da = a.closedAt ?? a.entryDate ?? ""
    const db = b.closedAt ?? b.entryDate ?? ""
    return db.localeCompare(da)
  })
}
