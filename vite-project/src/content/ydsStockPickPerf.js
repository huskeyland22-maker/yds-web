/**
 * 종목추천 페이지 성능 측정
 */

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

export function markFirstRender() {
  if (marks["first render"]) return
  marks["render"] = performance.now()
  measure("first paint", "load start")
  marks["first render"] = marks["render"]
  console.log("[stock-pick-perf] render")
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

  const report = {
    visit: visitType,
    fromCache: Boolean(meta.fromCache),
    firstEntryMs: measures["first paint"] ?? measures["api fetch"] ?? null,
    revisitMs: visitType === "revisit" ? measures["first paint"] ?? null : null,
    apiFetchMs: measures["api fetch"] ?? null,
    scoreCalcMs: measures["score calc"] ?? null,
    renderMs: measures["first paint"] ?? null,
    searchMs: searchMs || null,
    slowestLabel: slowest[0],
    slowestMs: slowest[1],
    fetchSegments,
    slowestSegmentLabel: slowestSegment[0],
    slowestSegmentMs: slowestSegment[1],
    targets: {
      apiFetchUnder3s: (measures["api fetch"] ?? Infinity) < 3000,
      firstPaintUnder5s: (measures["first paint"] ?? Infinity) < 5000,
    },
    refreshing: Boolean(meta.refreshing),
  }

  console.log("[stock-pick-perf] === 최종 보고 ===", report)
  console.log(
    `[stock-pick-perf] 병목 구간: ${slowestSegment[0]} (${slowestSegment[1]}ms)`,
  )
  return report
}

export function getStockPickPerfMeasures() {
  return { ...measures, searchMs, visitType }
}
