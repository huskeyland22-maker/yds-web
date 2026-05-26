import { sortHistoryRowsAsc } from "../utils/panicHistoryDesk.js"
import { buildHomeV5StrategyEvaluation, buildHomeV5StrategyRationale } from "./homeV5DeskModel.js"
import { appendHomeV5StrategyLogs } from "./homeV5StrategyLogPersist.js"

/** @type {Record<string, string>} */
const LAB_ACTION_BY_REGIME = {
  overheated: "현금 준비",
  neutral: "관망 · 기본 비중",
  interest: "저점 관찰",
  dca: "저점 분할",
  panicBuy: "분할매수",
}

/**
 * @param {object} panicData
 * @param {string} regimeId
 * @returns {string[]}
 */
export function buildHomeV5LabRationaleLines(panicData, regimeId) {
  const fg = Number(panicData?.fearGreed)
  const vix = Number(panicData?.vix)
  const bofa = Number(panicData?.bofa)
  const lines = []

  const rules = buildHomeV5StrategyRationale(panicData, regimeId).filter((l) => l !== "명확 신호 없음")
  lines.push(...rules)

  if (Number.isFinite(fg)) {
    if (fg >= 70 && !lines.some((l) => l.startsWith("CNN"))) lines.push(`CNN ${Math.round(fg)}`)
    else if (fg < 10 && !lines.some((l) => l.includes("CNN"))) lines.push(`CNN ${Math.round(fg)}`)
    else if (fg < 25 && regimeId === "dca" && !lines.some((l) => l.includes("CNN")))
      lines.push(`CNN ${Math.round(fg)}`)
    else if (fg < 30 && regimeId === "interest" && !lines.some((l) => l.includes("CNN")))
      lines.push(`CNN ${Math.round(fg)}`)
  }

  if (Number.isFinite(bofa) && bofa >= 7 && !lines.some((l) => l.startsWith("BofA"))) {
    lines.push(bofa >= 7.5 ? "BofA ~8" : "BofA 7+")
  }

  if (Number.isFinite(vix)) {
    if (vix >= 35 && !lines.some((l) => l.startsWith("VIX"))) lines.push(`VIX ${Math.round(vix)}+`)
    else if (vix >= 25 && !lines.some((l) => l.startsWith("VIX"))) lines.push(`VIX ${Math.round(vix)}+`)
    else if (vix < 20 && regimeId === "overheated" && !lines.some((l) => l.startsWith("VIX")))
      lines.push("VIX 저점")
  }

  if (!lines.length) {
    if (regimeId === "neutral") lines.push("명확 신호 없음")
    else lines.push("데이터 입력 후 근거 표시")
  }

  return [...new Set(lines)]
}

/** @typedef {"anchors" | "daily" | "weekly"} HomeV5ReplayMode */

/** @typedef {{
 *   id: string
 *   label: string
 *   start: string
 *   end: string
 *   anchors: string[]
 * }} HomeV5ValidationScenario */

/** @type {HomeV5ValidationScenario[]} */
export const HOME_V5_VALIDATION_SCENARIOS = [
  {
    id: "2018-q4",
    label: "2018 Q4",
    start: "2018-10-01",
    end: "2018-12-31",
    anchors: ["2018-10-03", "2018-11-20", "2018-12-24"],
  },
  {
    id: "2020-covid",
    label: "2020 코로나",
    start: "2020-02-15",
    end: "2020-04-15",
    anchors: ["2020-02-19", "2020-03-16", "2020-03-23", "2020-04-09"],
  },
  {
    id: "2022-rates",
    label: "2022 금리 하락장",
    start: "2022-06-01",
    end: "2022-12-31",
    anchors: ["2022-06-13", "2022-10-13", "2022-12-30"],
  },
  {
    id: "2023-svb",
    label: "2023 SVB",
    start: "2023-03-01",
    end: "2023-03-31",
    anchors: ["2023-03-08", "2023-03-13", "2023-03-17", "2023-03-24"],
  },
  {
    id: "2025-ai",
    label: "2025 AI장",
    start: "2025-01-01",
    end: "2025-12-31",
    anchors: ["2025-02-03", "2025-06-02", "2025-10-01", "2025-11-03"],
  },
]

