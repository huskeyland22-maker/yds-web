/**
 * 채권·유동성 — 참고·힌트 전용 (판단권·점수·추천·섹터 결정 없음)
 */

import { getBondLiquiditySpotCache } from "../macro-risk/bondLiquiditySpotCache.js"
import { isValidUsTreasuryYield } from "../macro-risk/bondYieldValidity.js"

const BOND_YIELD_MISSING_LABEL = "—"
const STALE_VALUE_SUFFIX = "(최근 저장값)"

/** @typedef {{ statusLabels: string[]; hintLines: string[] }} BondReferenceDisplay */

const REFERENCE_STATUS_PRIORITY = ["금리 재평가", "장기채 경고", "유동성 주의", "유동성 축소"]

/** @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot @param {string} key */
function metricRow(snapshot, key) {
  const rows = [
    ...(snapshot?.tieredMetrics?.tier1 ?? []),
    ...(snapshot?.tieredMetrics?.tier2 ?? []),
  ]
  return rows.find((r) => r.key === key) ?? null
}

/**
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot
 * @returns {string[]}
 */
export function deriveBondReferenceStatuses(snapshot) {
  if (!snapshot) return []

  /** @type {string[]} */
  const found = []
  const triggers = snapshot.triggers ?? []
  const active = (id) => triggers.some((t) => t.active && t.id === id)

  if (active("rate_repricing_event") || active("rate_shock")) found.push("금리 재평가")
  if (active("long_inflation") || active("long_rate_stress")) found.push("장기채 경고")
  if (active("dollar_pressure")) found.push("유동성 주의")

  const us30 = metricRow(snapshot, "US30Y")
  if (us30?.current != null && Number(us30.current) >= 5 && !found.includes("장기채 경고")) {
    found.push("장기채 경고")
  }

  const dxy = metricRow(snapshot, "DXY")
  const liqStatus = snapshot.pillars?.find((p) => p.id === "liquidity")?.status ?? ""
  if (
    (dxy?.slope === "up" || (dxy?.change1D != null && Number(dxy.change1D) > 0.3)) &&
    !found.includes("유동성 주의")
  ) {
    found.push("유동성 주의")
  } else if (liqStatus.includes("축소") && !found.includes("유동성 축소")) {
    found.push("유동성 축소")
  } else if (liqStatus.includes("압박") && !found.includes("유동성 주의")) {
    found.push("유동성 주의")
  }

  const rateStatus = snapshot.pillars?.find((p) => p.id === "rate")?.status ?? ""
  if (
    (rateStatus.includes("재평가") || rateStatus.includes("상방")) &&
    !found.includes("금리 재평가")
  ) {
    found.push("금리 재평가")
  }

  const ordered = REFERENCE_STATUS_PRIORITY.filter((s) => found.includes(s))
  return ordered.slice(0, 2)
}

/**
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot
 * @returns {string[]}
 */
export function buildBondFutureHints(snapshot) {
  if (!snapshot) return []

  /** @type {string[]} */
  const hints = []
  const us10 = metricRow(snapshot, "US10Y")
  const us30 = metricRow(snapshot, "US30Y")
  const dxy = metricRow(snapshot, "DXY")

  const us10Up =
    us10?.slope === "up" || (us10?.change1D != null && Number(us10.change1D) > 0.05)
  const us30High = us30?.current != null && Number(us30.current) >= 5
  const dxyUp =
    dxy?.slope === "up" || (dxy?.change1D != null && Number(dxy.change1D) > 0.3)

  if (us10Up) hints.push("성장주 변동성 가능성")
  if (us30High) hints.push("장기채 부담 · 인플레 재점검")
  if (dxyUp) hints.push("유동성 주의 · 외인 흐름 확인")

  return hints.slice(0, 2)
}

/**
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot
 * @returns {BondReferenceDisplay}
 */
export function buildBondReferenceDisplay(snapshot) {
  const statusLabels = deriveBondReferenceStatuses(snapshot)
  const hintLines = buildBondFutureHints(snapshot)
  return { statusLabels, hintLines }
}

