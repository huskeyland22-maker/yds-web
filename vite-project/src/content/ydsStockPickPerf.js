/**
 * 종목추천 페이지 성능 측정
 */

import { buildRenderPerfAnalysis } from "./ydsStockPickRenderPerf.js"
import { emitFirstEntryTimelineReport, markTimeline } from "./ydsFirstEntryTimeline.js"
import { getStockPickApiCount } from "./ydsStockPickApiCounter.js"

/** @type {Record<string, number>} */
const marks = {}

/** @type {Record<string, number>} */
const measures = {}

let visitType = "first"
let searchMs = 0
let reported = false

/** @type {Record<string, number | string | null | undefined>} */
let fetchSegments = {}

export function resetStockPickPerfSession(opts = {}) {
  visitType = opts.fromCache ? "revisit" : "first"
  searchMs = 0
  reported = false
  fetchSegments = {}
  for (const key of Object.keys(marks)) delete marks[key]
  for (const key of Object.keys(measures)) delete measures[key]
  mark("load start")
}

/**
 * @param {Record<string, number | string | null | undefined>} segments
 */
export function recordStockPickFetchSegments(segments) {
  fetchSegments = { ...segments }

  console.log(`[stock-pick-perf] US fetch count: ${segments.usFetchCount ?? 0}`)
  console.log(`[stock-pick-perf] US HTTP calls: ${segments.usHttpCallCount ?? 0}`)
  console.log(`[stock-pick-perf] US parallel count: ${segments.usParallelCount ?? 0}`)
  console.log(`[stock-pick-perf] US batch duration: ${segments.usBatchDurationMs ?? 0}ms`)
  console.log(`[stock-pick-perf] KR fetch count: ${segments.krFetchCount ?? 0}`)
  console.log(`[stock-pick-perf] KR HTTP calls: ${segments.krHttpCallCount ?? 0}`)
  console.log(`[stock-pick-perf] KR parallel count: ${segments.krParallelCount ?? 0}`)
  console.log(`[stock-pick-perf] KR batch duration: ${segments.krBatchDurationMs ?? 0}ms`)
  if (segments.portfolioDurationMs != null) {
    console.log(`[stock-pick-perf] portfolio duration: ${segments.portfolioDurationMs}ms`)
  }
}

export function mark(name) {
  if (typeof performance === "undefined") return
  marks[name] = performance.now()
  console.log(`[stock-pick-perf] ${name}`)
}

/**
 * @param {string} label
 * @param {string} startMark
 */
export function measure(label, startMark) {
  if (typeof performance === "undefined") return 0
  const start = marks[startMark]
  if (start == null) return 0
  const ms = Math.round(performance.now() - start)
  measures[label] = ms
  console.log(`[stock-pick-perf] ${label}: ${ms}ms`)
  return ms
}

/** @param {number} ms */
export function recordSearchFilterMs(ms) {
  searchMs = Math.round(ms)
  measures["search filter"] = searchMs
  console.log(`[stock-pick-perf] search filter: ${searchMs}ms (local only, no fetch)`)
}

export function markTop5Paint() {
  if (marks["top5 paint"]) return
  marks["top5 paint"] = performance.now()
  if (marks["post-api start"] != null) {
    const ms = Math.round(marks["top5 paint"] - marks["post-api start"])
    measures["top5 paint"] = ms
    console.log(`[stock-render] top5 paint (post-api): ${ms}ms`)
  }
}

export function markFirstRender() {
  if (marks["first render"]) return
  marks["render"] = performance.now()
  markTimeline("FIRST_PAINT")
  measure("first paint", "load start")
  if (marks["post-api start"] != null) {
    const postApiToPaint = Math.round(marks["render"] - marks["post-api start"])
    measures["post-api to paint"] = postApiToPaint
    console.log(`[stock-render] post-api to first paint: ${postApiToPaint}ms`)
  }
  marks["first render"] = marks["render"]
  console.log("[stock-pick-perf] render")
}

/** post-api 시점 기록 (markPostApiComplete와 동기화) */
export function syncPostApiMark() {
  if (typeof performance === "undefined") return
  marks["post-api start"] = performance.now()
}

/**
 * @param {{ fromCache?: boolean; refreshing?: boolean }} [meta]
 */
