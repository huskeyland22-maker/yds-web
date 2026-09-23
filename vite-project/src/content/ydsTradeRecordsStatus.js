/**
 * Display helpers for manual trade records + live signal context.
 * Does not change DBB / Panic signal engines.
 */

import { resolvePanicBottomDcaSignal } from "../utils/panicBottomDcaSignal.js"
import {
  averageTradeBuyPrice,
  daysBetweenDayKeys,
  earliestTradeBuyDate,
  sumTradeWeightPct,
  tradeReturnPct,
} from "./ydsTradeRecords.js"

/**
 * @param {{
 *   count?: number
 *   stage?: { id?: string, label?: string, splitHint?: string } | null
 *   close?: number | null
 *   asOfDate?: string | null
 * }} card
 * @param {import('./ydsTradeRecords.js').TradeRecord[]} records
 * @param {string} [asOfDate]
 */
export function buildDbbTradeStatusView(card, records, asOfDate) {
  const list = Array.isArray(records) ? records : []
  const count = Number(card?.count) || 0
  const stageLabel = card?.stage?.label || (count >= 4 ? "강한 저점" : count >= 3 ? "1차 매수" : count >= 2 ? "관심" : "대기")
  const recordedWeight = sumTradeWeightPct(list)
  const avgPrice = averageTradeBuyPrice(list)
  const currentPrice =
    card?.close != null && Number.isFinite(Number(card.close)) ? Number(card.close) : null
  const pnlPct = tradeReturnPct(avgPrice, currentPrice)
  const asOf =
    (typeof asOfDate === "string" && asOfDate) ||
    (typeof card?.asOfDate === "string" && card.asOfDate) ||
    new Date().toISOString().slice(0, 10)
  const firstBuy = earliestTradeBuyDate(list)
  const daysSince = daysBetweenDayKeys(firstBuy, asOf)

  let userStageNote = ""
  let nextStep = ""
  if (list.length > 0 && count >= 3 && recordedWeight > 0) {
    userStageNote = count >= 4 && recordedWeight >= 50 ? "1차 매수 완료" : recordedWeight > 0 ? "1차 매수 완료" : ""
  }
  if (count >= 4) {
    nextStep = "추가 50% 매수 검토"
  } else if (count === 3) {
    nextStep = recordedWeight > 0 ? "4/4 추가 매수 후보 대기" : "1차 매수 후보 (50%)"
  } else if (count === 2) {
    nextStep = "아직 매수 단계 아님"
  } else {
    nextStep = "대기"
  }

  return {
    system: /** @type {'dbb'} */ ("dbb"),
    hasRecords: list.length > 0,
    signalLabel: `${count}/4`,
    stageLabel,
    userStageNote,
    recordedWeightPct: recordedWeight,
    nextStep,
    currentPrice,
    avgBuyPrice: avgPrice,
    returnPct: pnlPct,
    daysSinceBuy: daysSince,
    recordCount: list.length,
  }
}

/**
 * @param {number | null | undefined} panicScore
 * @param {import('./ydsTradeRecords.js').TradeRecord[]} records
 * @param {{ currentPrice?: number | null, asOfDate?: string | null }} [opts]
 */
export function buildPanicTradeStatusView(panicScore, records, opts = {}) {
  const list = Array.isArray(records) ? records : []
  const dca = resolvePanicBottomDcaSignal(panicScore)
  const recordedWeight = sumTradeWeightPct(list)
  const avgPrice = averageTradeBuyPrice(list)
  const currentPrice =
    opts.currentPrice != null && Number.isFinite(Number(opts.currentPrice))
      ? Number(opts.currentPrice)
      : null
  const pnlPct = tradeReturnPct(avgPrice, currentPrice)
  const asOf =
    (typeof opts.asOfDate === "string" && opts.asOfDate) ||
    new Date().toISOString().slice(0, 10)
  const firstBuy = earliestTradeBuyDate(list)
  const daysSince = daysBetweenDayKeys(firstBuy, asOf)

  let nextStep = "매수 대기"
  if (dca) {
    if (dca.stage === 0) nextStep = "매수 대기"
    else if (dca.stage === 1) nextStep = recordedWeight >= 40 ? "2차(27%) 구간 대기" : "1차 매수 구간 (40%)"
    else if (dca.stage === 2) nextStep = recordedWeight >= 67 ? "3차(33%) 구간 대기" : "2차 추가 투입 (27%)"
    else nextStep = recordedWeight >= 100 ? "분할 완료 참고" : "3차 추가 투입 (33%)"
  }

  return {
    system: /** @type {'panic'} */ ("panic"),
    hasRecords: list.length > 0,
    signalLabel: panicScore != null && Number.isFinite(Number(panicScore)) ? String(Math.round(Number(panicScore))) : "—",
    stageLabel: dca?.bandLabel || "—",
    userStageNote: recordedWeight > 0 ? `기록 비중 ${round1(recordedWeight)}%` : "",
    recordedWeightPct: recordedWeight,
    nextStep,
    currentPrice,
    avgBuyPrice: avgPrice,
    returnPct: pnlPct,
    daysSinceBuy: daysSince,
    recordCount: list.length,
    dcaAddPct: dca?.addPct ?? null,
    dcaCumulativePct: dca?.cumulativePct ?? null,
  }
}

/** @param {number} n */
function round1(n) {
  return Math.round(Number(n) * 10) / 10
}