/** @param {object} row */
function rowDateKey(row) {
  return String(row?.date ?? row?.ts ?? "").slice(0, 10)
}

/** @param {object} row */
export function cycleRowToPanicData(row) {
  if (!row) return null
  const hy = Number(row.highYield ?? row.hyOas)
  return {
    date: rowDateKey(row),
    fearGreed: row.fearGreed,
    vix: row.vix,
    bofa: row.bofa,
    highYield: Number.isFinite(hy) ? hy : undefined,
    putCall: row.putCall,
    move: row.move,
    skew: row.skew,
  }
}

/**
 * @param {object[]} sortedAsc
 * @param {string} isoDate
 */
function rowOnOrBefore(sortedAsc, isoDate) {
  let picked = null
  for (const row of sortedAsc) {
    const dk = rowDateKey(row)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dk)) continue
    if (dk <= isoDate) picked = row
    else break
  }
  return picked
}

/**
 * @param {object[]} sortedAsc
 * @param {string} start
 * @param {string} end
 */
function rowsInRange(sortedAsc, start, end) {
  return sortedAsc.filter((r) => {
    const d = rowDateKey(r)
    return d >= start && d <= end
  })
}

/**
 * @param {object[]} rangeRows
 * @param {HomeV5ReplayMode} mode
 * @param {string[]} anchors
 */
function pickReplayDates(rangeRows, mode, anchors) {
  if (!rangeRows.length) return []

  if (mode === "anchors") {
    return anchors
  }

  if (mode === "daily") {
    return rangeRows.map((r) => rowDateKey(r)).filter(Boolean)
  }

  const out = []
  let last = null
  for (const row of rangeRows) {
    const d = rowDateKey(row)
    if (!d) continue
    if (!last) {
      out.push(d)
      last = d
      continue
    }
    const diff = (new Date(`${d}T12:00:00`).getTime() - new Date(`${last}T12:00:00`).getTime()) / 86_400_000
    if (diff >= 7) {
      out.push(d)
      last = d
    }
  }
  return out
}

/**
 * @param {object | null} panicData
 * @param {object[]} historyUpTo
 * @param {{ scenarioId: string; scenarioLabel: string; date: string }} meta
 */
function evaluateAt(panicData, historyUpTo, meta) {
  if (!panicData) {
    return {
      ...meta,
      missing: true,
      statusEmoji: "—",
      statusLabel: "데이터 없음",
      action: "—",
      rationale: "해당 일자 히스토리 없음",
      rationaleLines: ["해당 일자 히스토리 없음"],
      dateLabel: meta.date.slice(0, 7),
      metrics: { cnn: null, vix: null, bofa: null, hy: null },
    }
  }

  const evaluation = buildHomeV5StrategyEvaluation(panicData, historyUpTo)
  if (!evaluation) {
    return {
      ...meta,
      missing: true,
      statusEmoji: "—",
      statusLabel: "판정 불가",
      action: "—",
      rationale: "CNN·VIX·BofA 지표 부족",
      rationaleLines: ["CNN·VIX·BofA 지표 부족"],
      dateLabel: meta.date.slice(0, 7),
      metrics: {
        cnn: Number(panicData.fearGreed),
        vix: Number(panicData.vix),
        bofa: Number(panicData.bofa),
        hy: Number(panicData.highYield ?? NaN),
      },
    }
  }

  const rationaleLines = buildHomeV5LabRationaleLines(panicData, evaluation.regimeId)

  return {
    ...meta,
    missing: false,
    regimeId: evaluation.regimeId,
    statusEmoji: evaluation.emoji,
    statusLabel: evaluation.label,
    action: LAB_ACTION_BY_REGIME[evaluation.regimeId] ?? evaluation.action,
    rationaleLines,
    rationale: rationaleLines.join(" · "),
    dateLabel: meta.date.slice(0, 7),
    metrics: evaluation.metrics,
  }
}

