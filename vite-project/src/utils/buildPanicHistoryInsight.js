/**
 * 패닉 히스토리 V2 — 상단 카드·해석·변곡점·하단 인사이트
 */
import { formatChartAxisMd } from "./chartDateFormat.js"
import { resolvePanicV2Status } from "../panic-v2/panicV2Status.js"
import { interpretPanicMetric } from "./panicMetricInterpretation.js"
import {
  computeHistoryChangeRates,
  computeHistoryMetricStats,
  formatHistoryChangePct,
  HIGHER_IS_BAD,
  historyValuesForMetric,
} from "./panicHistoryStats.js"
import { sortHistoryRowsAsc } from "./panicHistoryDesk.js"

const SESSIONS_6M = 126

/** @typedef {"stable" | "transition" | "warning" | "overheat"} PanicBadgeId */

/**
 * @typedef {{
 *   id: PanicBadgeId
 *   label: string
 *   color: string
 *   toneClass: string
 * }} PanicBadge
 */

/**
 * @typedef {{
 *   date: string
 *   axisLabel: string
 *   value: number
 *   kind: string
 *   label: string
 *   badgeLabel: string
 *   color: string
 * }} HistoryInflection
 */

/** @param {object} row @param {string} key */
function rowValue(row, key) {
  if (key === "highYield" || key === "hyOas") return Number(row.highYield ?? row.hyOas)
  return Number(row[key])
}

/** @param {number[]} values @param {number} current @param {boolean} higherIsBad */
function percentilePositionLabel(values, current, higherIsBad = true) {
  if (!values.length || !Number.isFinite(current)) return "—"
  const below = values.filter((v) => v < current).length
  const pct = (below / values.length) * 100
  const lowRank = Math.round(100 - pct)
  if (!higherIsBad) return `하위 ${Math.round(pct)}%`
  return `하위 ${lowRank}%`
}

/**
 * @param {{ statusLabel?: string; tone?: string } | null} interp
 * @returns {PanicBadge}
 */
export function resolvePanicBadge(interp) {
  const status = interp?.statusLabel ?? ""
  const tone = interp?.tone ?? "neutral"

  const overheatStatuses = [
    "공포",
    "극도 공포",
    "극도 탐욕",
    "스트레스",
    "꼬리위험",
    "위험",
    "콜과열",
  ]
  if (overheatStatuses.includes(status) || tone === "danger") {
    return {
      id: "overheat",
      label: "과열",
      color: "#ef4444",
      toneClass: "panic-badge--overheat",
    }
  }

  if (status === "경계" || status === "중립" || status === "보통") {
    return {
      id: "transition",
      label: "전환",
      color: "#f97316",
      toneClass: "panic-badge--transition",
    }
  }

  if (status === "경고" || status === "과열" || status === "탐욕" || status === "극도 낙관") {
    return {
      id: "warning",
      label: "경고",
      color: "#fb923c",
      toneClass: "panic-badge--warning",
    }
  }

  if (tone === "warning") {
    return {
      id: "warning",
      label: "경고",
      color: "#fb923c",
      toneClass: "panic-badge--warning",
    }
  }

  return {
    id: "stable",
    label: "안정",
    color: "#22d3ee",
    toneClass: "panic-badge--stable",
  }
}

/** @param {PanicBadgeId} id */
function inflectionColorForBadge(id) {
  switch (id) {
    case "overheat":
      return "#ef4444"
    case "warning":
      return "#fb923c"
    case "transition":
      return "#f97316"
    default:
      return "#22d3ee"
  }
}

/**
 * @param {object[]} rows
 * @param {string} metricKey
 * @param {{ maxMarkers?: number }} [opts]
 * @returns {HistoryInflection[]}
 */
