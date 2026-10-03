/**
 * Read-only individual-stock Daily Bottom Buy view.
 * Score uses the frozen 4 conditions. ATR is a label only.
 * Not an order, not a weight, not the ETF production engine.
 */

import { enrichBarsWithIndicators } from "./daily-bottom-indicators.mjs"
import { conditionFlags } from "./daily-bottom-buy-validation-core.mjs"
import { FROZEN_THRESHOLDS } from "./daily-bottom-split-buy-sim.mjs"
import {
  EQUITY_CANDIDATES,
  attachObservationFeatures,
} from "./daily-bottom-buy-cross-asset-validation.mjs"
import { atrBand } from "./daily-bottom-buy-individual-stock-train-test-validation.mjs"
import { drawdownFromRollingHigh } from "./daily-bottom-buy-correction-stage-validation.mjs"
import {
  ACTIVE_UNIVERSE,
  CORE_UNIVERSE,
  FUTURE_WATCH_UNIVERSE,
  LEGACY_UNIVERSE,
  RESEARCH_UNIVERSE,
  WATCH_UNIVERSE,
  activeEquityMembers,
  findOperatingCandidate,
} from "./equity-daily-bottom-buy-universe.mjs"

export { EQUITY_CANDIDATES, FROZEN_THRESHOLDS, atrBand, conditionFlags }
export {
  ACTIVE_UNIVERSE,
  CORE_UNIVERSE,
  WATCH_UNIVERSE,
  FUTURE_WATCH_UNIVERSE,
  LEGACY_UNIVERSE,
  RESEARCH_UNIVERSE,
}

export const EQUITY_DAILY_BOTTOM_BUY_ID = "equityDailyBottomBuy"
export const EQUITY_DAILY_BOTTOM_BUY_ROUTE = "/equity-daily-bottom-buy"

/** Labels for the existing study symbols. Not a second universe. */
const DISPLAY_NAME = {
  MSFT: "Microsoft",
  GOOGL: "Alphabet",
  AMZN: "Amazon",
  META: "Meta",
  AAPL: "Apple",
  ORCL: "Oracle",
  NVDA: "NVIDIA",
  AVGO: "Broadcom",
  TSM: "TSMC",
  AMD: "AMD",
  ASML: "ASML",
  MU: "Micron",
  AMAT: "Applied Materials",
  LRCX: "Lam Research",
  CRWD: "CrowdStrike",
  PANW: "Palo Alto Networks",
  ZS: "Zscaler",
  FTNT: "Fortinet",
  PLTR: "Palantir",
  CRM: "Salesforce",
  ADBE: "Adobe",
  LLY: "Eli Lilly",
  JNJ: "Johnson & Johnson",
  ABBV: "AbbVie",
  JPM: "JPMorgan",
  V: "Visa",
  MA: "Mastercard",
  "BRK.B": "Berkshire Hathaway",
  GE: "GE Aerospace",
  CAT: "Caterpillar",
  RTX: "RTX",
  HON: "Honeywell",
  TSLA: "Tesla",
  HD: "Home Depot",
  COST: "Costco",
  WMT: "Walmart",
  XOM: "Exxon Mobil",
  CVX: "Chevron",
  COP: "ConocoPhillips",
  NEE: "NextEra Energy",
  CEG: "Constellation Energy",
  VST: "Vistra",
  LIN: "Linde",
  FCX: "Freeport-McMoRan",
  SHW: "Sherwin-Williams",
  PLD: "Prologis",
  EQIX: "Equinix",
  AMT: "American Tower",
  ETN: "Eaton",
  GEV: "GE Vernova",
}

export const COMMON_NOTE = "저점 확정 신호는 아닙니다."
export const ATR_NOTE = "신호 이후 추가 변동성 위험을 참고하는 보조지표"
export const ATR_MEANING = "3/4 이후 추가 하락 변동성이 상대적으로 클 수 있는 구간"
export const DATA_MISSING = "데이터 준비 중"
export const DATA_SHORT = "지표 계산에 필요한 데이터가 부족합니다."

const ATR_LABEL = {
  lt3: "낮은 변동성",
  b3_4: "중간 변동성",
  ge4: "높은 변동성",
}

function roundTo(v, digits) {
  if (v == null || !Number.isFinite(Number(v))) return null
  return Number(Number(v).toFixed(digits))
}

