/**
 * 전술 HUD 중·장기 — 매크로 스냅샷 보조 점수 (10Y·30Y·유동성)
 */
import { deriveBondLiquidityStatuses } from "../market-os/bondLiquidityStatus.js"
import { pickMetricValue } from "./panicMarketActionEngine.js"

/** @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null | undefined} snapshot @param {string} key */
export function pickSnapshotMetricValue(snapshot, key) {
  if (!snapshot?.tieredMetrics) return null
  const rows = [
    ...(snapshot.tieredMetrics.tier1 ?? []),
    ...(snapshot.tieredMetrics.tier2 ?? []),
  ]
  const row = rows.find((r) => r.key === key)
  const n = Number(row?.current)
  return Number.isFinite(n) ? n : null
}

/** @param {object | null | undefined} panicData @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null | undefined} snapshot */
export function pickUs10yValue(panicData, snapshot) {
  return pickMetricValue(panicData, "us10y") ?? pickSnapshotMetricValue(snapshot, "US10Y")
}

/** @param {object | null | undefined} panicData @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null | undefined} snapshot */
export function pickUs30yValue(panicData, snapshot) {
  return pickMetricValue(panicData, "us30y") ?? pickSnapshotMetricValue(snapshot, "US30Y")
}

/** @param {object | null | undefined} panicData */
export function pickDxyValue(panicData) {
  return pickMetricValue(panicData, "dxy")
}

/**
 * 유동성 보조 — 높을수록 관심·우호 (0~100)
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null | undefined} snapshot
 */
export function liquidityInterestScore(snapshot) {
  if (!snapshot) return null
  const statuses = deriveBondLiquidityStatuses(snapshot)
  if (statuses.includes("유동성 축소")) return 22
  if (statuses.includes("유동성 주의")) return 38
  if (statuses.includes("금리 재평가")) return 42
  if (statuses.includes("장기채 경고")) return 35
  if (statuses.includes("성장주 압박")) return 45
  if (statuses.includes("보조 확인 양호")) return 74
  return 58
}

/** @param {number} v — 10Y 수준 */
export function us10yInterestScore(v) {
  if (v <= 3.6) return 80
  if (v <= 4.0) return 72
  if (v <= 4.35) return 62
  if (v <= 4.7) return 50
  if (v <= 5.1) return 38
  return 24
}

/** @param {number} v — 30Y 수준 */
export function us30yInterestScore(v) {
  if (v <= 4.0) return 82
  if (v <= 4.5) return 74
  if (v <= 4.9) return 62
  if (v <= 5.2) return 48
  if (v <= 5.6) return 36
  return 22
}

/** @param {number} v — DXY */
export function dxyInterestScore(v) {
  if (v <= 99) return 78
  if (v <= 102) return 70
  if (v <= 105) return 58
  if (v <= 108) return 44
  if (v <= 112) return 32
  return 20
}

/**
 * 10Y·30Y 복합 금리 점수
 * @param {object | null | undefined} panicData
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null | undefined} snapshot
 */
export function compositeRatesInterestScore(panicData, snapshot) {
  const parts = []
  const y10 = pickUs10yValue(panicData, snapshot)
  const y30 = pickUs30yValue(panicData, snapshot)
  if (y10 != null) parts.push(us10yInterestScore(y10))
  if (y30 != null) parts.push(us30yInterestScore(y30))
  if (!parts.length) return null
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length)
}
