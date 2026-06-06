/**
 * Momentum Layer — CNN·BofA 단기 변화율 (표시 전용 · getFinalScore 무관)
 * @see docs/YDS_DUAL_CYCLE_FRAMEWORK.md
 */

/** @typedef {"none"|"warning"|"strong"} MomentumLevel */

/** @typedef {{
 *   level: MomentumLevel
 *   score: number
 *   shortLabel: string
 *   emoji: string
 *   cnnDelta3d: number | null
 *   bofaDelta2w: number | null
 *   cnnLevel: MomentumLevel
 *   bofaLevel: MomentumLevel
 *   triggers: string[]
 *   explainLines: string[]
 *   hasData: boolean
 * }} MomentumLayerView
 */

export const MOMENTUM_RULES = {
  cnn: {
    windowDays: 3,
    warningDelta: -15,
    strongDelta: -25,
  },
  bofa: {
    windowDays: 14,
    warningDelta: -1.0,
    strongDelta: -2.0,
  },
}

function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** @param {object | null | undefined} row */
function rowDate(row) {
  if (!row || typeof row !== "object") return null
  const d = String(row.date ?? row.ts ?? "").trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
}

/**
 * @param {object[]} rows
 * @param {string | null} asOfDate YYYY-MM-DD
 */
function normalizeHistoryRows(rows, asOfDate) {
  const map = new Map()
  for (const row of rows ?? []) {
    const d = rowDate(row)
    if (!d) continue
    map.set(d, { ...map.get(d), ...row, date: d })
  }
  if (asOfDate && /^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
    map.set(asOfDate, { ...map.get(asOfDate), date: asOfDate })
  }
  return [...map.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

/**
 * @param {object[]} sorted ascending by date
 * @param {number} daysBack calendar days
 */
function findRowDaysBefore(sorted, daysBack) {
  if (!sorted.length) return null
  const latest = sorted[sorted.length - 1]
  const latestDate = latest.date
  const base = new Date(`${latestDate}T12:00:00.000Z`)
  base.setUTCDate(base.getUTCDate() - daysBack)
  const target = base.toISOString().slice(0, 10)

  let best = null
  for (const row of sorted) {
    if (row.date <= target) best = row
    else break
  }
  return best
}

/** @param {number | null} delta @param {{ warningDelta: number; strongDelta: number }} rule */
function levelFromDelta(delta, rule) {
  if (delta == null || !Number.isFinite(delta)) return "none"
  if (delta <= rule.strongDelta) return "strong"
  if (delta <= rule.warningDelta) return "warning"
  return "none"
}

/** @param {MomentumLevel} a @param {MomentumLevel} b */
function maxLevel(a, b) {
  const rank = { none: 0, warning: 1, strong: 2 }
  return rank[a] >= rank[b] ? a : b
}

function fmtSigned(n, digits = 1) {
  if (n == null || !Number.isFinite(n)) return "—"
  const v = digits === 0 ? Math.round(n) : Math.round(n * 10 ** digits) / 10 ** digits
  return `${v > 0 ? "+" : ""}${v}`
}

/**
 * @param {MomentumLevel} level
 * @param {MomentumLevel} cnnLevel
 * @param {MomentumLevel} bofaLevel
 */
function buildShortLabel(level, cnnLevel, bofaLevel) {
  if (level === "none") return "단기 안정"
  const parts = []
  if (cnnLevel !== "none") {
    parts.push(cnnLevel === "strong" ? "투자심리 급락 (강)" : "투자심리 급락 감지")
  }
  if (bofaLevel !== "none") {
    parts.push(bofaLevel === "strong" ? "BofA 급락 (강)" : "BofA 심리 악화")
  }
  if (!parts.length) return "단기 경고"
  return parts.join(" · ")
}

/**
 * @param {{
 *   cnnDelta: number | null
 *   bofaDelta: number | null
 *   cnnLevel: MomentumLevel
 *   bofaLevel: MomentumLevel
 *   fearStageLabel?: string
 * }} ctx
 */
function buildExplainLines(ctx) {
  /** @type {string[]} */
  const lines = []
  if (ctx.cnnLevel !== "none" && ctx.cnnDelta != null) {
    lines.push(`CNN Fear & Greed가 최근 3일간 ${fmtSigned(ctx.cnnDelta, 0)}포인트 급락했습니다.`)
  }
  if (ctx.bofaLevel !== "none" && ctx.bofaDelta != null) {
    lines.push(`BofA Bull & Bear가 최근 2주간 ${fmtSigned(ctx.bofaDelta, 1)} 하락했습니다.`)
  }
  if (lines.length && ctx.fearStageLabel) {
    lines.push(
      `장기 사이클은 여전히 ${ctx.fearStageLabel}이지만 단기 변동성 확대 가능성이 있습니다.`,
    )
  } else if (lines.length) {
    lines.push("장기 절대값과 달리 단기 변동성 확대 가능성이 있습니다.")
  }
  return lines
}

/**
 * @param {object | null | undefined} panicData
 * @param {object[]} [historyRows]
 * @param {{ fearStageLabel?: string }} [opts]
 */
export function resolveMomentumLayer(panicData, historyRows = [], opts = {}) {
  const asOf = rowDate(panicData) ?? rowDate(historyRows[historyRows.length - 1])
  const merged = normalizeHistoryRows(historyRows, asOf)

  if (panicData && asOf) {
    const last = merged[merged.length - 1]
    merged[merged.length - 1] = {
      ...last,
      date: asOf,
      fearGreed: toNum(panicData.fearGreed) ?? toNum(last?.fearGreed),
      bofa: toNum(panicData.bofa) ?? toNum(last?.bofa),
    }
  }

  const latest = merged[merged.length - 1] ?? null
  const cnnNow = toNum(latest?.fearGreed)
  const bofaNow = toNum(latest?.bofa)

  const row3d = findRowDaysBefore(merged, MOMENTUM_RULES.cnn.windowDays)
  const row2w = findRowDaysBefore(merged, MOMENTUM_RULES.bofa.windowDays)

  const cnnPrev = toNum(row3d?.fearGreed)
  const bofaPrev = toNum(row2w?.bofa)

  const cnnDelta3d = cnnNow != null && cnnPrev != null ? cnnNow - cnnPrev : null
  const bofaDelta2w = bofaNow != null && bofaPrev != null ? bofaNow - bofaPrev : null

  const cnnLevel = levelFromDelta(cnnDelta3d, MOMENTUM_RULES.cnn)
  const bofaLevel = levelFromDelta(bofaDelta2w, MOMENTUM_RULES.bofa)
  const level = maxLevel(cnnLevel, bofaLevel)

  /** @type {string[]} */
  const triggers = []
  if (cnnLevel === "strong") triggers.push("CNN 3일 Δ ≤ −25")
  else if (cnnLevel === "warning") triggers.push("CNN 3일 Δ ≤ −15")
  if (bofaLevel === "strong") triggers.push("BofA 2주 Δ ≤ −2.0")
  else if (bofaLevel === "warning") triggers.push("BofA 2주 Δ ≤ −1.0")

  const shortLabel = buildShortLabel(level, cnnLevel, bofaLevel)
  const explainLines = buildExplainLines({
    cnnDelta: cnnDelta3d,
    bofaDelta: bofaDelta2w,
    cnnLevel,
    bofaLevel,
    fearStageLabel: opts.fearStageLabel,
  })

  return {
    level,
    score: level === "strong" ? 2 : level === "warning" ? 1 : 0,
    shortLabel,
    emoji: level === "none" ? "🟢" : level === "strong" ? "⚠️" : "⚠️",
    cnnDelta3d,
    bofaDelta2w,
    cnnLevel,
    bofaLevel,
    triggers,
    explainLines,
    hasData: cnnDelta3d != null || bofaDelta2w != null,
  }
}
