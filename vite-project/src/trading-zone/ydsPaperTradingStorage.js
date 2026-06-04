import { getTradingZonePositions } from "./tacticalTradingZoneData.js"
import { computeReturnPct } from "./ydsPrecursorTradingJournalStorage.js"
import { STOCK_RADAR_UNIVERSE } from "./ydsPrecursorEnginePhase26.js"

export const PAPER_TRADING_STORAGE_KEY = "yds-paper-trading-v1"

/** @typedef {'OPEN' | 'CLOSED'} PaperPositionStatus */
/** @typedef {'A' | 'B'} PaperEntryGrade */

/**
 * @typedef {{
 *   id: string
 *   name: string
 *   symbol: string
 *   code?: string | null
 *   createdAt: string
 *   entryDate: string
 *   entryPrice: number
 *   currentPrice: number
 *   exitPrice?: number | null
 *   returnPct: number | null
 *   status: PaperPositionStatus
 *   entryGrade: PaperEntryGrade
 *   candidateId: string
 *   source: string
 *   maxProfitPct: number
 *   maxLossPct: number
 *   currentProfitPct: number | null
 *   holdingDays: number
 *   closedAt?: string | null
 *   lastPriceAt?: string
 *   sectorKey?: string
 * }} PaperPositionRow
 */

