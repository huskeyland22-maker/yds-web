/**
 * 실전 매매 존 — 핵심 매매정보 표시·계산
 */
import { TRADING_ZONE_FIELD_PENDING } from "./tacticalTradingZoneData.js"
import { resolvePositionPriceLevels } from "./tradingZonePriceProgress.js"

/** @type {readonly { key: string; label: string; tooltip: string; empty: string; tone: string }[]} */
export const TRADING_CORE_METRIC_FIELDS = [
  {
    key: "expectedReturn",
    label: "기대수익",
    tooltip: "목표 달성 시 예상 수익률(%)",
    empty: TRADING_ZONE_FIELD_PENDING,
    tone: "gain",
  },
  {
    key: "upside",
    label: "상승여력",
    tooltip: "현재가 → 목표가 상승 폭 = (목표가 − 현재가) ÷ 현재가",
    empty: TRADING_ZONE_FIELD_PENDING,
    tone: "upside",
  },
  {
    key: "stopRisk",
    label: "손절위험",
    tooltip: "현재가 대비 손절가 하락 폭(%)",
    empty: TRADING_ZONE_FIELD_PENDING,
    tone: "risk",
  },
  {
    key: "weight",
    label: "권장비중",
    tooltip: "포트폴리오 내 권장 비중",
    empty: "-",
    tone: "weight",
  },
]

/**
 * @param {number | null} n
 * @param {number} [digits]
 */
export function formatSignedPercent(n, digits = 1) {
  if (n == null || !Number.isFinite(n)) return null
  const rounded = Math.round(n * 10 ** digits) / 10 ** digits
  const sign = rounded > 0 ? "+" : ""
  return `${sign}${rounded}%`
}

/**
 * @param {number | null} current
 * @param {number | null} stop
 */
export function computeStopRiskPercent(current, stop) {
  if (current == null || stop == null || !Number.isFinite(current) || current === 0) return null
  return ((stop - current) / current) * 100
}

/**
 * 상승여력 · 기대수익(가격 기준) = (목표가 − 현재가) / 현재가
 * @param {number | null} current
 * @param {number | null} target
 */
export function computeUpsidePercent(current, target) {
  if (current == null || target == null || !Number.isFinite(current) || current === 0) return null
  return ((target - current) / current) * 100
}

/** @param {string | null | undefined} raw */
function parsePositionPercentDisplay(raw) {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s || s === "—" || s === "-") return null
  if (/%/.test(s) || /^[+-]/.test(s)) return s
  const num = Number(s.replace(/[^\d.-]/g, ""))
  if (Number.isFinite(num)) return formatSignedPercent(num)
  return s
}

/**
 * @param {import("./tacticalTradingZoneData.js").TradingZonePosition} position
 */
export function buildTradingCoreMetrics(position) {
  const levels = resolvePositionPriceLevels(position)
  const { stop, current, target } = levels

  const upsideFromPrice = formatSignedPercent(computeUpsidePercent(current, target))
  const stopRiskFromPrice = formatSignedPercent(computeStopRiskPercent(current, stop))

  const expectedReturn =
    parsePositionPercentDisplay(position.expectedReturn) ??
    upsideFromPrice ??
    TRADING_ZONE_FIELD_PENDING

  const upside = upsideFromPrice ?? TRADING_ZONE_FIELD_PENDING
  const stopRisk = stopRiskFromPrice ?? TRADING_ZONE_FIELD_PENDING

  let weight = "-"
  const weightRaw = position.weight
  if (weightRaw != null) {
    const s = String(weightRaw).trim()
    if (s && s !== "—" && s !== "-") {
      weight = /%/.test(s) ? s : `${s}%`
    }
  }

  return {
    expectedReturn,
    upside,
    stopRisk,
    weight,
  }
}

/**
 * @param {string} value
 * @param {string} emptyToken
 */
export function isCoreMetricPlaceholder(value, emptyToken) {
  return value === emptyToken || value === TRADING_ZONE_FIELD_PENDING
}
