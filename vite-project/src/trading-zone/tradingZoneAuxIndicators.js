/**
 * 실전 매매존 — 보조지표 상세 (10MA / 20MA / RSI / MACD / 거래량)
 */

import { TRADING_ZONE_STANDARD_AUX } from "./tacticalTradingZoneData.js"

/** @typedef {'10MA' | '20MA' | 'RSI' | 'MACD' | '거래량'} AuxIndicatorKey */

/** @typedef {'positive' | 'warn' | 'danger'} AuxStatusTone */

/**
 * @typedef {{
 *   key: AuxIndicatorKey
 *   title: string
 *   statusIcon: string
 *   statusTone: AuxStatusTone
 *   headlineText: string
 *   lines: { text: string }[]
 * }} AuxIndicatorDetail
 */

/** @type {Record<AuxStatusTone, string>} */
const AUX_STATUS_ICON = {
  positive: "🟢",
  warn: "🟡",
  danger: "🔴",
}

/**
 * @param {AuxStatusTone} tone
 */
function statusIconFor(tone) {
  return AUX_STATUS_ICON[tone] ?? AUX_STATUS_ICON.warn
}

/**
 * @param {AuxStatusTone} tone
 * @param {string} text
 */
function buildHeadline(tone, text) {
  return {
    statusIcon: statusIconFor(tone),
    statusTone: tone,
    headlineText: text,
  }
}

/**
 * @typedef {{
 *   ma10?: { trend: 'up' | 'down' | 'break'; above: boolean; distancePct: number }
 *   ma20?: { relation: 'support' | 'near' | 'break'; relationLabel?: string }
 *   rsi?: { value: number; band: 'overbought' | 'neutral' | 'oversold'; bandLabel?: string }
 *   macd?: { signal: 'golden' | 'dead' | 'neutral'; signalLabel?: string }
 *   volume?: { vsAvgPct: number; turnoverPct: number }
 * }} AuxIndicatorSeed
 */

/** @type {Record<string, Partial<Record<AuxIndicatorKey, AuxIndicatorSeed[keyof AuxIndicatorSeed]>>>} */
const POSITION_AUX_SEED = {
  "us-smh": {
    "10MA": { trend: "up", above: true, distancePct: 2.4 },
    "20MA": { relation: "support" },
    rsi: { value: 61, band: "neutral" },
    macd: { signal: "golden" },
    volume: { vsAvgPct: 28, turnoverPct: 15 },
  },
  "us-pltr": {
    "10MA": { trend: "up", above: true, distancePct: 2.4 },
    "20MA": { relation: "support" },
    rsi: { value: 58, band: "neutral" },
    macd: { signal: "golden" },
    volume: { vsAvgPct: 12, turnoverPct: 8 },
  },
  "us-nvda": {
    "10MA": { trend: "up", above: true, distancePct: 3.1 },
    "20MA": { relation: "support" },
    rsi: { value: 68, band: "neutral" },
    macd: { signal: "golden" },
    volume: { vsAvgPct: 22, turnoverPct: 19 },
  },
  "us-soxl": {
    "10MA": { trend: "down", above: false, distancePct: -1.2 },
    "20MA": { relation: "near" },
    rsi: { value: 46, band: "neutral" },
    macd: { signal: "neutral" },
    volume: { vsAvgPct: 18, turnoverPct: 11 },
  },
  "kr-silicon": {
    "10MA": { trend: "up", above: true, distancePct: 2.0 },
    "20MA": { relation: "support" },
    rsi: { value: 63, band: "neutral" },
    macd: { signal: "golden" },
    volume: { vsAvgPct: 35, turnoverPct: 22 },
  },
}

const MA10_TREND_LABEL = {
  up: "상향 유지",
  down: "하향",
  break: "이탈",
}

const MA20_RELATION_LABEL = {
  support: "지지",
  near: "근접",
  break: "이탈",
}

const RSI_BAND_LABEL = {
  overbought: "과매수",
  neutral: "중립",
  oversold: "과매도",
}

const MACD_SIGNAL_LABEL = {
  golden: "골든",
  dead: "데드",
  neutral: "중립",
}

/**
 * @param {import("./tacticalTradingZoneData.js").TradingZonePosition} position
 * @param {AuxIndicatorKey} key
 * @returns {AuxIndicatorSeed}
 */
function deriveAuxSeed(position, key) {
  const stage = position.stage
  const hash = String(position.id).length + String(position.symbol).length

  if (key === "10MA") {
    if (stage === "trend") return { trend: "up", above: true, distancePct: 2.2 + (hash % 5) * 0.3 }
    if (stage === "pullback") return { trend: "down", above: false, distancePct: -0.8 - (hash % 3) * 0.2 }
    if (stage === "takeProfit") return { trend: "break", above: false, distancePct: -2.1 }
    return { trend: "up", above: true, distancePct: 1.4 }
  }

  if (key === "20MA") {
    if (stage === "trend" || stage === "pullback") return { relation: "support" }
    if (stage === "takeProfit") return { relation: "break" }
    return { relation: "near" }
  }

  if (key === "RSI") {
    const value = stage === "trend" ? 62 + (hash % 8) : stage === "pullback" ? 44 + (hash % 6) : 52 + (hash % 10)
    const band = value >= 70 ? "overbought" : value <= 30 ? "oversold" : "neutral"
    return { value, band }
  }

  if (key === "MACD") {
    if (stage === "trend") return { signal: "golden" }
    if (stage === "risk" || stage === "takeProfit") return { signal: "dead" }
    return { signal: "neutral" }
  }

  const vsAvgPct = 10 + (hash % 7) * 4
  const turnoverPct = 6 + (hash % 5) * 3
  return { vsAvgPct, turnoverPct }
}

