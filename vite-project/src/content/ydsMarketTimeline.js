/**
 * Market Timeline V1.6 — eventHistory 누적 · 표시 전용
 * Hero = 현재 · Timeline = 최근 변화 · History = 장기 기록
 */

import { getFinalScore } from "../utils/tradingScores.js"
import { resolveEventLayer } from "./ydsEventLayer.js"
import { resolveOverheatLayer, OVERHEAT_TIER_COPY } from "./ydsOverheatLayer.js"
import { rowDate } from "./ydsLayerHistory.js"

/** @typedef {"low"|"medium"|"high"} TimelineSeverity */

/**
 * @typedef {{
 *   date: string
 *   type: string
 *   severity: TimelineSeverity
 *   title: string
 *   description: string
 * }} TimelineEventRecord
 */

/**
 * @typedef {{
 *   events: TimelineEventRecord[]
 *   displayEvents: TimelineEventRecord[]
 *   totalCount: number
 * }} MarketTimelineView
 */

export const TIMELINE_EMOJI = {
  "cnn-exit": "🟠",
  "bofa-exit": "🟠",
  "cnn-entry": "🟡",
  "bofa-entry": "🟡",
  "momentum-cnn-sharp": "🟠",
  "momentum-bofa-weak": "🟠",
  "overheat-cashPrep": "🟡",
  "overheat-partialCash": "🟠",
  "overheat-boundary": "🔵",
  "panic-dca-entry": "🟠",
  "panic-life-entry": "🔴",
}

/** @type {Record<string, TimelineSeverity>} */
const TYPE_SEVERITY = {
  "cnn-exit": "medium",
  "bofa-exit": "medium",
  "cnn-entry": "low",
  "bofa-entry": "low",
  "momentum-cnn-sharp": "medium",
  "momentum-bofa-weak": "medium",
  "overheat-cashPrep": "low",
  "overheat-partialCash": "medium",
  "overheat-boundary": "high",
  "panic-dca-entry": "medium",
  "panic-life-entry": "high",
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
 * @param {string} description
 */
function makeRecord(date, type, title, description) {
  return {
    date,
    type,
    severity: TYPE_SEVERITY[type] ?? "medium",
    title,
    description,
  }
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

  const push = (date, type, title, description) => {
    const key = `${date}:${type}`
    if (seenDayType.has(key)) return
    seenDayType.add(key)
    records.push(makeRecord(date, type, title, description))
  }

  for (let i = 0; i < series.length; i += 1) {
    const current = series[i]
    const date = rowDate(current)
    if (!date) continue

    const prior = series.slice(0, i)
    const layer = resolveEventLayer(current, prior)
    for (const ev of layer.events) {
      push(date, ev.id, ev.title, ev.summary || ev.title)
    }

    const overheat = resolveOverheatLayer(current)
    const prevOverheat = i > 0 ? resolveOverheatLayer(series[i - 1]) : null
    if (overheat && overheat.id !== "normal" && overheat.id !== prevOverheat?.id) {
      const copy = OVERHEAT_TIER_COPY[overheat.id]
      push(
        date,
        `overheat-${overheat.id}`,
        `${copy.label} 진입`,
        copy.summary,
      )
    }

    const yds = rowYdsScore(current)
    const prevYds = i > 0 ? rowYdsScore(series[i - 1]) : null
    if (yds != null && prevYds != null) {
      if (yds >= 80 && prevYds < 80) {
        push(date, "panic-life-entry", "패닉 진입", "극단적 공포 구간에 진입했습니다.")
      } else if (yds >= 60 && prevYds < 60) {
        push(date, "panic-dca-entry", "분할매수 진입", "공포 확대 · 분할매수 구간 진입")
      }
    }
  }

  return records.sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * @param {TimelineEventRecord[]} stored
 * @param {TimelineEventRecord[]} detected
 */
export function mergeTimelineEventHistory(stored, detected) {
  const map = new Map()
  for (const ev of [...stored, ...detected]) {
    if (!ev?.date || !ev?.type) continue
    map.set(`${ev.date}:${ev.type}`, ev)
  }
  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * @param {object[]} historyRows
 * @param {object | null | undefined} panicData
 * @param {{ limit?: number; stored?: TimelineEventRecord[] }} [opts]
 */
export function resolveMarketTimeline(historyRows, panicData, opts = {}) {
  const limit = Math.max(5, Math.min(10, opts.limit ?? 8))
  const series = buildTimelineSeries(historyRows, panicData)
  const detected = scanTimelineEventsFromSeries(series)
  const merged = mergeTimelineEventHistory(opts.stored ?? [], detected)

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