export function detectHistoryInflections(rows, metricKey, opts = {}) {
  const maxMarkers = opts.maxMarkers ?? 4
  const sorted = sortHistoryRowsAsc(rows)
  if (sorted.length < 3) return []

  /** @type {HistoryInflection[]} */
  const raw = []

  for (let i = 1; i < sorted.length - 1; i++) {
    const v = rowValue(sorted[i], metricKey)
    const vp = rowValue(sorted[i - 1], metricKey)
    const vn = rowValue(sorted[i + 1], metricKey)
    if (!Number.isFinite(v) || !Number.isFinite(vp) || !Number.isFinite(vn)) continue

    const date = String(sorted[i]?.date ?? "").slice(0, 10)
    const axisLabel = formatChartAxisMd(date)
    const higherIsBad = HIGHER_IS_BAD[metricKey] ?? true

    if (v < vp && v < vn) {
      raw.push({
        date,
        axisLabel,
        value: v,
        kind: "floor",
        label: `${axisLabel} 저점`,
        badgeLabel: "저점",
        color: "#22d3ee",
      })
    } else if (higherIsBad && v > vp && v > vn) {
      raw.push({
        date,
        axisLabel,
        value: v,
        kind: "peak",
        label: `${axisLabel} 고점`,
        badgeLabel: "고점",
        color: "#ef4444",
      })
    }
  }

  let prevStatus = null
  for (const row of sorted) {
    const v = rowValue(row, metricKey)
    if (!Number.isFinite(v)) continue
    const ins =
      metricKey === "panicV2" || metricKey === "panicV1"
        ? { statusLabel: resolvePanicV2Status(v)?.label ?? null }
        : interpretPanicMetric(metricKey, v)
    const status = ins?.statusLabel ?? null
    if (prevStatus && status && status !== prevStatus) {
      const badge = resolvePanicBadge(ins)
      const date = String(row?.date ?? "").slice(0, 10)
      const axisLabel = formatChartAxisMd(date)
      const tag =
        badge.id === "transition"
          ? "전환"
          : badge.id === "stable"
            ? "안정"
            : badge.label
      raw.push({
        date,
        axisLabel,
        value: v,
        kind: "zone-change",
        label: `${axisLabel} ${tag}`,
        badgeLabel: tag,
        color: inflectionColorForBadge(badge.id),
      })
    }
    prevStatus = status
  }

  const byDate = new Map()
  for (const item of raw) {
    const prev = byDate.get(item.date)
    if (!prev || item.kind === "zone-change") byDate.set(item.date, item)
  }

  return [...byDate.values()].slice(-maxMarkers)
}

/**
 * @param {string} metricKey
 * @param {ReturnType<typeof computeHistoryMetricStats>} stats
 * @param {PanicBadge} badge
 * @param {{ weekPct: number | null; monthPct: number | null }} changes
 * @returns {string[]}
 */
export function buildMarketInterpretationLines(metricKey, stats, badge, changes) {
  const interp = Number.isFinite(stats.current)
    ? interpretPanicMetric(metricKey, stats.current)
    : null
  const lines = []

  if (interp?.headline) {
    const short = interp.headline.replace(/\.$/, "").slice(0, 42)
    lines.push(short.length < interp.headline.length ? `${short}…` : short)
  } else if (metricKey === "panicV2" && Number.isFinite(stats.current)) {
    lines.push(`통합 패닉 ${Math.round(stats.current)} · ${resolvePanicV2Status(stats.current)?.label ?? "—"}`)
  } else if (metricKey === "vix" && badge.id === "stable") {
    lines.push("변동성 안정 구간")
  }

  if (changes.weekPct != null && Number.isFinite(changes.weekPct)) {
    if (changes.weekPct <= -3) lines.push("최근 5일 하락")
    else if (changes.weekPct >= 3) lines.push("최근 5일 상승")
  }

  const higherIsBad = HIGHER_IS_BAD[metricKey] ?? true
  if (changes.weekPct != null && changes.weekPct < -2) {
    lines.push(higherIsBad ? "공포 완화" : "심리 개선")
  } else if (changes.weekPct != null && changes.weekPct > 2 && higherIsBad) {
    lines.push("리스크 상승")
  }

  if (badge.id === "stable") lines.push("추격보다 눌림 우선")
  else if (badge.id === "transition") lines.push("방향 확인 후 대응")
  else if (badge.id === "warning") lines.push("비중·헤지 점검")
  else lines.push("추격 자제·방어 우선")

  return [...new Set(lines)].slice(0, 3)
}

/**
 * @param {string} metricKey
 * @param {ReturnType<typeof computeHistoryMetricStats>} stats
 * @param {PanicBadge} badge
 * @param {{ weekPct: number | null; monthPct: number | null }} changes
 * @returns {string}
 */
