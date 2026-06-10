/**
 * 종목추천 렌더·계산 구간 성능 측정 (API 완료 → first paint)
 */

/** @type {Record<string, number>} */
const phases = {}

/** @type {number | null} */
let postApiAt = null

/** @type {{ scoreMs: number; statusMs: number; enrichOtherMs: number; count: number } | null} */
let computeSink = null

/** @type {string | null} */
let slowestComponent = null

/** @type {number} */
let slowestComponentMs = 0

export function resetStockPickRenderPerf() {
  for (const key of Object.keys(phases)) delete phases[key]
  postApiAt = null
  computeSink = null
  slowestComponent = null
  slowestComponentMs = 0
}

export function markPostApiComplete() {
  if (typeof performance === "undefined") return
  postApiAt = performance.now()
  console.log("[stock-render] post-api start")
}

/**
 * @param {string} label
 * @param {number} ms
 */
export function recordRenderPhase(label, ms) {
  const rounded = Math.round(ms)
  phases[label] = rounded
  console.log(`[stock-render] ${label}: ${rounded}ms`)
}

export function beginComputePass() {
  computeSink = { scoreMs: 0, statusMs: 0, enrichOtherMs: 0, count: 0 }
}

export function flushComputePass() {
  if (!computeSink) return
  if (computeSink.scoreMs > 0) {
    recordRenderPhase("score calc", computeSink.scoreMs)
  }
  if (computeSink.statusMs > 0) {
    recordRenderPhase("status calc", computeSink.statusMs)
  }
  if (computeSink.enrichOtherMs > 0) {
    recordRenderPhase("enrich other", computeSink.enrichOtherMs)
  }
  computeSink = null
}

/** @param {"score" | "status" | "other"} kind @param {number} ms */
export function accumulateComputeMs(kind, ms) {
  if (!computeSink) return
  if (kind === "score") computeSink.scoreMs += ms
  else if (kind === "status") computeSink.statusMs += ms
  else computeSink.enrichOtherMs += ms
  computeSink.count += 1
}

/**
 * @param {string} component
 * @param {number} ms
 * @param {{ count?: number }} [meta]
 */
export function recordComponentMount(component, ms, meta = {}) {
  const rounded = Math.round(ms)
  const key = `${component} render`
  phases[key] = rounded
  if (meta.count != null) {
    phases[`${component} count`] = meta.count
  }
  console.log(`[stock-render] ${key}: ${rounded}ms`, meta.count != null ? { count: meta.count } : "")
  if (rounded > slowestComponentMs) {
    slowestComponentMs = rounded
    slowestComponent = component
  }
}

export function getStockPickRenderPhases() {
  return { ...phases }
}

/**
 * @param {{ apiFetchMs?: number | null; firstPaintMs?: number | null }} [ctx]
 */
export function buildRenderPerfAnalysis(ctx = {}) {
  const apiFetchMs = ctx.apiFetchMs ?? 0
  const firstPaintMs = ctx.firstPaintMs ?? 0
  const postApiMs =
    postApiAt != null && typeof performance !== "undefined"
      ? Math.round(performance.now() - postApiAt)
      : Math.max(0, firstPaintMs - apiFetchMs)

  const computeMs =
    (phases["view build"] ?? 0) +
    (phases["score calc"] ?? 0) +
    (phases["status calc"] ?? 0) +
    (phases["enrich other"] ?? 0) +
    (phases["filter live"] ?? 0) +
    (phases["sort"] ?? 0) +
    (phases["country split+sort"] ?? 0)

  const renderMs =
    (phases["top5 render"] ?? 0) +
    (phases["sector render"] ?? 0) +
    (phases["all cards render"] ?? 0)

  const segmentList = [
    ["api fetch", apiFetchMs],
    ["view build", phases["view build"] ?? 0],
    ["score calc", phases["score calc"] ?? 0],
    ["status calc", phases["status calc"] ?? 0],
    ["sort", (phases["sort"] ?? 0) + (phases["country split+sort"] ?? 0)],
    ["cache save", phases["cache save"] ?? 0],
    ["top5 render", phases["top5 render"] ?? 0],
    ["sector render", phases["sector render"] ?? 0],
    ["all cards render", phases["all cards render"] ?? 0],
    ["post-api total", postApiMs],
    ["first paint", firstPaintMs],
  ].filter(([, ms]) => ms > 0)

  const slowest = segmentList.length
    ? segmentList.reduce((a, b) => (b[1] > a[1] ? b : a))
    : ["none", 0]

  const functionPhases = [
    ["buildStockPickViews", phases["view build"] ?? 0],
    ["computeStockScores", phases["score calc"] ?? 0],
    ["deriveStatusFromSnapshot", phases["status calc"] ?? 0],
    ["assignRanks/sort", (phases["sort"] ?? 0) + (phases["country split+sort"] ?? 0)],
  ].filter(([, ms]) => ms > 0)

  const slowestFn = functionPhases.length
    ? functionPhases.reduce((a, b) => (b[1] > a[1] ? b : a))
    : ["none", 0]

  const apiBottleneck = apiFetchMs >= postApiMs && apiFetchMs >= renderMs
  const renderBottleneck = !apiBottleneck && (computeMs + renderMs) >= apiFetchMs

  let expectedImprovement = ""
  if ((phases["all cards render"] ?? 0) > 500) {
    expectedImprovement =
      "전체 카드 lazy mount 시 first paint 약 " +
      `${phases["all cards render"]}ms 단축 가능`
  } else if ((phases["view build"] ?? 0) + (phases["score calc"] ?? 0) > 1500) {
    expectedImprovement =
      "49종 enrich 분리·메모이제이션 시 계산 구간 약 " +
      `${(phases["view build"] ?? 0) + (phases["score calc"] ?? 0)}ms 단축 가능`
  } else if ((phases["cache save"] ?? 0) > 300) {
    expectedImprovement = "캐시 저장 idle 지연으로 post-api 약 " + `${phases["cache save"]}ms 단축`
  } else if ((phases["top5 render"] ?? 0) > 800) {
    expectedImprovement =
      "비활성 국가 패널 지연 마운트 시 top5 render 약 " +
      `${Math.round((phases["top5 render"] ?? 0) * 0.5)}ms 단축 가능`
  }

  return {
    postApiMs,
    computeMs,
    renderMs,
    phases: { ...phases },
    apiBottleneck,
    renderBottleneck,
    slowestSegment: slowest[0],
    slowestSegmentMs: slowest[1],
    slowestFunction: slowestFn[0],
    slowestFunctionMs: slowestFn[1],
    slowestComponent,
    slowestComponentMs,
    expectedImprovement,
  }
}