/**
 * @typedef {{
 *   key: string
 *   shortLabel: string
 *   value: string
 *   arrow: string
 *   warn: boolean
 *   tag: string
 *   missing?: boolean
 *   stale?: boolean
 * }} BondCompactLine
 */

/** @type {Record<string, string>} */
const ROLE_TAG = {
  US10Y: "금리 방향",
  US30Y: "장기채 압력",
  DXY: "달러 유동성",
  MOVE: "채권 변동성",
}

/** @type {Record<string, string>} */
const SHORT_LABEL = {
  US10Y: "10Y",
  US30Y: "30Y",
  DXY: "DXY",
  MOVE: "MOVE",
}

/** @type {Record<string, string>} */
const BOND_CORE_LABELS = {
  US10Y: "10Y 수익률",
  US30Y: "30Y 수익률",
  REAL_YIELD: "실질금리(REAL)",
  BEI: "기대인플레이션(BEI)",
}

export const BOND_CORE_KEYS = ["US10Y", "US30Y", "REAL_YIELD", "BEI"]

/**
 * @typedef {{
 *   key: string
 *   label: string
 *   value: string
 *   arrow: "↑" | "↓" | null
 *   warn: boolean
 *   stale: boolean
 * }} BondCoreMetricLine
 */

/**
 * @typedef {"collecting" | "ready" | "fetch_failed" | "no_data"} BondCoreUiPhase
 */

/**
 * @typedef {{
 *   phase: BondCoreUiPhase
 *   lines: BondCoreMetricLine[]
 *   badge: string | null
 * }} BondCoreUiState
 */

/**
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot
 * @param {(key: string, n: number | null, fmt?: string) => string} formatValue
 * @param {string[]} statuses
 * @param {string} key
 * @returns {BondCompactLine}
 */
/**
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot
 * @param {string} key
 * @returns {{ cur: number | null; stale: boolean }}
 */
function resolveMetricSpot(snapshot, key) {
  const row = metricRow(snapshot, key)
  const raw = row?.current != null && Number.isFinite(Number(row.current)) ? Number(row.current) : null
  const isBondYield = key === "US10Y" || key === "US30Y" || key === "US2Y"
  const bondMeta = snapshot?.bondCollection
  const sourceKind = bondMeta?.sourceByKey?.[key]

  if (isBondYield) {
    if (isValidUsTreasuryYield(raw)) {
      return { cur: raw, stale: sourceKind != null && sourceKind !== "live" }
    }
    const lastKnown = bondMeta?.lastKnown?.[key]
    const cached = getBondLiquiditySpotCache(key)
    const fallback = isValidUsTreasuryYield(lastKnown)
      ? Number(lastKnown)
      : cached != null
        ? cached
        : null
    return { cur: fallback, stale: fallback != null }
  }

  if (raw != null) return { cur: raw, stale: false }
  const cached = getBondLiquiditySpotCache(key)
  return { cur: cached, stale: cached != null }
}

function buildMetricCompactLine(snapshot, formatValue, statuses, key) {
  const row = metricRow(snapshot, key)
  const fmt = row?.format === "pct" ? "level" : row?.format ?? (key === "DXY" ? "level" : "rate")
  const { cur, stale: fromResolve } = resolveMetricSpot(snapshot, key)

  let value = cur != null ? formatValue(key, cur, fmt) : BOND_YIELD_MISSING_LABEL
  let missing = cur == null
  let stale = fromResolve

  if (cur != null && stale) {
    value = `${value} ${STALE_VALUE_SUFFIX}`
  }

  const slope = row?.slope ?? "flat"
  const arrow = slope === "up" ? "↑" : slope === "down" ? "↓" : "→"
  const warn =
    key === "US30Y" &&
    (statuses.includes("장기채 경고") || (cur != null && cur >= 5))

  return {
    key,
    shortLabel: SHORT_LABEL[key] ?? key,
    value,
    arrow,
    warn,
    tag: ROLE_TAG[key] ?? key,
    missing,
    stale,
  }
}