/** @param {ReturnType<typeof evaluateAt>[]} results */
export function buildRegimeTimeline(results) {
  /** @type {{ emoji: string; label: string; regimeId?: string; date: string }[]} */
  const chain = []
  for (const r of results) {
    if (r.missing || !r.statusEmoji || r.statusEmoji === "—") continue
    const prev = chain[chain.length - 1]
    if (prev && prev.regimeId === r.regimeId && prev.emoji === r.statusEmoji) continue
    chain.push({
      emoji: r.statusEmoji,
      label: r.statusLabel ?? "",
      regimeId: r.regimeId,
      date: r.date,
    })
  }
  return chain
}

/** @param {ReturnType<typeof evaluateAt>[]} results */
export function groupValidationByScenario(results) {
  const byId = new Map()
  for (const row of results) {
    const list = byId.get(row.scenarioId) ?? []
    list.push(row)
    byId.set(row.scenarioId, list)
  }

  return HOME_V5_VALIDATION_SCENARIOS.map((scenario) => {
    const rows = byId.get(scenario.id) ?? []
    return {
      scenario,
      results: rows,
      timeline: buildRegimeTimeline(rows),
    }
  }).filter((g) => g.results.length > 0)
}

/**
 * @param {object[]} historyRows
 * @param {HomeV5ValidationScenario} scenario
 * @param {HomeV5ReplayMode} [replayMode]
 */
export function replayHomeV5Scenario(historyRows, scenario, replayMode = "anchors") {
  const sorted = sortHistoryRowsAsc(historyRows)
  const rangeRows = rowsInRange(sorted, scenario.start, scenario.end)
  const dates = pickReplayDates(rangeRows, replayMode, scenario.anchors)

  return dates.map((date) => {
    const row = rowOnOrBefore(sorted, date)
    const panicData = cycleRowToPanicData(row)
    const historyUpTo = sorted.filter((r) => rowDateKey(r) <= date)
    return evaluateAt(panicData, historyUpTo, {
      scenarioId: scenario.id,
      scenarioLabel: scenario.label,
      date,
    })
  })
}

/** @param {ReturnType<typeof evaluateAt>[]} results */
export function persistHomeV5ValidationResults(results) {
  if (!results.length) return
  const recordedAt = new Date().toISOString()
  appendHomeV5StrategyLogs(
    results.map((r) => ({
      id: `${r.scenarioId}-${r.date}-${recordedAt}`,
      scenarioId: r.scenarioId,
      scenarioLabel: r.scenarioLabel,
      date: r.date,
      statusEmoji: r.statusEmoji,
      statusLabel: r.statusLabel,
      action: r.action,
      rationale: r.rationale,
      metrics: {
        cnn: Number.isFinite(r.metrics?.cnn) ? r.metrics.cnn : null,
        vix: Number.isFinite(r.metrics?.vix) ? r.metrics.vix : null,
        bofa: Number.isFinite(r.metrics?.bofa) ? r.metrics.bofa : null,
        hy: Number.isFinite(r.metrics?.hy) ? r.metrics.hy : null,
      },
      recordedAt,
    })),
  )
}

/**
 * @param {object[]} historyRows
 * @param {HomeV5ReplayMode} [replayMode]
 * @param {{ persistLog?: boolean; scenarioId?: string }} [opts]
 */
export function runHomeV5StrategyValidation(historyRows, replayMode = "anchors", opts = {}) {
  const { persistLog = true, scenarioId } = opts
  const sorted = sortHistoryRowsAsc(historyRows)
  /** @type {ReturnType<typeof evaluateAt>[]} */
  const results = []

  const scenarios = scenarioId
    ? HOME_V5_VALIDATION_SCENARIOS.filter((s) => s.id === scenarioId)
    : HOME_V5_VALIDATION_SCENARIOS

  for (const scenario of scenarios) {
    results.push(...replayHomeV5Scenario(sorted, scenario, replayMode))
  }

  if (persistLog) persistHomeV5ValidationResults(results)

  return results
}
