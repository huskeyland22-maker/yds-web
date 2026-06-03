import { YDS_MILESTONE_ORDER } from "./ydsHistoricalEventTypes.js"

/** 검증 페이지 전용 — milestone 시계열 보간 */
export function parsePrecursorDay(iso) {
  return new Date(`${String(iso).slice(0, 10)}T12:00:00`).getTime()
}

export function offsetPrecursorDay(iso, days) {
  const d = new Date(parsePrecursorDay(iso))
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData} event
 */
export function getEventMilestoneSeries(event) {
  return YDS_MILESTONE_ORDER.map((key) => {
    const m = event?.milestones?.[key]
    if (!m?.date) return null
    return {
      key,
      date: m.date.slice(0, 10),
      ts: parsePrecursorDay(m.date),
      historyData: m.historyData ?? {},
    }
  })
    .filter(Boolean)
    .sort((a, b) => a.ts - b.ts)
}

/**
 * @param {ReturnType<typeof getEventMilestoneSeries>} series
 * @param {string} targetDate
 * @param {string[]} metricKeys
 */
export function interpolateMetricsAtDate(series, targetDate, metricKeys) {
  if (!series.length) return null
  const targetTs = parsePrecursorDay(targetDate)

  if (targetTs <= series[0].ts) {
    const base = { date: targetDate, _clamp: "before" }
    for (const key of metricKeys) base[key] = series[0].historyData[key] ?? null
    return base
  }
  if (targetTs >= series[series.length - 1].ts) {
    const base = { date: targetDate, _clamp: "after" }
    for (const key of metricKeys) base[key] = series[series.length - 1].historyData[key] ?? null
    return base
  }

  for (let i = 0; i < series.length - 1; i += 1) {
    const a = series[i]
    const b = series[i + 1]
    if (targetTs >= a.ts && targetTs <= b.ts) {
      const span = b.ts - a.ts
      const t = span === 0 ? 0 : (targetTs - a.ts) / span
      /** @type {Record<string, number | null>} */
      const out = { date: targetDate }
      for (const key of metricKeys) {
        const va = a.historyData[key]
        const vb = b.historyData[key]
        if (va == null && vb == null) out[key] = null
        else if (va == null) out[key] = vb
        else if (vb == null) out[key] = va
        else out[key] = va + t * (vb - va)
      }
      return out
    }
  }
  return null
}

/** MOVE 미수집 milestone — VIX 기반 검증용 근사 (프로덕션 미사용) */
export function estimateMoveFromVix(vix) {
  const v = Number(vix)
  if (!Number.isFinite(v)) return null
  return Math.round(78 + Math.max(0, v - 12) * 1.85)
}
