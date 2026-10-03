/**
 * Operating lists for the equity adjustment screen.
 * EQUITY_CANDIDATES stays the 48-name research universe.
 * ETN and GEV are operating names only. They are not added to that research list.
 */

import { EQUITY_CANDIDATES } from "./daily-bottom-buy-cross-asset-validation.mjs"

export const ACTIVE_UNIVERSE = [
  "AMZN",
  "AAPL",
  "AMAT",
  "ASML",
  "AVGO",
  "CEG",
  "ETN",
  "FCX",
  "FTNT",
  "GOOGL",
  "LRCX",
  "LLY",
  "MU",
  "NVDA",
  "ORCL",
  "PANW",
  "PLTR",
  "TSLA",
  "TSM",
  "VST",
]

export const CORE_UNIVERSE = [
  "AMZN",
  "AVGO",
  "CEG",
  "FCX",
  "FTNT",
  "LRCX",
  "MU",
  "NVDA",
  "PANW",
  "VST",
]

export const WATCH_UNIVERSE = [
  "AAPL",
  "AMAT",
  "ASML",
  "ETN",
  "GOOGL",
  "LLY",
  "ORCL",
  "PLTR",
  "TSLA",
  "TSM",
]

export const FUTURE_WATCH_UNIVERSE = ["CRWD", "META", "AMD", "GE", "GEV", "EQIX"]

/** Existing 48-name study list. Research scripts keep using this. */
export const LEGACY_UNIVERSE = EQUITY_CANDIDATES
export const RESEARCH_UNIVERSE = EQUITY_CANDIDATES

const OPERATING_ONLY = {
  ETN: { symbol: "ETN", yahoo: "ETN", group: "Industrial" },
  GEV: { symbol: "GEV", yahoo: "GEV", group: "Industrial" },
}

const DISPLAY_NAME = {
  ETN: "Eaton",
  GEV: "GE Vernova",
}

const CORE = new Set(CORE_UNIVERSE)
const WATCH = new Set(WATCH_UNIVERSE)

export function equityPriority(symbol) {
  if (CORE.has(symbol)) return "CORE"
  if (WATCH.has(symbol)) return "WATCH"
  return null
}

function studyRow(symbol) {
  return EQUITY_CANDIDATES.find((row) => row.symbol === symbol) || OPERATING_ONLY[symbol] || null
}

function present(symbol) {
  const meta = studyRow(symbol)
  if (!meta) return null
  return {
    symbol: meta.symbol,
    yahoo: meta.yahoo,
    group: meta.group,
    name: DISPLAY_NAME[meta.symbol] || meta.symbol,
    priority: equityPriority(meta.symbol),
  }
}

export function activeEquityMembers() {
  return ACTIVE_UNIVERSE.map((symbol) => present(symbol)).filter(Boolean)
}

export function futureWatchMembers() {
  return FUTURE_WATCH_UNIVERSE.map((symbol) => present(symbol)).filter(Boolean)
}

export function findOperatingCandidate(symbol) {
  const key = String(symbol || "").trim().toUpperCase()
  const listed = [...activeEquityMembers(), ...futureWatchMembers()]
  return listed.find((row) => row.symbol.toUpperCase() === key) || null
}
