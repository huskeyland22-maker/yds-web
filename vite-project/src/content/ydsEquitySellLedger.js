/**
 * Sells attached to the real equity/ETF buy ledger (`yds.tradeRecords.v1`).
 * Buys stay stored. A sell only records the facts the user entered.
 * Blank fee or tax stays blank and is not treated as a confirmed zero.
 */

import {
  listTradeRecords,
  normalizeEquitySells,
  readTradeRecordsStore,
  writeTradeRecordsStore,
} from "./ydsTradeRecords.js"

/** @typedef {import("./ydsTradeRecords.js").TradeRecord} TradeRecord */
/** @typedef {import("./ydsTradeRecords.js").EquitySellRecord} EquitySellRecord */

/**
 * Same share figure the buy line already shows. Stored shares win.
 * Amount ÷ price is used only when that is how the buy was saved.
 * @param {Partial<TradeRecord> | null | undefined} record
 * @returns {number | null}
 */
export function recordedShareCount(record) {
  const direct = Number(record?.shares)
  if (Number.isFinite(direct) && direct > 0) return direct
  const price = Number(record?.buyPrice)
  const amount = Number(record?.buyAmountUsd)
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(amount) || amount <= 0) return null
  const computed = amount / price
  if (!Number.isFinite(computed) || computed <= 0) return null
  return Math.abs(computed - Math.round(computed)) < 1e-6
    ? Math.round(computed)
    : Math.round(computed * 1e6) / 1e6
}

/**
 * @param {'dbb' | 'panic'} system
 * @param {string} symbol
 * @returns {EquitySellRecord[]}
 */
export function listEquitySells(system, symbol) {
  const sys = system === "panic" ? "panic" : "dbb"
  const sym = String(symbol || "").trim().toUpperCase()
  return readTradeRecordsStore().sells.filter((row) => row.system === sys && row.symbol === sym)
}

/**
 * @param {TradeRecord[]} buys
 * @param {EquitySellRecord[]} sells
 */
export function replayEquityPosition(buys, sells) {
  const lots = (Array.isArray(buys) ? buys : [])
    .map((row) => ({
      id: row.id,
      date: row.buyDate,
      price: Number(row.buyPrice),
      qty: recordedShareCount(row) || 0,
      createdAt: row.createdAt || row.buyDate,
    }))
    .filter((lot) => lot.qty > 0 && lot.price > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.createdAt).localeCompare(String(b.createdAt)))

  /** @type {Array<EquitySellRecord & { proceeds: number, cost: number, realizedPnl: number, returnPct: number | null, filledShares: number, fullClose: boolean, links: { buyId: string, buyDate: string, shares: number, buyPrice: number }[], chargesKnown: boolean }>} */
  const settlements = []
  const ordered = (Array.isArray(sells) ? sells : []).slice().sort(
    (a, b) => a.sellDate.localeCompare(b.sellDate) || String(a.createdAt).localeCompare(String(b.createdAt)),
  )

  for (const sell of ordered) {
    let left = Number(sell.shares) || 0
    let cost = 0
    let filled = 0
    /** @type {{ buyId: string, buyDate: string, shares: number, buyPrice: number }[]} */
    const links = []
    while (left > 1e-8 && lots.length && lots[0].date <= sell.sellDate) {
      const take = Math.min(left, lots[0].qty)
      cost += take * lots[0].price
      filled += take
      links.push({ buyId: lots[0].id, buyDate: lots[0].date, shares: take, buyPrice: lots[0].price })
      lots[0].qty -= take
      left -= take
      if (lots[0].qty <= 1e-8) lots.shift()
    }
    if (filled <= 1e-8) continue
    const fee = sell.feeUsd == null ? 0 : sell.feeUsd
    const tax = sell.taxUsd == null ? 0 : sell.taxUsd
    const proceeds = filled * sell.sellPrice
    const realizedPnl = proceeds - cost - fee - tax
    settlements.push({
      ...sell,
      proceeds,
      cost,
      realizedPnl,
      returnPct: cost > 0 ? (realizedPnl / cost) * 100 : null,
      filledShares: filled,
      fullClose: false,
      links,
      chargesKnown: sell.feeUsd != null && sell.taxUsd != null,
    })
  }

  const openShares = lots.reduce((sum, lot) => sum + lot.qty, 0)
  const openCost = lots.reduce((sum, lot) => sum + lot.qty * lot.price, 0)
  if (settlements.length) {
    settlements[settlements.length - 1].fullClose = openShares <= 1e-8
  }
  return {
    openShares,
    openCost,
    avgPrice: openShares > 1e-8 ? openCost / openShares : null,
    realizedPnl: settlements.reduce((sum, row) => sum + row.realizedPnl, 0),
    settlements,
  }
}

/**
 * @param {'dbb' | 'panic'} system
 * @param {string} symbol
 */
export function equityPosition(system, symbol) {
  return replayEquityPosition(listTradeRecords(system, symbol), listEquitySells(system, symbol))
}

/**
 * @param {EquitySellRecord[]} sells
 * @param {{ symbol: string, sellDate: string, sellPrice: number, shares: number, feeUsd: number | null, taxUsd: number | null }} input
 */
