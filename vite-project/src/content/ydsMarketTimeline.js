/**
 * Market Timeline V3 — 시장 변화 기록 (표시·누적 전용)
 * 이벤트 발생이 아니라 시장 흐름 설명서
 */

import { getFinalScore } from "../utils/tradingScores.js"
import {
  cnnEventSpec,
  computeCnnDeltas,
  resolveCnnTimelineEventType,
} from "./ydsCnnEventEngine.js"
import { resolveEventLayer } from "./ydsEventLayer.js"
import { resolveOverheatLayer } from "./ydsOverheatLayer.js"
import { resolveMomentumLayer } from "./ydsMomentumLayer.js"
import { rowDate, toNum } from "./ydsLayerHistory.js"

/** @typedef {"low"|"medium"|"high"} TimelineSeverity */

/**
 * @typedef {{
 *   date: string
 *   type: string
 *   severity: TimelineSeverity
 *   title: string
 *   metrics: string
 *   action: string
 *   description: string
 * }} TimelineEventRecord
 */

/**
 * @typedef {{
 *   events: TimelineEventRecord[]
 *   displayEvents: TimelineEventRecord[]
 *   totalCount: number
 *   detectedCount?: number
 * }} MarketTimelineView
 */

export const TIMELINE_EMOJI = {
  "cnn-exit": "🟠",
  "bofa-exit": "🟠",
  "cnn-entry": "🟡",
  "bofa-entry": "🟡",
  "momentum-cnn-day-shock": "🟠",
  "momentum-cnn-soft-fall": "🟠",
  "momentum-cnn-day-bounce": "🟢",
  "momentum-cnn-crash": "🔴",
  "momentum-cnn-sharp": "🟠",
  "momentum-cnn-weaken": "🟠",
  "momentum-cnn-surge": "🟢",
  "momentum-cnn-recovery": "🟢",
  "momentum-bofa-weak": "🟠",
  "overheat-cashPrep": "🟡",
  "overheat-partialCash": "🟠",
  "overheat-boundary": "🔴",
  "overheat-normal": "🟠",
  "panic-dca-entry": "🟠",
  "panic-life-entry": "🔴",
}

/** @type {Record<string, TimelineSeverity>} */
const TYPE_SEVERITY = {
  "cnn-exit": "medium",
  "bofa-exit": "medium",
  "cnn-entry": "low",
  "bofa-entry": "low",
  "momentum-cnn-day-shock": "medium",
  "momentum-cnn-soft-fall": "medium",
  "momentum-cnn-day-bounce": "low",
  "momentum-cnn-crash": "high",
  "momentum-cnn-sharp": "medium",
  "momentum-cnn-weaken": "medium",
  "momentum-cnn-surge": "medium",
  "momentum-cnn-recovery": "low",
  "momentum-bofa-weak": "medium",
  "overheat-cashPrep": "low",
  "overheat-partialCash": "medium",
  "overheat-boundary": "high",
  "overheat-normal": "medium",
  "panic-dca-entry": "medium",
  "panic-life-entry": "high",
}

const OVERHEAT_RANK = { normal: 0, cashPrep: 1, partialCash: 2, boundary: 3 }

/** 날짜당 1건 · 스트림 우선순위 (높을수록 우선) */
export const TIMELINE_TYPE_PRIORITY = {
  "overheat-boundary": 100,
  "overheat-partialCash": 96,
  "overheat-cashPrep": 92,
  "cnn-entry": 90,
  "bofa-entry": 89,
  "overheat-normal": 88,
  "cnn-exit": 87,
  "bofa-exit": 86,
  "panic-life-entry": 84,
  "panic-dca-entry": 80,
  "momentum-cnn-day-shock": 72,
  "momentum-cnn-crash": 68,
  "momentum-cnn-sharp": 66,
  "momentum-cnn-soft-fall": 64,
  "momentum-cnn-weaken": 62,
  "momentum-cnn-day-bounce": 58,
  "momentum-cnn-surge": 56,
  "momentum-cnn-recovery": 54,
  "momentum-bofa-weak": 50,
}

/** @param {string} type */
export function timelineTypePriority(type) {
  return TIMELINE_TYPE_PRIORITY[type] ?? 40
}

/**
 * @param {object | null | undefined} row
 * @param {{ cnn?: boolean; bofa?: boolean; vix?: boolean }} [opts]
 */