/**
 * @param {AuxIndicatorKey} key
 * @param {unknown} raw
 * @returns {AuxIndicatorDetail | null}
 */
function formatAuxDetail(key, raw) {
  if (!raw || typeof raw !== "object") return null

  if (key === "10MA") {
    const d = /** @type {NonNullable<AuxIndicatorSeed['ma10']>} */ (raw)
    const trend = d.trend ?? "up"
    const tone = trend === "up" ? "positive" : trend === "break" ? "danger" : "warn"
    const dist = d.distancePct ?? 0
    const distStr = `${dist >= 0 ? "+" : ""}${dist.toFixed(1)}%`
    return {
      key,
      title: "10MA",
      ...buildHeadline(tone, `10MA ${MA10_TREND_LABEL[trend]}`),
      lines: [
        { text: d.above !== false ? "현재가 > 10MA" : "현재가 < 10MA" },
        { text: `거리 ${distStr}` },
      ],
    }
  }

  if (key === "20MA") {
    const d = /** @type {NonNullable<AuxIndicatorSeed['ma20']>} */ (raw)
    const relation = d.relation ?? "near"
    const tone = relation === "break" ? "danger" : relation === "near" ? "warn" : "positive"
    const headlineText =
      relation === "break" ? "20MA 이탈" : relation === "near" ? "20MA 근접" : "20MA 상향"
    const lines =
      relation === "break"
        ? [{ text: "현재가 < 20MA" }, { text: "중기 추세 이탈" }]
        : relation === "near"
          ? [{ text: "현재가 ≈ 20MA" }, { text: "밴드 근접" }]
          : [{ text: "현재가 > 20MA" }, { text: "중기 추세 유지" }]
    return {
      key,
      title: "20MA",
      ...buildHeadline(tone, headlineText),
      lines,
    }
  }

  if (key === "RSI") {
    const d = /** @type {NonNullable<AuxIndicatorSeed['rsi']>} */ (raw)
    const value = d.value ?? 50
    const band = d.band ?? "neutral"
    const tone = band === "overbought" ? "danger" : band === "oversold" ? "positive" : "warn"
    const lines =
      band === "overbought"
        ? [{ text: "과열 구간" }, { text: "조정 주의" }]
        : band === "oversold"
          ? [{ text: "과매도 구간" }, { text: "반등 관찰" }]
          : [{ text: "중립~상승 구간" }, { text: "과열 아님" }]
    return {
      key,
      title: "RSI",
      ...buildHeadline(tone, `RSI ${value}`),
      lines,
    }
  }

  if (key === "MACD") {
    const d = /** @type {NonNullable<AuxIndicatorSeed['macd']>} */ (raw)
    const signal = d.signal ?? "neutral"
    const label = d.signalLabel ?? MACD_SIGNAL_LABEL[signal]
    const tone = signal === "golden" ? "positive" : signal === "dead" ? "danger" : "warn"
    const lines =
      signal === "golden"
        ? [{ text: "Signal > MACD" }, { text: "상승 모멘텀 유지" }]
        : signal === "dead"
          ? [{ text: "Signal < MACD" }, { text: "하락 모멘텀" }]
          : [{ text: "Signal ≈ MACD" }, { text: "중립 모멘텀" }]
    return {
      key,
      title: "MACD",
      ...buildHeadline(tone, `MACD ${label}`),
      lines,
    }
  }

  if (key === "거래량") {
    const d = /** @type {NonNullable<AuxIndicatorSeed['volume']>} */ (raw)
    const vs = d.vsAvgPct ?? 0
    const fmt = (n) => `${n >= 0 ? "+" : ""}${n}%`
    const tone = vs >= 8 ? "positive" : vs >= 0 ? "warn" : "danger"
    const lines =
      vs >= 0
        ? [{ text: "평균 대비 증가" }, { text: "수급 유입" }]
        : [{ text: "평균 대비 감소" }, { text: "수급 이탈" }]
    return {
      key,
      title: "거래량",
      ...buildHeadline(tone, `거래량 ${fmt(vs)}`),
      lines,
    }
  }

  return null
}

/**
 * @param {import("./tacticalTradingZoneData.js").TradingZonePosition} position
 * @param {string} key
 * @returns {AuxIndicatorDetail | null}
 */
export function buildAuxIndicatorDetail(position, key) {
  if (!TRADING_ZONE_STANDARD_AUX.includes(key)) return null

  const seedMap = POSITION_AUX_SEED[position.id]
  const raw =
    key === "10MA"
      ? seedMap?.["10MA"] ?? deriveAuxSeed(position, key)
      : key === "20MA"
        ? seedMap?.["20MA"] ?? deriveAuxSeed(position, key)
        : key === "RSI"
          ? seedMap?.rsi ?? deriveAuxSeed(position, key)
          : key === "MACD"
            ? seedMap?.macd ?? deriveAuxSeed(position, key)
            : seedMap?.volume ?? deriveAuxSeed(position, key)

  return formatAuxDetail(/** @type {AuxIndicatorKey} */ (key), raw)
}