export function emitStockPickPerfReport(meta = {}) {
  if (reported) return
  reported = true

  const entries = Object.entries(measures)
  const slowest = entries.length
    ? entries.reduce((a, b) => (b[1] > a[1] ? b : a))
    : ["none", 0]

  const segmentEntries = [
    ["KR batch", Number(fetchSegments.krBatchDurationMs) || 0],
    ["US batch", Number(fetchSegments.usBatchDurationMs) || 0],
    ["portfolio", Number(fetchSegments.portfolioDurationMs) || 0],
    ["api fetch (total)", measures["api fetch"] ?? 0],
    ["score calc", measures["score calc"] ?? 0],
    ["first paint", measures["first paint"] ?? 0],
  ].filter(([, ms]) => ms > 0)

  const slowestSegment = segmentEntries.length
    ? segmentEntries.reduce((a, b) => (b[1] > a[1] ? b : a))
    : ["none", 0]

  const renderAnalysis = buildRenderPerfAnalysis({
    apiFetchMs: measures["api fetch"] ?? null,
    firstPaintMs: measures["first paint"] ?? null,
  })

  const allSegments = [
    ...segmentEntries,
    ...Object.entries(renderAnalysis.phases).map(([k, v]) => [k, v]),
    ["post-api to paint", measures["post-api to paint"] ?? 0],
    ["top5 paint", measures["top5 paint"] ?? 0],
  ].filter(([, ms]) => ms > 0)

  const globalSlowest = allSegments.length
    ? allSegments.reduce((a, b) => (b[1] > a[1] ? b : a))
    : slowestSegment

  const report = {
    visit: visitType,
    fromCache: Boolean(meta.fromCache),
    firstEntryMs: measures["first paint"] ?? measures["api fetch"] ?? null,
    revisitMs: visitType === "revisit" ? measures["first paint"] ?? null : null,
    apiFetchMs: measures["api fetch"] ?? null,
    postApiToPaintMs: measures["post-api to paint"] ?? null,
    top5PaintMs: measures["top5 paint"] ?? null,
    scoreCalcMs: measures["score calc"] ?? null,
    renderMs: measures["first paint"] ?? null,
    searchMs: searchMs || null,
    slowestLabel: slowest[0],
    slowestMs: slowest[1],
    fetchSegments,
    renderAnalysis,
    apiBottleneck: renderAnalysis.apiBottleneck,
    renderBottleneck: renderAnalysis.renderBottleneck,
    slowestFunction: renderAnalysis.slowestFunction,
    slowestFunctionMs: renderAnalysis.slowestFunctionMs,
    slowestComponent: renderAnalysis.slowestComponent,
    expectedImprovement: renderAnalysis.expectedImprovement,
    slowestSegmentLabel: globalSlowest[0],
    slowestSegmentMs: globalSlowest[1],
    targets: {
      apiFetchUnder3s: (measures["api fetch"] ?? Infinity) < 3000,
      firstPaintUnder5s: (measures["first paint"] ?? Infinity) < 5000,
    },
    refreshing: Boolean(meta.refreshing),
  }

  emitFirstEntryTimelineReport({ apiCount: getStockPickApiCount() })

  console.log("[stock-pick-perf] === 최종 보고 ===", report)
  console.log(
    `[stock-pick-perf] API 병목: ${renderAnalysis.apiBottleneck ? "예" : "아니오"} | 렌더 병목: ${renderAnalysis.renderBottleneck ? "예" : "아니오"}`,
  )
  console.log(
    `[stock-pick-perf] 가장 느린 구간: ${globalSlowest[0]} (${globalSlowest[1]}ms)`,
  )
  if (renderAnalysis.slowestFunctionMs > 0) {
    console.log(
      `[stock-pick-perf] 가장 느린 함수: ${renderAnalysis.slowestFunction} (${renderAnalysis.slowestFunctionMs}ms)`,
    )
  }
  if (renderAnalysis.slowestComponent) {
    console.log(
      `[stock-pick-perf] 가장 느린 컴포넌트: ${renderAnalysis.slowestComponent} (${renderAnalysis.slowestComponentMs}ms)`,
    )
  }
  if (renderAnalysis.expectedImprovement) {
    console.log(`[stock-pick-perf] 예상 개선: ${renderAnalysis.expectedImprovement}`)
  }
  return report
}

export function getStockPickPerfMeasures() {
  return { ...measures, searchMs, visitType }
}