export function formatTurningPointMetrics(row, opts = {}) {
  const includeCnn = opts.cnn !== false
  const includeBofa = opts.bofa !== false
  const includeVix = opts.vix === true
  /** @type {string[]} */
  const parts = []
  const cnn = toNum(row?.fearGreed)
  const bofa = toNum(row?.bofa)
  const vix = toNum(row?.vix)
  if (includeCnn && cnn != null) parts.push(`CNN ${Math.round(cnn)}`)
  if (includeBofa && bofa != null) parts.push(`BofA ${bofa.toFixed(1)}`)
  if (includeVix && vix != null) parts.push(`VIX ${vix.toFixed(1)}`)
  return parts.join(" · ")
}

/**
 * @param {string | null | undefined} fromId
 * @param {string} toId
 */
export function resolveOverheatTransitionCopy(fromId, toId) {
  const from = fromId ?? "normal"
  const fromRank = OVERHEAT_RANK[from] ?? 0
  const toRank = OVERHEAT_RANK[toId] ?? 0

  if (toRank > fromRank) {
    if (toId === "cashPrep") {
      return { title: "과열권 진입", action: "현금 준비 시작", emoji: "🟡", severity: "low" }
    }
    if (toId === "partialCash") {
      return {
        title: from === "normal" ? "과열권 진입" : "과열권 강화",
        action: from === "normal" ? "차익실현 검토" : "차익실현 검토",
        emoji: from === "normal" ? "🟡" : "🟠",
        severity: "medium",
      }
    }
    if (toId === "boundary") {
      return { title: "최고 과열", action: "차익실현 우선", emoji: "🔴", severity: "high" }
    }
  }

  if (toRank < fromRank) {
    if (toId === "normal") {
      return { title: "과열 해소", action: "추격매수 금지", emoji: "🟡", severity: "medium" }
    }
    if (toId === "cashPrep") {
      return { title: "과열권 완화", action: "현금 준비 유지", emoji: "🟡", severity: "low" }
    }
    if (toId === "partialCash") {
      return { title: "과열권 완화", action: "차익실현 유지", emoji: "🟠", severity: "medium" }
    }
  }

  return null
}

/** @type {Record<string, { title: string; action: string }>} */
const EVENT_TURNING_COPY = {
  "cnn-entry": { title: "과열권 진입", action: "현금 준비 시작" },
  "cnn-exit": { title: "과열권 이탈", action: "과열 해소 시작" },
  "bofa-entry": { title: "과열권 진입", action: "현금 준비 시작" },
  "bofa-exit": { title: "과열권 이탈", action: "추격매수 금지" },
  "momentum-cnn-day-shock": { title: "투자심리 급변", action: "단기 변동성 확대" },
  "momentum-cnn-soft-fall": { title: "투자심리 추가 악화", action: "하락 흐름 지속" },
  "momentum-cnn-day-bounce": { title: "투자심리 급회복", action: "매수세 재유입 관찰" },
  "momentum-cnn-crash": { title: "CNN 급락", action: "신규 진입 보류" },
  "momentum-cnn-sharp": { title: "CNN 급락", action: "과열 해소 진행" },
  "momentum-cnn-weaken": { title: "CNN 악화", action: "관망 우선" },
  "momentum-cnn-surge": { title: "CNN 급반등", action: "매수세 유입 관찰" },
  "momentum-cnn-recovery": { title: "CNN 회복", action: "심리 개선 관찰" },
  "momentum-bofa-weak": { title: "투자심리 악화", action: "관망 우선" },
  "panic-dca-entry": { title: "패닉 발생", action: "분할매수 시작" },
  "panic-life-entry": { title: "극단 패닉", action: "인생타점 검토" },
}

/**
 * @param {object[]} historyRows
 * @param {object | null | undefined} panicData
 */