/**
 * @param {number | null | undefined} panicMove
 * @param {(key: string, n: number | null, fmt?: string) => string} formatValue
 * @returns {BondCompactLine}
 */
function buildMoveCompactLine(panicMove, formatValue) {
  const panic = Number(panicMove)
  const fromCache = !Number.isFinite(panic)
  const m = Number.isFinite(panic) ? panic : getBondLiquiditySpotCache("MOVE")
  if (!Number.isFinite(m)) {
    return {
      key: "MOVE",
      shortLabel: "MOVE",
      value: "—",
      arrow: "→",
      warn: false,
      tag: ROLE_TAG.MOVE,
      missing: true,
    }
  }
  let slope = "flat"
  if (m >= 120) slope = "up"
  else if (m <= 90) slope = "down"
  const arrow = slope === "up" ? "↑" : slope === "down" ? "↓" : "→"

  const base = formatValue("MOVE", m, "index")
  return {
    key: "MOVE",
    shortLabel: "MOVE",
    value: fromCache ? `${base} ${STALE_VALUE_SUFFIX}` : base,
    arrow,
    warn: m >= 120,
    tag: ROLE_TAG.MOVE,
    stale: fromCache,
  }
}

/**
 * @typedef {{
 *   bond: BondCompactLine[]
 *   liquidity: BondCompactLine[]
 * }} BondLiquidityGroups
 */

/**
 * @param {string} key
 * @param {(key: string, n: number | null, fmt?: string) => string} formatValue
 * @returns {BondCompactLine}
 */
function placeholderBondLine(key, formatValue) {
  const cached = getBondLiquiditySpotCache(key)
  if (cached != null && (key === "DXY" || key === "US10Y" || key === "US30Y")) {
    const fmt = key === "DXY" ? "level" : "rate"
    return {
      key,
      shortLabel: SHORT_LABEL[key] ?? key,
      value: `${formatValue(key, cached, fmt)} ${STALE_VALUE_SUFFIX}`,
      arrow: "→",
      warn: false,
      tag: ROLE_TAG[key] ?? key,
      stale: true,
    }
  }
  return {
    key,
    shortLabel: SHORT_LABEL[key] ?? key,
    value: BOND_YIELD_MISSING_LABEL,
    arrow: "→",
    warn: false,
    tag: ROLE_TAG[key] ?? key,
    missing: true,
  }
}

/**
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot
 * @param {(key: string, n: number | null, fmt?: string) => string} formatValue
 * @param {number | null | undefined} [panicMove]
 * @returns {BondLiquidityGroups}
 */
export function buildBondLiquidityGroups(snapshot, formatValue, panicMove = null) {
  const statuses = snapshot ? deriveBondReferenceStatuses(snapshot) : []

  const bond = ["US10Y", "US30Y"].map((key) => {
    if (!snapshot) return placeholderBondLine(key, formatValue)
    return buildMetricCompactLine(snapshot, formatValue, statuses, key)
  })

  const dxyLine = !snapshot
    ? placeholderBondLine("DXY", formatValue)
    : buildMetricCompactLine(snapshot, formatValue, statuses, "DXY")

  return {
    bond,
    liquidity: [dxyLine, buildMoveCompactLine(panicMove, formatValue)],
  }
}

/**
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot
 * @param {string} key
 * @returns {{ cur: number; stale: boolean } | null}
 */
function resolveBondCoreNumeric(snapshot, key) {
  const { cur, stale } = resolveMetricSpot(snapshot, key)
  if (cur == null || !Number.isFinite(cur)) return null
  if ((key === "US10Y" || key === "US30Y") && !isValidUsTreasuryYield(cur)) return null
  return { cur, stale }
}

/**
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot
 * @param {(key: string, n: number | null, fmt?: string) => string} formatValue
 * @returns {BondCoreMetricLine[]}
 */
