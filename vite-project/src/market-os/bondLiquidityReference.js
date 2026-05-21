/**
 * 채권·유동성 — 참고·힌트 전용 (판단권·점수·추천·섹터 결정 없음)
 */

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
 * }} BondCompactLine
 */

/** @param {string} key @param {ReturnType<typeof metricRow>} row @param {string[]} statuses */
function compactTagForKey(key, row, statuses) {
  if (key === "US10Y") {
    if (statuses.includes("금리 재평가")) return "금리압박"
    if (row?.slope === "up") return "금리압박"
    if (row?.slope === "down") return "금리완화"
    return "금리"
  }
  if (key === "US30Y") {
    if (statuses.includes("장기채 경고")) return "장기채"
    if (row?.current != null && Number(row.current) >= 5) return "장기채"
    return "장기"
  }
  if (key === "DXY") {
    if (statuses.includes("유동성 주의") || statuses.includes("유동성 축소")) return "유동성주의"
    if (row?.slope === "up") return "유동성주의"
    if (row?.slope === "down") return "유동성완화"
    return "유동성"
  }
  return ""
}

/**
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot
 * @param {(key: string, n: number | null, fmt?: string) => string} formatValue
 * @returns {BondCompactLine[]}
 */
export function buildBondCompactLines(snapshot, formatValue) {
  if (!snapshot) return []

  const statuses = deriveBondReferenceStatuses(snapshot)
  const keys = ["US10Y", "US30Y", "DXY"]
  const short = { US10Y: "10Y", US30Y: "30Y", DXY: "DXY" }

  return keys.map((key) => {
    const row = metricRow(snapshot, key)
    const fmt = row?.format === "pct" ? "level" : row?.format ?? "rate"
    const cur = row?.current != null && Number.isFinite(Number(row.current)) ? Number(row.current) : null
    const value = formatValue(key, cur, fmt)
    const slope = row?.slope ?? "flat"
    const arrow = slope === "up" ? "↑" : slope === "down" ? "↓" : "→"
    const tag = compactTagForKey(key, row, statuses)
    const warn = key === "US30Y" && (tag === "장기채" || statuses.includes("장기채 경고"))

    return {
      key,
      shortLabel: short[key] ?? key,
      value,
      arrow,
      warn,
      tag,
    }
  })
}

/** @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null} snapshot @returns {string} */
export function bondStatusSummaryLine(snapshot) {
  const labels = deriveBondReferenceStatuses(snapshot)
  return labels.length ? labels.join(" · ") : "특이 신호 없음"
}