function buildTimelineSeries(historyRows, panicData) {
  const map = new Map()
  for (const row of historyRows ?? []) {
    const d = rowDate(row)
    if (!d) continue
    map.set(d, { ...map.get(d), ...row, date: d })
  }
  const asOf = rowDate(panicData)
  if (asOf) {
    map.set(asOf, { ...map.get(asOf), ...panicData, date: asOf })
  }
  return [...map.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

/** @param {object | null | undefined} row */
function rowYdsScore(row) {
  if (!row) return null
  const score = getFinalScore(row)
  return Number.isFinite(score) ? Math.round(score) : null
}

/**
 * @param {string} date
 * @param {string} type
 * @param {string} title
 * @param {string} metrics
 * @param {string} action
 * @param {TimelineSeverity} [severityOverride]
 */
function makeRecord(date, type, title, metrics, action, severityOverride) {
  return {
    date,
    type,
    severity: severityOverride ?? TYPE_SEVERITY[type] ?? "medium",
    title,
    metrics,
    action,
    description: action,
  }
}

/** @param {string} metrics */
export function extractCnnFromMetrics(metrics) {
  const m = String(metrics ?? "").match(/CNN\s+([\d.]+)/)
  return m ? m[1] : null
}

/** @param {TimelineEventRecord} ev */
export function formatTimelineStreamLead(ev) {
  const cnn = extractCnnFromMetrics(ev.metrics)
  if (cnn != null) return `CNN ${cnn}`
  const bofa = String(ev.metrics ?? "").match(/BofA\s+([\d.]+)/)
  if (bofa) return `BofA ${bofa[1]}`
  return ev.metrics?.split(" · ")[0] ?? ""
}

/**
 * @param {TimelineEventRecord[]} events
 */
export function consolidateTimelinePerDay(events) {
  const byDate = new Map()
  for (const ev of events ?? []) {
    if (!ev?.date) continue
    const prev = byDate.get(ev.date)
    if (!prev || timelineTypePriority(ev.type) > timelineTypePriority(prev.type)) {
      byDate.set(ev.date, ev)
    }
  }
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * @param {object[]} series
 */
export function scanTimelineEventsFromSeries(series) {
  if (!series.length) return []

  /** @type {TimelineEventRecord[]} */
  const records = []
  /** @type {Set<string>} */
  const seenDayType = new Set()

  const push = (date, type, title, metrics, action, severity) => {
    const key = `${date}:${type}`
    if (seenDayType.has(key)) return
    seenDayType.add(key)
    records.push(makeRecord(date, type, title, metrics, action, severity))
  }

  for (let i = 0; i < series.length; i += 1) {
    const current = series[i]
    const date = rowDate(current)
    if (!date) continue

    const prior = series.slice(0, i)
    const prev = i > 0 ? series[i - 1] : null

    const overheat = resolveOverheatLayer(current)
    const prevOverheat = prev ? resolveOverheatLayer(prev) : null
    let overheatHandled = false

    if (overheat && overheat.id !== prevOverheat?.id) {
      const copy = resolveOverheatTransitionCopy(prevOverheat?.id, overheat.id)
      if (copy) {
        const type = overheat.id === "normal" ? "overheat-normal" : `overheat-${overheat.id}`
        push(date, type, copy.title, formatTurningPointMetrics(current), copy.action, copy.severity)
        overheatHandled = true
      }
    }

    const layer = resolveEventLayer(current, prior)
    const prevLayer = prev ? resolveEventLayer(prev, series.slice(0, i)) : null
    const prevEventIds = new Set((prevLayer?.events ?? []).map((ev) => ev.id))

    for (const ev of layer.events) {
      if (prevEventIds.has(ev.id)) continue
      if (ev.id.startsWith("momentum-")) continue

      const copy = EVENT_TURNING_COPY[ev.id]
      if (!copy) continue

      if (ev.id.includes("entry") && overheatHandled) continue
      if (ev.id.includes("exit") && overheat?.id === "normal" && prevOverheat?.id !== "normal") continue

      let metrics = formatTurningPointMetrics(current)
      if (ev.id.startsWith("momentum-cnn-")) {
        metrics = formatTurningPointMetrics(current, { bofa: false })
      } else if (ev.id === "momentum-bofa-weak") {
        metrics = formatTurningPointMetrics(current, { cnn: false })
      } else if (ev.id.startsWith("cnn-")) {
        metrics = formatTurningPointMetrics(current, { bofa: false })
      } else if (ev.id.startsWith("bofa-")) {
        metrics = formatTurningPointMetrics(current, { cnn: false })
      }

      push(date, ev.id, copy.title, metrics, copy.action)
    }

    const { delta3d, delta1d } = computeCnnDeltas(current, prior)
    const cnnEventType = resolveCnnTimelineEventType(delta3d, delta1d)
    if (cnnEventType) {
      const spec = cnnEventSpec(cnnEventType)
      const copy = EVENT_TURNING_COPY[cnnEventType]
      push(
        date,
        cnnEventType,
        copy?.title ?? spec?.title ?? cnnEventType,
        formatTurningPointMetrics(current, { bofa: false }),
        copy?.action ?? spec?.action ?? "",
        spec?.severity,
      )
    }
    const momentum = resolveMomentumLayer(current, prior)
    const prevMomentum = prev ? resolveMomentumLayer(prev, series.slice(0, i)) : null
    const momentumBecameActive =
      momentum.level !== "none" && (prevMomentum?.level === "none" || !prevMomentum)

    if (momentumBecameActive && momentum.bofaLevel !== "none" && prevMomentum?.bofaLevel === "none") {
      push(
        date,
        "momentum-bofa-weak",
        EVENT_TURNING_COPY["momentum-bofa-weak"].title,
        formatTurningPointMetrics(current, { cnn: false }),
        EVENT_TURNING_COPY["momentum-bofa-weak"].action,
      )
    }

    const yds = rowYdsScore(current)
    const prevYds = prev ? rowYdsScore(prev) : null
    if (yds != null && prevYds != null) {
      if (yds >= 80 && prevYds < 80) {
        push(
          date,
          "panic-life-entry",
          EVENT_TURNING_COPY["panic-life-entry"].title,
          formatTurningPointMetrics(current, { vix: true }),
          EVENT_TURNING_COPY["panic-life-entry"].action,
          "high",
        )
      } else if (yds >= 60 && prevYds < 60) {
        push(
          date,
          "panic-dca-entry",
          EVENT_TURNING_COPY["panic-dca-entry"].title,
          formatTurningPointMetrics(current, { vix: true }),
          EVENT_TURNING_COPY["panic-dca-entry"].action,
        )
      }
    }
  }

  return consolidateTimelinePerDay(records)
}

/**
 * @param {TimelineEventRecord[]} stored
 * @param {TimelineEventRecord[]} detected
 * @deprecated V2 — reconcileTimelineEventHistory 사용
 */
export function mergeTimelineEventHistory(stored, detected) {
  return reconcileTimelineEventHistory(stored, detected)
}

/**
 * 재스캔 결과를 기준으로 저장 이벤트 정합 — 감지되지 않은 항목 제거
 * @param {TimelineEventRecord[]} stored
 * @param {TimelineEventRecord[]} detected
 */
export function reconcileTimelineEventHistory(stored, detected) {
  const detectedKeys = new Set(
    (detected ?? []).map((ev) => `${ev.date}:${ev.type}`).filter(Boolean),
  )
  const storedMap = new Map()
  for (const ev of stored ?? []) {
    if (!ev?.date || !ev?.type) continue
    if (!detectedKeys.has(`${ev.date}:${ev.type}`)) continue
    storedMap.set(`${ev.date}:${ev.type}`, ev)
  }
  const merged = (detected ?? []).map((ev) => {
    const prev = storedMap.get(`${ev.date}:${ev.type}`)
    return prev ? { ...prev, ...ev } : ev
  })
  const deduped = new Map()
  for (const ev of merged) {
    deduped.set(`${ev.date}:${ev.type}`, ev)
  }
  return consolidateTimelinePerDay([...deduped.values()])
}

/**
 * @param {object[]} historyRows
 * @param {object | null | undefined} panicData
 * @param {{ limit?: number; stored?: TimelineEventRecord[] }} [opts]
 */
export function resolveMarketTimeline(historyRows, panicData, opts = {}) {
  const limit = Math.max(5, Math.min(12, opts.limit ?? 7))
  const series = buildTimelineSeries(historyRows, panicData)
  const detected = scanTimelineEventsFromSeries(series)
  const merged = reconcileTimelineEventHistory(opts.stored ?? [], detected)

  return {
    events: merged,
    displayEvents: merged.slice(0, limit),
    totalCount: merged.length,
    detectedCount: detected.length,
  }
}

/** @param {string} isoDate YYYY-MM-DD */
export function formatTimelineDateLabel(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "—"
  const [, month, day] = isoDate.split("-")
  return `${month}/${day}`
}

/** @param {string} type */
export function timelineEventEmoji(type) {
  return TIMELINE_EMOJI[type] ?? "⚪"
}
