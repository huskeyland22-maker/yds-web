/**
 * 전환 신호 검증 — 실시간 재스캔 기준 (localStorage 캐시 미사용)
 */

import {
  buildTimelineSeries,
  scanTimelineEventsFromSeries,
} from "./ydsMarketTimeline.js"
import { rowDate } from "./ydsLayerHistory.js"
import {
  marketStateScoreForRow,
  panicIntensityScoreForRow,
  resolveScoreZoneMeta,
} from "./ydsMarketTrendSeries.js"
import { enrichTimelineEventsWithScoreDeltas } from "./ydsTimelineScoreDelta.js"

/**
 * @param {object[]} historyRows
 * @param {object | null | undefined} panicData
 * @param {object[]} [displayEvents]
 */
export function buildTransitionAudit(historyRows, panicData, displayEvents = []) {
  const series = buildTimelineSeries(historyRows, panicData)
  const latestRow = series[series.length - 1] ?? null
  const prevRow = series.length > 1 ? series[series.length - 2] : null
  const today = latestRow ? rowDate(latestRow) : null

  const marketState = marketStateScoreForRow(latestRow)
  const panicIntensity = panicIntensityScoreForRow(latestRow)
  const prevMarketState = marketStateScoreForRow(prevRow)
  const currentMarketState = marketState
  const prevPanic = panicIntensityScoreForRow(prevRow)
  const currentPanic = panicIntensity

  const marketZone = marketState != null ? resolveScoreZoneMeta(marketState, "market").label : null
  const panicZone = panicIntensity != null ? resolveScoreZoneMeta(panicIntensity, "panic").label : null
  const prevMarketZone =
    prevMarketState != null ? resolveScoreZoneMeta(prevMarketState, "market").label : null
  const currentMarketZone = marketZone
  const prevPanicZone = prevPanic != null ? resolveScoreZoneMeta(prevPanic, "panic").label : null
  const currentPanicZone = panicZone

  const allEvents = enrichTimelineEventsWithScoreDeltas(
    series,
    scanTimelineEventsFromSeries(series),
  )
  const events = displayEvents.length ? displayEvents : allEvents
  const lastSignal = events[0] ?? null
  const todaySignals = today ? allEvents.filter((ev) => ev.date === today) : []

  const marketScoreChanged =
    prevMarketState != null && currentMarketState != null && prevMarketState !== currentMarketState
  const panicScoreChanged =
    prevPanic != null && currentPanic != null && prevPanic !== currentPanic
  const zoneChanged =
    (prevMarketZone && currentMarketZone && prevMarketZone !== currentMarketZone) ||
    (prevPanicZone && currentPanicZone && prevPanicZone !== currentPanicZone)

  const shouldGenerateSignal = todaySignals.length > 0

  return {
    source: "realtime-rescan",
    historyLatestDate: today,
    seriesLength: series.length,
    today,
    marketState,
    marketZone,
    panicIntensity,
    panicZone,
    lastSignalDate: lastSignal?.date ?? null,
    prevMarketState,
    currentMarketState,
    prevMarketZone,
    currentMarketZone,
    prevPanic,
    currentPanic,
    prevPanicZone,
    currentPanicZone,
    marketScoreChanged,
    panicScoreChanged,
    zoneChanged,
    shouldGenerateSignal,
    todaySignals: todaySignals.map((ev) => ({
      date: ev.date,
      type: ev.type,
      title: ev.title,
      scoreDelta: ev.scoreDelta?.text ?? null,
    })),
    generatedSignals: events.slice(0, 10).map((ev) => ({
      date: ev.date,
      type: ev.type,
      title: ev.title,
      scoreDelta: ev.scoreDelta?.text ?? null,
    })),
  }
}

/**
 * @param {ReturnType<typeof buildTransitionAudit>} audit
 */
export function logTransitionAudit(audit) {
  if (typeof console === "undefined" || !audit) return
  console.groupCollapsed("[transition-audit]")
  console.log("source", audit.source)
  console.log("today", audit.today ?? "—")
  console.log("marketState", audit.marketState ?? "—")
  console.log("marketZone", audit.marketZone ?? "—")
  console.log("panicIntensity", audit.panicIntensity ?? "—")
  console.log("panicZone", audit.panicZone ?? "—")
  console.log("lastSignalDate", audit.lastSignalDate ?? "—")
  console.log("prevMarketState", audit.prevMarketState ?? "—")
  console.log("currentMarketState", audit.currentMarketState ?? "—")
  console.log("prevMarketZone", audit.prevMarketZone ?? "—")
  console.log("currentMarketZone", audit.currentMarketZone ?? "—")
  console.log("prevPanic", audit.prevPanic ?? "—")
  console.log("currentPanic", audit.currentPanic ?? "—")
  console.log("prevPanicZone", audit.prevPanicZone ?? "—")
  console.log("currentPanicZone", audit.currentPanicZone ?? "—")
  console.log("shouldGenerateSignal", audit.shouldGenerateSignal)
  console.log("generatedSignals", audit.generatedSignals)
  if (audit.todaySignals?.length) {
    console.log("todaySignals", audit.todaySignals)
  }
  console.groupEnd()
}
