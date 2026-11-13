/**
 * Sell performance derived from the existing portfolio trade ledger.
 * One saved sell that closes quantity is one closed trade.
 * Open holdings are not counted, and one sell is not split into several wins.
 */

import { replayPortfolioFifoFromTrades } from "./ydsPortfolioFifoEngine.js"
import { normalizePositionName } from "./ydsPortfolioTradeSync.js"

/** @typedef {import("./ydsPortfolioTradesStorage.js").PortfolioTrade} PortfolioTrade */
/** @typedef {import("./ydsPortfolioFifoEngine.js").SellSettlement} SellSettlement */

/**
 * @param {PortfolioTrade[]} trades
 * @param {string} name
 */
export function openQuantityForName(trades, name) {
  const key = normalizePositionName(name)
  if (!key) return 0
  const { lots } = replayPortfolioFifoFromTrades(trades)
  const lot = lots.find((row) => normalizePositionName(row.name) === key)
  return lot ? Number(lot.quantity) || 0 : 0
}

/**
 * @param {number | null | undefined} a
 * @param {number | null | undefined} b
 */
function sameNumber(a, b) {
  return Math.abs((Number(a) || 0) - (Number(b) || 0)) < 1e-9
}

/**
 * Same ticker, date, quantity, price, fee, and tax.
 * @param {PortfolioTrade[]} trades
 * @param {{ name?: string, ticker?: string, date?: string, quantity?: number, unitPrice?: number, fee?: number, tax?: number }} input
 */
export function isDuplicateSell(trades, input) {
  const ticker = String(input.ticker ?? "").trim().toUpperCase()
  const name = normalizePositionName(input.name)
  const fee = Math.max(0, Number(input.fee) || 0)
  const tax = Math.max(0, Number(input.tax) || 0)
  return (Array.isArray(trades) ? trades : []).some((trade) => {
    if (!trade || trade.action !== "sell") return false
    const sameInstrument = ticker
      ? String(trade.ticker ?? "").trim().toUpperCase() === ticker
      : normalizePositionName(trade.name) === name
    return (
      sameInstrument &&
      trade.date === input.date &&
      sameNumber(trade.quantity, input.quantity) &&
      sameNumber(trade.unitPrice, input.unitPrice) &&
      sameNumber(trade.fee, fee) &&
      sameNumber(trade.tax, tax)
    )
  })
}

/**
 * @param {PortfolioTrade[]} trades
 * @param {{
 *   name?: string
 *   ticker?: string
 *   country?: 'us' | 'kr'
 *   date?: string
 *   quantity?: number
 *   unitPrice?: number
 *   fee?: number
 *   tax?: number
 *   fxRate?: number | null
 *   memo?: string
 * }} input
 * @param {number | null | undefined} [usdkrw]
 */