function uid() {
  return `pt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function num(v) {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/,/g, ""))
  return Number.isFinite(n) ? n : null
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * @param {string} from
 * @param {string} [to]
 */
export function computeHoldingDays(from, to = todayIso()) {
  const a = Date.parse(from)
  const b = Date.parse(to)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.max(0, Math.round((b - a) / 86400000))
}

function emptyState() {
  return {
    version: 1,
    includeGradeB: false,
    positions: /** @type {PaperPositionRow[]} */ ([]),
  }
}

export function loadPaperTrading() {
  if (typeof window === "undefined") return emptyState()
  try {
    const raw = window.localStorage.getItem(PAPER_TRADING_STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw)
    return {
      ...emptyState(),
      includeGradeB: Boolean(parsed.includeGradeB),
      positions: Array.isArray(parsed.positions) ? parsed.positions : [],
    }
  } catch {
    return emptyState()
  }
}

/** @param {ReturnType<typeof loadPaperTrading>} state */
export function savePaperTrading(state) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(
    PAPER_TRADING_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      includeGradeB: Boolean(state.includeGradeB),
      positions: (state.positions ?? []).slice(0, 300),
    }),
  )
}

/**
 * @param {{ id: string; name: string; symbol: string; code?: string | null }} candidate
 */
function findTradingZonePosition(candidate) {
  const positions = getTradingZonePositions()
  return (
    positions.find((p) => p.id === candidate.id) ??
    positions.find((p) => p.symbol === candidate.name) ??
    positions.find((p) => p.symbol === candidate.symbol) ??
    null
  )
}

/**
 * @param {{ id: string; name: string; symbol: string; code?: string | null }} candidate
 */
export function resolvePaperEntryPrices(candidate) {
  if (candidate.id === "kr-silicon") {
    return { entryPrice: 42000, currentPrice: 48500 }
  }

  const pos = findTradingZonePosition(candidate)
  if (!pos) return { entryPrice: null, currentPrice: null }

  let entryPrice = num(pos.currentPrice)
  if (pos.stopNum != null && pos.targetNum != null) {
    entryPrice = Math.round((pos.stopNum + pos.targetNum) / 2)
  } else if (typeof pos.entry === "string") {
    const parts = pos.entry.match(/[\d,]+/g)?.map((s) => num(s.replace(/,/g, ""))) ?? []
    const finite = parts.filter((n) => n != null)
    if (finite.length >= 2) entryPrice = Math.round((finite[0] + finite[1]) / 2)
    else if (finite[0] != null) entryPrice = finite[0]
  }

  const currentPrice = num(pos.currentPrice) ?? entryPrice
  if (entryPrice == null) return { entryPrice: null, currentPrice: null }
  return { entryPrice, currentPrice: currentPrice ?? entryPrice }
}

/**
 * @param {{ id?: string; sectorRadarId?: string; filterTags?: string[] }} candidate
 */
export function resolvePerformanceSectorKey(candidate) {
  const def = STOCK_RADAR_UNIVERSE.find((u) => u.id === candidate.id)
  const tags = def?.filterTags ?? candidate.filterTags ?? []
  const sectorRadarId = candidate.sectorRadarId ?? def?.sectorRadarId
  if (tags.includes("cosmetics")) return "cosmetics"
  if (tags.includes("robot")) return "robot"
  if (sectorRadarId === "physicalAi") return "ai"
  if (sectorRadarId === "power") return "power"
  if (sectorRadarId === "defense") return "defense"
  if (sectorRadarId === "semi") return "semi"
  return "semi"
}

/**
 * @param {PaperPositionRow} row
 */
export function inferPaperPositionSectorKey(row) {
  if (row.sectorKey) return row.sectorKey
  return resolvePerformanceSectorKey({
    id: row.candidateId,
    sectorRadarId: undefined,
    filterTags: undefined,
  })
}

/**
 * @param {PaperPositionRow} row
 * @param {number | null} markPrice
 */
function applyPriceMark(row, markPrice) {
  if (markPrice == null || !Number.isFinite(markPrice)) return row
  const ret = computeReturnPct(row.entryPrice, markPrice) ?? 0
  const maxProfitPct = Math.max(row.maxProfitPct ?? ret, ret)
  const maxLossPct = Math.min(row.maxLossPct ?? ret, ret)
  const endDate = row.status === "CLOSED" ? row.closedAt ?? row.entryDate : todayIso()

  return {
    ...row,
    currentPrice: row.status === "OPEN" ? markPrice : (row.exitPrice ?? markPrice),
    returnPct: row.status === "CLOSED" ? row.returnPct : ret,
    maxProfitPct,
    maxLossPct,
    currentProfitPct: row.status === "CLOSED" ? row.returnPct : ret,
    holdingDays: computeHoldingDays(row.entryDate, endDate),
    lastPriceAt: todayIso(),
  }
}

/**
 * @param {ReturnType<typeof loadPaperTrading>} state
 */
export function refreshPaperTradingPrices(state) {
  const positions = state.positions.map((row) => {
    if (row.status === "CLOSED") return row
    const live = resolvePaperEntryPrices({
      id: row.candidateId,
      name: row.name,
      symbol: row.symbol,
      code: row.code,
    })
    return applyPriceMark(row, live.currentPrice)
  })
  return { ...state, positions }
}

/**
 * @param {ReturnType<typeof import("./ydsPrecursorEnginePhase27.js").buildEntryRadarFromPrecursorContext>} entryRadar
 * @param {{ includeGradeB?: boolean }} [options]
 */
export function syncPaperTradesFromEntryRadar(entryRadar, options = {}) {
  const includeGradeB = options.includeGradeB ?? loadPaperTrading().includeGradeB
  let state = loadPaperTrading()
  state.includeGradeB = includeGradeB
  state = refreshPaperTradingPrices(state)

  const today = todayIso()
  /** @type {string[]} */
  const created = []
  /** @type {string[]} */
  const skipped = []

  for (const c of entryRadar.tradeCandidates ?? []) {
    const grade = c.grade?.id
    if (grade !== "A" && grade !== "B") continue
    if (grade === "B" && !includeGradeB) {
      skipped.push(`${c.name}(B·미선택)`)
      continue
    }

    const hasOpen = state.positions.some(
      (p) => p.status === "OPEN" && p.candidateId === c.id,
    )
    if (hasOpen) {
      skipped.push(`${c.name}(보유중)`)
      continue
    }

    const prices = resolvePaperEntryPrices(c)
    if (prices.entryPrice == null || prices.currentPrice == null) {
      skipped.push(`${c.name}(가격없음)`)
      continue
    }

    const ret = computeReturnPct(prices.entryPrice, prices.currentPrice) ?? 0
    /** @type {PaperPositionRow} */
    const row = {
      id: uid(),
      name: c.name,
      symbol: c.symbol,
      code: c.code ?? null,
      createdAt: today,
      entryDate: today,
      entryPrice: prices.entryPrice,
      currentPrice: prices.currentPrice,
      returnPct: ret,
      status: "OPEN",
      entryGrade: /** @type {PaperEntryGrade} */ (grade),
      candidateId: c.id,
      sectorKey: resolvePerformanceSectorKey({
        id: c.id,
        sectorRadarId: c.sectorRadarId,
      }),
      source: grade === "A" ? "entry-radar-auto-a" : "entry-radar-opt-b",
      maxProfitPct: ret,
      maxLossPct: ret,
      currentProfitPct: ret,
      holdingDays: 0,
      lastPriceAt: today,
    }
    state.positions = [row, ...state.positions]
    created.push(c.name)
  }

  savePaperTrading(state)
  return { state, created, skipped, includeGradeB }
}

/**
 * @param {string} id
 * @param {{ exitPrice?: number | null }} [options]
 */
export function closePaperPosition(id, options = {}) {
  const state = loadPaperTrading()
  const today = todayIso()
  const positions = state.positions.map((row) => {
    if (row.id !== id || row.status !== "OPEN") return row
    const exit =
      options.exitPrice != null
        ? options.exitPrice
        : resolvePaperEntryPrices({
            id: row.candidateId,
            name: row.name,
            symbol: row.symbol,
            code: row.code,
          }).currentPrice ?? row.currentPrice
    const ret = computeReturnPct(row.entryPrice, exit)
    return applyPriceMark(
      {
        ...row,
        status: "CLOSED",
        exitPrice: exit,
        returnPct: ret,
        closedAt: today,
      },
      exit,
    )
  })
  const next = { ...state, positions }
  savePaperTrading(next)
  return next
}

/** @param {string} id */
export function deletePaperPosition(id) {
  const state = loadPaperTrading()
  const next = { ...state, positions: state.positions.filter((p) => p.id !== id) }
  savePaperTrading(next)
  return next
}

/** @param {boolean} includeGradeB */
export function setPaperTradingIncludeGradeB(includeGradeB) {
  const state = loadPaperTrading()
  const next = { ...state, includeGradeB }
  savePaperTrading(next)
  return next
}