export function scoreState(count) {
  if (count === 4) {
    return {
      id: "strongLow",
      label: "STRONG LOW CANDIDATE",
      detail: "강한 과매도 후보",
      reading: "4개 단기 조정 조건이 모두 충족된 강한 과매도 후보.",
    }
  }
  if (count === 3) {
    return {
      id: "firstBuy",
      label: "FIRST BUY CANDIDATE",
      detail: "1차 매수 검토 후보",
      reading: "단기 조정 조건이 4개 중 3개 충족. 1차 매수를 검토할 수 있는 후보 구간.",
    }
  }
  if (count === 2) {
    return {
      id: "interest",
      label: "INTEREST",
      detail: null,
      reading: "일부 조정 조건이 충족됨.",
    }
  }
  return {
    id: "wait",
    label: "WAIT",
    detail: null,
    reading: "현재 조정 매수 조건이 충분하지 않음.",
  }
}

export function atrRisk(atrPct) {
  const band = atrBand(atrPct)
  if (!band) return { band: null, label: null }
  return { band, label: ATR_LABEL[band] }
}

function withDisplayName(meta) {
  if (!meta) return null
  return { ...meta, name: DISPLAY_NAME[meta.symbol] || meta.name || meta.symbol }
}

/** Names the equity screen scans. Research code keeps EQUITY_CANDIDATES. */
export function equityUniverse() {
  return activeEquityMembers().map(withDisplayName)
}

/** Full 48-name study list, with the same display names as the screen catalog. */
export function researchEquityUniverse() {
  return EQUITY_CANDIDATES.map((meta) => withDisplayName(meta))
}

export function findEquityCandidate(symbol) {
  const meta = findOperatingCandidate(symbol)
  if (meta) return withDisplayName(meta)
  return null
}

function emptyView(meta, message) {
  return {
    ok: false,
    symbol: meta?.symbol ?? null,
    name: meta?.name ?? null,
    group: meta?.group ?? null,
    priority: meta?.priority ?? null,
    message,
    price: null,
    asOf: null,
    score: null,
    state: null,
    conditions: null,
    atrPct: null,
    atrRisk: null,
    dd120: null,
  }
}

/**
 * Latest bar only. Null indicators stay empty. No filled-in prices.
 * @param {{ symbol: string, yahoo?: string, group?: string, name?: string } | null} meta
 * @param {Array<{ date: string, open: number, high: number, low: number, close: number, volume?: number }> | null} bars
 * @param {{ source?: string }} [opts]
 */
export function buildEquityDailyBottomBuyView(meta, bars, opts = {}) {
  if (!meta?.symbol) return emptyView(null, DATA_MISSING)
  if (!Array.isArray(bars) || bars.length === 0) return emptyView(meta, DATA_MISSING)
  const enriched = attachObservationFeatures(enrichBarsWithIndicators(bars), null, null)
  const last = enriched[enriched.length - 1]
  const flags = conditionFlags(last, FROZEN_THRESHOLDS)
  const ready =
    last?.close > 0 &&
    last.rsi14 != null &&
    last.stochK != null &&
    last.bbPctB != null &&
    last.ma20DevPct != null &&
    last.atrPct != null
  if (!ready) return emptyView(meta, DATA_SHORT)

  const rsi = roundTo(last.rsi14, 2)
  const stoch = roundTo(last.stochK, 2)
  const bb = roundTo(last.bbPctB, 2)
  const ma = roundTo(last.ma20DevPct, 2)
  const atrPct = roundTo(last.atrPct, 2)
  const state = scoreState(flags.count)
  // Session high over the last 120 bars. The observation row's dd120 is a close peak and is not reused.
  const dd120 = roundTo(drawdownFromRollingHigh(bars, bars.length - 1, 120), 2)
  return {
    ok: true,
    symbol: meta.symbol,
    name: meta.name || DISPLAY_NAME[meta.symbol] || meta.symbol,
    group: meta.group ?? null,
    priority: meta.priority ?? null,
    message: null,
    price: roundTo(last.close, 2),
    asOf: last.date,
    source: opts.source || null,
    score: flags.count,
    state,
    note: COMMON_NOTE,
    conditions: [
      { id: "rsi", label: "RSI", value: rsi, thresholdText: "≤ 36", pass: flags.rsi },
      { id: "stoch", label: "Stoch %K", value: stoch, thresholdText: "≤ 15.4", pass: flags.stoch },
      { id: "bb", label: "BB %B", value: bb, thresholdText: "≤ 0.01", pass: flags.bb },
      { id: "ma20", label: "MA20 Gap", value: ma, thresholdText: "≤ -4.2%", pass: flags.ma, unit: "%" },
    ],
    atrPct,
    atrRisk: atrRisk(atrPct),
    dd120,
    atrNote: ATR_NOTE,
    atrMeaning: ATR_MEANING,
    readOnly: true,
  }
}