export function previewSell(trades, input, usdkrw) {
  const name = String(input?.name ?? "").trim()
  const qty = Number(input?.quantity)
  const price = Number(input?.unitPrice)
  const fee = Math.max(0, Number(input?.fee) || 0)
  const tax = Math.max(0, Number(input?.tax) || 0)
  if (!name) return { ok: false, message: "종목을 선택하세요." }
  if (!(qty > 0) || !(price > 0)) return { ok: false, message: "매도수량과 매도가를 입력하세요." }
  if (Number(input?.fee) < 0 || Number(input?.tax) < 0) return { ok: false, message: "수수료와 세금은 0 이상이어야 합니다." }

  const openQty = openQuantityForName(trades, name)
  if (!(openQty > 0)) return { ok: false, message: "보유 수량이 없습니다." }
  if (qty - openQty > 1e-9) {
    return { ok: false, message: `매도수량은 보유 ${openQty}주를 넘을 수 없습니다.` }
  }
  if (isDuplicateSell(trades, { ...input, name, quantity: qty, unitPrice: price, fee, tax })) {
    return { ok: false, message: "같은 날짜·수량·가격의 매도 기록이 이미 있습니다." }
  }

  const draft = {
    id: "yds-sell-preview",
    date: input.date || "9999-12-31",
    action: "sell",
    name,
    ticker: String(input.ticker ?? "").trim(),
    country: input.country === "kr" ? "kr" : "us",
    quantity: qty,
    unitPrice: price,
    amount: null,
    fee,
    tax,
    fxRate: Number(input.fxRate) > 0 ? Number(input.fxRate) : undefined,
    memo: String(input.memo ?? ""),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  const { settlements } = replayPortfolioFifoFromTrades([...(trades ?? []), draft], usdkrw)
  const preview = settlements.find((row) => row.id === draft.id)
  if (!preview || Math.abs(preview.quantity - qty) > 1e-6) {
    return { ok: false, message: "선택한 매도일에는 그 수량을 매도할 수 없습니다." }
  }
  return { ok: true, message: "", openQty, preview }
}

/**
 * @param {SellSettlement[]} rows
 * @param {(row: SellSettlement) => string} keyOf
 */
function groupBy(rows, keyOf) {
  /** @type {Map<string, SellSettlement[]>} */
  const map = new Map()
  for (const row of rows) {
    const key = keyOf(row)
    const list = map.get(key)
    if (list) list.push(row)
    else map.set(key, [row])
  }
  return [...map.entries()].map(([key, list]) => summarizeGroup(key, list))
}

/**
 * @param {string} key
 * @param {SellSettlement[]} list
 */
function summarizeGroup(key, list) {
  const convertible = list.filter((row) => row.realizedKrw != null && row.costKrw != null)
  const realizedKrw = convertible.reduce((sum, row) => sum + row.realizedKrw, 0)
  const costKrw = convertible.reduce((sum, row) => sum + row.costKrw, 0)
  const currencies = new Set(list.map((row) => row.currency))
  const realizedLocal = currencies.size === 1 ? list.reduce((sum, row) => sum + row.realizedLocal, 0) : null
  const costLocal = currencies.size === 1 ? list.reduce((sum, row) => sum + row.cost, 0) : null
  return {
    key,
    name: list[0]?.name ?? key,
    ticker: list[0]?.ticker ?? "",
    currency: currencies.size === 1 ? list[0].currency : "혼합",
    sellCount: list.length,
    winCount: list.filter((row) => row.realizedLocal > 0).length,
    realizedLocal,
    costLocal,
    returnPct: costLocal != null && costLocal > 0 ? Math.round((realizedLocal / costLocal) * 1000) / 10 : null,
    realizedKrw: convertible.length ? realizedKrw : null,
    costKrw: convertible.length ? costKrw : null,
    missingFx: list.some((row) => row.currency === "USD" && row.realizedKrw == null),
  }
}

/**
 * @param {PortfolioTrade[]} trades
 * @param {number | null | undefined} [usdkrw]
 */
export function buildSellPerformanceReport(trades, usdkrw) {
  const { settlements } = replayPortfolioFifoFromTrades(trades, usdkrw)
  const closed = settlements.length
  const winCount = settlements.filter((row) => row.realizedLocal > 0).length
  const lossCount = settlements.filter((row) => row.realizedLocal < 0).length
  const returns = settlements.map((row) => row.returnPct).filter((value) => value != null)
  const missingFxCount = settlements.filter((row) => row.currency === "USD" && row.realizedKrw == null).length
  const krwRows = settlements.filter((row) => row.realizedKrw != null && row.costKrw != null)
  const realizedKrw = krwRows.reduce((sum, row) => sum + row.realizedKrw, 0)
  const costKrw = krwRows.reduce((sum, row) => sum + row.costKrw, 0)

  const bySymbol = groupBy(settlements, (row) => normalizePositionName(row.name) || row.ticker || row.name)
    .sort((a, b) => (b.realizedKrw ?? b.realizedLocal ?? 0) - (a.realizedKrw ?? a.realizedLocal ?? 0))
  const ranked = bySymbol.filter((row) => row.returnPct != null)
  const winners = [...ranked].filter((row) => row.returnPct > 0).sort((a, b) => b.returnPct - a.returnPct).slice(0, 5)
  const losers = [...ranked].filter((row) => row.returnPct < 0).sort((a, b) => a.returnPct - b.returnPct).slice(0, 5)
  const byMonth = groupBy(settlements, (row) => (row.date || "").slice(0, 7) || "날짜 없음")
  const byYear = groupBy(settlements, (row) => (row.date || "").slice(0, 4) || "날짜 없음")
  const recent = [...settlements].reverse().slice(0, 8)

  return {
    settlements,
    closedCount: closed,
    winCount,
    lossCount,
    winRate: closed > 0 ? Math.round((winCount / closed) * 1000) / 10 : null,
    avgReturnPct: returns.length
      ? Math.round((returns.reduce((sum, value) => sum + value, 0) / returns.length) * 10) / 10
      : null,
    realizedKrw,
    costKrw,
    cumulativeReturnPct: costKrw > 0 ? Math.round((realizedKrw / costKrw) * 1000) / 10 : null,
    missingFxCount,
    bySymbol,
    byMonth,
    byYear,
    winners,
    losers,
    recent,
    winRateBasis: "sell-record",
  }
}
