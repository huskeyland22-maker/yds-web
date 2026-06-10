/**
 * 모바일 첫 진입 타임라인 — BOOT → FIRST_PAINT 구간 ms·비율
 */

/** @type {Record<string, number>} */
const marks = {}

/** @type {number} */
let originMs = typeof performance !== "undefined" ? performance.now() : Date.now()

/** @type {boolean} */
let reported = false

export function resetFirstEntryTimeline() {
  reported = false
  for (const key of Object.keys(marks)) delete marks[key]
  originMs = typeof performance !== "undefined" ? performance.now() : Date.now()
  markTimeline("BOOT")
}

/**
 * @param {string} label
 * @param {{ segment?: 'sw' | 'hydration' | 'supabase' | 'stockApi' | 'other' }} [meta]
 */
export function markTimeline(label, meta = {}) {
  const ms = Math.round(
    (typeof performance !== "undefined" ? performance.now() : Date.now()) - originMs,
  )
  marks[label] = ms
  console.log(`[BOOT_TIMELINE] ${label}: ${ms}ms`, meta.segment ? { segment: meta.segment } : "")
}

export function getTimelineMarks() {
  return { ...marks }
}

function span(startLabel, endLabel) {
  const a = marks[startLabel]
  const b = marks[endLabel]
  if (a == null || b == null) return 0
  return Math.max(0, b - a)
}

/**
 * @param {{ apiCount?: number }} [extra]
 */
export function emitFirstEntryTimelineReport(extra = {}) {
  if (reported) return null
  reported = true

  const totalMs = marks.FIRST_PAINT ?? marks.FIRST_RENDER ?? marks.API_END ?? marks.BOOT ?? 0

  const swMs = Math.max(
    span("BOOT", "SW_END"),
    marks.SW_END != null && marks.SW_START != null ? marks.SW_END - marks.SW_START : 0,
  )
  const hydrationMs = span("HYDRATE_START", "HYDRATE_END")
  const supabaseMs = Math.max(
    span("SUPABASE_START", "SUPABASE_END"),
    span("HYDRATE_START", "HYDRATE_END") > 0 ? 0 : span("BOOT", "SUPABASE_END"),
  )
  const stockApiMs = span("API_START", "API_END")

  const denom = totalMs > 0 ? totalMs : 9000
  const pct = (ms) => Math.round((ms / denom) * 1000) / 10

  const report = {
    totalMs: denom,
    marks: { ...marks },
    segments: {
      sw: { ms: swMs, pct: pct(swMs) },
      hydration: { ms: hydrationMs, pct: pct(hydrationMs) },
      supabase: { ms: supabaseMs, pct: pct(supabaseMs) },
      stockApi: { ms: stockApiMs, pct: pct(stockApiMs) },
      other: {
        ms: Math.max(0, denom - swMs - hydrationMs - supabaseMs - stockApiMs),
        pct: pct(Math.max(0, denom - swMs - hydrationMs - supabaseMs - stockApiMs)),
      },
    },
    apiCount: extra.apiCount ?? null,
    postApiRenderMs:
      marks.FIRST_PAINT != null && marks.API_END != null
        ? marks.FIRST_PAINT - marks.API_END
        : null,
  }

  console.log("[BOOT_TIMELINE] === 첫 진입 분해 ===", report)
  console.log(
    `[BOOT_TIMELINE] ${denom}ms 중 SW ${report.segments.sw.pct}% | Hydration ${report.segments.hydration.pct}% | Supabase ${report.segments.supabase.pct}% | Stock API ${report.segments.stockApi.pct}% | 기타 ${report.segments.other.pct}%`,
  )
  if (extra.apiCount != null) {
    console.log("[API_COUNT]", extra.apiCount)
  }
  return report
}