export function buildBottomInsightText(metricKey, stats, badge, changes) {
  const parts = []
  const metricName =
    metricKey === "panicV2"
      ? "패닉"
      : metricKey === "vix"
        ? "VIX"
        : metricKey === "fearGreed"
          ? "F&G"
          : metricKey === "putCall"
            ? "P/C"
            : "지표"

  if (badge.id === "stable") parts.push(`${metricName} 안정.`)
  else if (badge.id === "transition") parts.push(`${metricName} 전환 구간.`)
  else if (badge.id === "warning") parts.push(`${metricName} 경계.`)
  else parts.push(`${metricName} 과열·스트레스.`)

  const higherIsBad = HIGHER_IS_BAD[metricKey] ?? true
  if (changes.weekPct != null && changes.weekPct < -2) {
    parts.push(higherIsBad ? "공포 완화." : "심리 개선.")
  } else if (changes.weekPct != null && changes.weekPct > 2 && higherIsBad) {
    parts.push("변동성 확대.")
  } else if (changes.weekPct != null && Math.abs(changes.weekPct) < 2) {
    parts.push("단기 변화 제한적.")
  }

  if (changes.monthPct != null && changes.monthPct < -3 && higherIsBad) {
    parts.push("변동성 감소.")
  } else if (changes.monthPct != null && changes.monthPct > 3 && higherIsBad) {
    parts.push("변동성 누적 상승.")
  }

  if (badge.id === "stable") parts.push("추격보다 눌림 우선.")
  else if (badge.id === "overheat") parts.push("추격 자제·헤지 검토.")
  else if (badge.id === "transition") parts.push("확인 후 분할 대응.")
  else parts.push("리스크 관리 우선.")

  return parts.slice(0, 4).join(" ")
}

/**
 * @param {object[]} rows — 선택 구간
 * @param {object[]} fullRows — 6M 백분위용
 * @param {string} metricKey
 */
export function buildPanicHistoryInsight(rows, fullRows, metricKey) {
  const stats = computeHistoryMetricStats(rows, metricKey)
  const changes = computeHistoryChangeRates(rows, metricKey)
  const interp = Number.isFinite(stats.current)
    ? metricKey === "panicV2" || metricKey === "panicV1"
      ? { statusLabel: resolvePanicV2Status(stats.current)?.label, tone: "neutral" }
      : interpretPanicMetric(metricKey, stats.current, { historyRows: rows })
    : null
  const badge = resolvePanicBadge(interp)

  const sixMonthRows = sortHistoryRowsAsc(fullRows).slice(-SESSIONS_6M)
  const sixMonthValues = historyValuesForMetric(sixMonthRows, metricKey)
  const position6m =
    stats.current != null && sixMonthValues.length
      ? percentilePositionLabel(
          sixMonthValues,
          stats.current,
          HIGHER_IS_BAD[metricKey] ?? true,
        )
      : "—"

  const interpretationLines = buildMarketInterpretationLines(metricKey, stats, badge, changes)
  const inflections = detectHistoryInflections(rows, metricKey)
  const bottomInsight = buildBottomInsightText(metricKey, stats, badge, changes)

  const fiveDayText = stats.weekText
  const oneMonthText = stats.monthText

  return {
    stats,
    changes,
    badge,
    statusLabel: stats.statusLabel,
    interpretationLines,
    inflections,
    bottomInsight,
    header: {
      currentText: stats.currentText,
      statusLabel: stats.statusLabel,
      badge,
      fiveDayText,
      fiveDayPct: stats.weekPct,
      fiveDayPending: stats.weekPending,
      positionLabel: stats.percentileLabel,
      oneMonthText,
      oneMonthPct: stats.monthPct,
      oneMonthPending: stats.monthPending,
      position6m,
    },
    changeStrip: [
      { label: "5D", text: fiveDayText, pct: stats.weekPct, pending: stats.weekPending },
      { label: "1M", text: oneMonthText, pct: stats.monthPct, pending: stats.monthPending },
      { label: "6M", text: position6m, pct: null, pending: false, isPosition: true },
    ],
  }
}

/** chartData에 변곡 메타 병합 */
export function mergeInflectionsIntoChartData(chartData, inflections) {
  const byDate = new Map(inflections.map((p) => [p.date, p]))
  return chartData.map((row) => {
    const hit = byDate.get(row.date)
    if (!hit) return row
    return {
      ...row,
      inflectionLabel: hit.label,
      inflectionBadge: hit.badgeLabel,
      inflectionColor: hit.color,
    }
  })
}