export function buildBondCoreMetricLines(snapshot, formatValue) {
  if (!snapshot) return []

  const statuses = deriveBondReferenceStatuses(snapshot)

  /** @type {BondCoreMetricLine[]} */
  const lines = []
  for (const key of BOND_CORE_KEYS) {
    const resolved = resolveBondCoreNumeric(snapshot, key)
    if (!resolved) continue

    const row = metricRow(snapshot, key)
    const fmt = row?.format === "pct" ? "level" : row?.format ?? "rate"
    let value = formatValue(key, resolved.cur, fmt)
    if (resolved.stale) value = `${value} ${STALE_VALUE_SUFFIX}`

    const slope = row?.slope ?? "flat"
    const arrow = slope === "up" ? "↑" : slope === "down" ? "↓" : null

    lines.push({
      key,
      label: BOND_CORE_LABELS[key] ?? key,
      value,
      arrow,
      warn: key === "US30Y" && (statuses.includes("장기채 경고") || resolved.cur >= 5),
      stale: resolved.stale,
    })
  }
  return lines
}

/**
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot
 * @param {(key: string, n: number | null, fmt?: string) => string} formatValue
 * @returns {boolean}
 */
export function hasBondCoreMetricData(snapshot, formatValue) {
  return buildBondCoreMetricLines(snapshot, formatValue).length > 0
}

/**
 * @param {{
 *   loading?: boolean
 *   fetchFailed?: boolean
 *   error?: string | null
 *   timedOut?: boolean
 *   snapshot?: import("../macro-risk/engine.js").MacroRiskSnapshot | null
 *   formatValue: (key: string, n: number | null, fmt?: string) => string
 * }} input
 * @returns {BondCoreUiState}
 */
export function resolveBondCoreUiState({
  loading = false,
  fetchFailed = false,
  error = null,
  timedOut = false,
  snapshot = null,
  formatValue,
}) {
  const lines = buildBondCoreMetricLines(snapshot, formatValue)
  if (lines.length > 0) {
    return { phase: "ready", lines, badge: null }
  }
  if (loading) {
    return { phase: "collecting", lines: [], badge: "채권 데이터 수집 중" }
  }
  if (fetchFailed || timedOut || Boolean(error)) {
    return { phase: "fetch_failed", lines: [], badge: "채권 데이터 미수신" }
  }
  return { phase: "no_data", lines: [], badge: "채권 데이터 미수신" }
}

/**
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot
 * @param {(key: string, n: number | null, fmt?: string) => string} formatValue
 * @returns {BondCompactLine[]}
 */
export function buildLiquidityMetricLines(snapshot, formatValue, panicMove = null) {
  const statuses = snapshot ? deriveBondReferenceStatuses(snapshot) : []
  const lines = []

  if (snapshot) {
    const dxy = buildMetricCompactLine(snapshot, formatValue, statuses, "DXY")
    if (!dxy.missing) lines.push(dxy)
  } else {
    const dxy = placeholderBondLine("DXY", formatValue)
    if (!dxy.missing) lines.push(dxy)
  }

  const move = buildMoveCompactLine(panicMove, formatValue)
  if (!move.missing) lines.push(move)

  return lines
}

/** @deprecated Use buildBondLiquidityGroups */
export function buildBondCompactLines(snapshot, formatValue) {
  const { bond, liquidity } = buildBondLiquidityGroups(snapshot, formatValue)
  return [...bond, ...liquidity]
}

/** @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot @returns {string} */
export function bondStatusSummaryLine(snapshot) {
  const bond = snapshot?.bondCollection
  const labels = deriveBondReferenceStatuses(snapshot)
  return labels.length ? labels.join(" · ") : "특이 신호 없음"
}

/** @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot */
export function bondCollectionAlertLine(snapshot) {
  const bond = snapshot?.bondCollection
  if (!bond || bond.liveBondOk) return null
  return null
}

/** @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot @returns {boolean} */
export function bondDataDelayed(snapshot) {
  if (!snapshot) return false
  if (!snapshot.liveDataStatus?.liveFetchOk) return true
  return Boolean(snapshot.bondCollection?.usedStaleFallback)
}
