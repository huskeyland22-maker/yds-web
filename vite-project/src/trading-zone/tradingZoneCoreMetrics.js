/**
 * 실전 매매 존 — 핵심 매매정보 표시·계산
 */
import { TRADING_ZONE_FIELD_PENDING } from "./tacticalTradingZoneData.js"
import { resolvePositionPriceLevels } from "./tradingZonePriceProgress.js"

/** @type {readonly { key: string; label: string; tooltip: string; empty: string }[]} */
export const TRADING_CORE_METRIC_FIELDS = [
  {
    key: "rr",
    label: "손익비 (RR)",
    tooltip: "= 목표수익 ÷ 손실위험 · RR 2 이상 = 우수 · RR 1 이하 = 주의",
    empty: TRADING_ZONE_FIELD_PENDING,
  },
  {
    key: "expectedReturn",
    label: "기대수익",
    tooltip: "목표가 도달 시 예상 수익률(%)",
    empty: TRADING_ZONE_FIELD_PENDING,
  },
  {
    key: "stopRisk",
    label: "손절위험",
    tooltip: "현재가 대비 손절가 하락 폭(%)",
    empty: TRADING_ZONE_FIELD_PENDING,
  },
  {
    key: "holdingDays",
    label: "보유일",
    tooltip: "진입 후 경과 일수",
    empty: "-",
  },
  {
    key: "weight",
    label: "비중",
    tooltip: "포트폴리오 내 비중",
    empty: "-",
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
 * @param {number | null} current
 * @param {number | null} target
 */
export function computeExpectedReturnPercent(current, target) {
  if (current == null || target == null || !Number.isFinite(current) || current === 0) return null
  return ((target - current) / current) * 100
}

/**
 * @param {number | null} current
 * @param {number | null} stop
 * @param {number | null} target
 */
export function computeRewardRiskRatioLabel(current, stop, target) {
  if (current == null || stop == null || target == null) return null
  const risk = Math.abs(current - stop)
  const reward = Math.abs(target - current)
  if (risk === 0 || !Number.isFinite(risk) || !Number.isFinite(reward)) return null
  const ratio = reward / risk
  const rounded = Math.round(ratio * 100) / 100
  const body = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")
  return `1 : ${body}`
}

/** @param {string | null | undefined} raw */
function parsePositionRrDisplay(raw) {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s || s === "—" || s === "-") return null
  if (/^1\s*:\s*\d/.test(s)) return s.replace(/\s+/g, " ")
  const num = Number(s.replace(/[^\d.]/g, ""))
  if (Number.isFinite(num) && num > 0) return `1 : ${num}`
  return s
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

  const rrFromPrice = computeRewardRiskRatioLabel(current, stop, target)
  const expectedFromPrice = formatSignedPercent(computeExpectedReturnPercent(current, target))
  const stopRiskFromPrice = formatSignedPercent(computeStopRiskPercent(current, stop))

  const rr =
    parsePositionRrDisplay(position.rr) ??
    rrFromPrice ??
    TRADING_ZONE_FIELD_PENDING

  const expectedReturn =
    parsePositionPercentDisplay(position.expectedReturn) ??
    expectedFromPrice ??
    TRADING_ZONE_FIELD_PENDING

  const stopRisk = stopRiskFromPrice ?? TRADING_ZONE_FIELD_PENDING

  let holdingDays = "-"
  if (position.holdingDays != null && Number.isFinite(position.holdingDays)) {
    holdingDays = `${position.holdingDays}일`
  }

  let weight = "-"
  const weightRaw = position.weight
  if (weightRaw != null) {
    const s = String(weightRaw).trim()
    if (s && s !== "—" && s !== "-") {
      weight = /%/.test(s) ? s : `${s}%`
    }
  }

  return {
    rr,
    expectedReturn,
    stopRisk,
    holdingDays,
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