function isDuplicateSell(sells, input) {
  return sells.some(
    (row) =>
      row.symbol === input.symbol &&
      row.sellDate === input.sellDate &&
      Math.abs(row.shares - input.shares) < 1e-8 &&
      Math.abs(row.sellPrice - input.sellPrice) < 1e-8 &&
      row.feeUsd === input.feeUsd &&
      row.taxUsd === input.taxUsd,
  )
}

/**
 * @param {'dbb' | 'panic'} system
 * @param {string} symbol
 * @param {{ sellDate?: string, sellPrice?: number | string, shares?: number | string, feeUsd?: number | string | null, taxUsd?: number | string | null, memo?: string }} input
 */
export function previewEquitySell(system, symbol, input) {
  const sym = String(symbol || "").trim().toUpperCase()
  const sellDate = typeof input?.sellDate === "string" ? input.sellDate : ""
  const sellPrice = Number(input?.sellPrice)
  const shares = Number(input?.shares)
  const feeUsd = input?.feeUsd == null || input.feeUsd === "" ? null : Number(input.feeUsd)
  const taxUsd = input?.taxUsd == null || input.taxUsd === "" ? null : Number(input.taxUsd)
  if (!sym) return { ok: false, message: "종목을 선택하세요." }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sellDate)) return { ok: false, message: "매도일을 입력하세요." }
  if (!(sellPrice > 0) || !(shares > 0)) return { ok: false, message: "매도가와 매도수량을 입력하세요." }
  if (feeUsd != null && (!(feeUsd >= 0) || !Number.isFinite(feeUsd))) {
    return { ok: false, message: "수수료는 확인된 금액만 입력하세요." }
  }
  if (taxUsd != null && (!(taxUsd >= 0) || !Number.isFinite(taxUsd))) {
    return { ok: false, message: "세금은 확인된 금액만 입력하세요." }
  }

  const buys = listTradeRecords(system, sym)
  if (!buys.length) return { ok: false, message: "이 종목의 매수 기록이 없습니다." }
  const existing = listEquitySells(system, sym)
  const position = replayEquityPosition(buys, existing)
  if (!(position.openShares > 1e-8)) return { ok: false, message: "남은 보유 수량이 없습니다." }
  if (shares - position.openShares > 1e-8) {
    return { ok: false, message: `매도수량은 남은 ${position.openShares}주를 넘을 수 없습니다.` }
  }
  const draft = {
    symbol: sym,
    sellDate,
    sellPrice,
    shares,
    feeUsd,
    taxUsd,
  }
  if (isDuplicateSell(existing, draft)) {
    return { ok: false, message: "같은 매도 기록이 이미 있습니다." }
  }
  const next = replayEquityPosition(buys, [
    ...existing,
    {
      id: "preview",
      system: system === "panic" ? "panic" : "dbb",
      symbol: sym,
      sellDate,
      sellPrice,
      shares,
      feeUsd,
      taxUsd,
      memo: "",
      createdAt: "9999-12-31T00:00:00.000Z",
      updatedAt: "9999-12-31T00:00:00.000Z",
    },
  ])
  const saved = next.settlements.find((row) => row.id === "preview")
  if (!saved || Math.abs(saved.filledShares - shares) > 1e-6) {
    return { ok: false, message: "매도일 이전에 그 수량만큼 보유하지 않았습니다." }
  }
  return { ok: true, message: "", openShares: position.openShares, preview: saved }
}

/**
 * @param {'dbb' | 'panic'} system
 * @param {string} symbol
 * @param {{ sellDate?: string, sellPrice?: number | string, shares?: number | string, feeUsd?: number | string | null, taxUsd?: number | string | null, memo?: string }} input
 */
export function addEquitySell(system, symbol, input) {
  const check = previewEquitySell(system, symbol, input)
  if (!check.ok || !check.preview) return { ok: false, message: check.message, sell: null }
  const now = new Date().toISOString()
  const store = readTradeRecordsStore()
  const sell = {
    id: `ts_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    system: system === "panic" ? "panic" : "dbb",
    symbol: String(symbol || "").trim().toUpperCase(),
    sellDate: check.preview.sellDate,
    sellPrice: check.preview.sellPrice,
    shares: check.preview.shares,
    feeUsd: check.preview.feeUsd,
    taxUsd: check.preview.taxUsd,
    memo: String(input?.memo ?? "").trim(),
    createdAt: now,
    updatedAt: now,
  }
  store.sells = normalizeEquitySells([...(store.sells || []), sell], store.deletedSellIds)
  writeTradeRecordsStore(store)
  scheduleOperatingCloudPush()
  return { ok: true, message: "", sell }
}

/**
 * Remove one sell. The buy rows stay.
 * @param {string} id
 */
export function cancelEquitySell(id) {
  const sellId = String(id || "").trim()
  if (!sellId) return false
  const store = readTradeRecordsStore()
  if (!store.sells.some((row) => row.id === sellId)) return false
  store.sells = store.sells.filter((row) => row.id !== sellId)
  store.deletedSellIds = [...new Set([...(store.deletedSellIds || []), sellId])]
  writeTradeRecordsStore(store)
  scheduleOperatingCloudPush()
  return true
}

function scheduleOperatingCloudPush() {
  void import("./ydsTradeRecordsCloudSync.js")
    .then((mod) => mod.scheduleTradeRecordsCloudPush())
    .catch(() => {})
}
