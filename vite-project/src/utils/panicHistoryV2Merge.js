/**
 * panic_history_v2 API rows → cycleMetricHistory 병합
 */

function toNum(v) {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * @param {object[]} cycleRows
 * @param {object[]} v2Rows — panicHistoryV2RowToClient 형태
 */
export function mergePanicHistoryV2IntoCycleRows(cycleRows, v2Rows) {
  if (!Array.isArray(cycleRows) || !cycleRows.length) return cycleRows ?? []
  if (!Array.isArray(v2Rows) || !v2Rows.length) return cycleRows

  const byDate = new Map(
    v2Rows
      .filter((r) => r?.date && toNum(r.panicV2 ?? r.panic_v2) != null)
      .map((r) => [String(r.date).slice(0, 10), r]),
  )

  return cycleRows.map((row) => {
    const date = String(row?.date ?? "").slice(0, 10)
    const hit = byDate.get(date)
    if (!hit) return row
    const score = toNum(hit.panicV2 ?? hit.panic_v2)
    return {
      ...row,
      vix: row.vix ?? hit.vix,
      vxn: row.vxn ?? hit.vxn,
      fearGreed: row.fearGreed ?? hit.fearGreed,
      putCall: row.putCall ?? hit.putCall,
      highYield: row.highYield ?? hit.highYield ?? hit.hy,
      move: row.move ?? hit.move,
      skew: row.skew ?? hit.skew,
      gsBullBear: row.gsBullBear ?? hit.gsBullBear ?? hit.gs,
      bofa: row.bofa ?? hit.bofa,
      panicV2Score: score,
      panicV2DynamicScore: score,
      panic_v2: score,
    }
  })
}

/** @param {object[]} rows */
export function countPanicV2ScoredRows(rows) {
  if (!Array.isArray(rows)) return 0
  return rows.filter((r) => Number.isFinite(Number(r.panicV2DynamicScore ?? r.panicV2Score ?? r.panic_v2))).length
}
