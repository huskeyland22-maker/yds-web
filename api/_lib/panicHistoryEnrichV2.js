/**
 * panic_index_history API 응답 — panic_v2 보강 (DB V2 + 실전 레벨 점수)
 */
import { cycleRowFromHistorySource, fetchPanicHistoryV2Rows } from "./panicHistoryV2Db.js"
import { computePanicV2LevelScore } from "./panicV2LevelScore.js"

/**
 * @param {object} clientRow — mapPanicIndexHistoryRowToClient 결과
 * @param {number | null | undefined} storedV2 — panic_history_v2 저장값
 */
export function resolvePanicV2ForHistoryRow(clientRow, storedV2) {
  if (storedV2 != null && Number.isFinite(Number(storedV2))) {
    return Math.round(Number(storedV2))
  }

  const cycle = cycleRowFromHistorySource({
    date: clientRow.date,
    vix: clientRow.vix,
    vxn: clientRow.vxn,
    fear_greed: clientRow.fearGreed,
    put_call: clientRow.putCall,
    move: clientRow.move,
    bofa: clientRow.bofa,
    skew: clientRow.skew,
    hy_oas: clientRow.highYield ?? clientRow.hyOas,
    gs_sentiment: clientRow.gsBullBear ?? clientRow.gsSentiment,
    vvix: clientRow.vvix,
    vix_term: clientRow.vixTerm,
    ndx_distance: clientRow.ndxDistance,
    soxx_distance: clientRow.soxxDistance,
    dxy: clientRow.dxy,
  })

  const practical = {
    ...(cycle ?? clientRow),
    vvix: clientRow.vvix ?? cycle?.vvix,
    vixTerm: clientRow.vixTerm ?? cycle?.vixTerm,
    ndxDistance: clientRow.ndxDistance ?? cycle?.ndxDistance,
    soxxDistance: clientRow.soxxDistance ?? cycle?.soxxDistance,
    dxy: clientRow.dxy ?? cycle?.dxy,
    putCall: clientRow.putCall ?? cycle?.putCall,
    move: clientRow.move ?? cycle?.move,
    vix: clientRow.vix ?? cycle?.vix,
  }

  const { score } = computePanicV2LevelScore(practical)
  return score != null ? score : null
}

/**
 * @param {object[]} clientRows
 */
export function attachPanicV2ToHistoryRow(clientRow, storedV2) {
  const panic_v2 = resolvePanicV2ForHistoryRow(clientRow, storedV2)
  if (panic_v2 == null) return clientRow
  return {
    ...clientRow,
    panic_v2,
    panicV2: panic_v2,
    panicV2Score: panic_v2,
    panicV2DynamicScore: panic_v2,
  }
}

/**
 * @param {object[]} clientRows
 */
export async function enrichPanicIndexHistoryWithV2(clientRows) {
  if (!Array.isArray(clientRows) || !clientRows.length) return []

  let v2ByDate = new Map()
  try {
    const v2Rows = await fetchPanicHistoryV2Rows({ limit: 500 })
    v2ByDate = new Map(
      v2Rows
        .filter((r) => r?.date && r.panicV2 != null)
        .map((r) => [String(r.date).slice(0, 10), r]),
    )
  } catch (err) {
    console.warn("[panic] enrichPanicIndexHistoryWithV2 v2 fetch skipped", err)
  }

  return clientRows.map((row) => {
    const date = String(row?.date ?? "").slice(0, 10)
    const hit = v2ByDate.get(date)
    const merged = hit
      ? {
          ...row,
          vvix: row.vvix ?? hit.vvix,
          vixTerm: row.vixTerm ?? hit.vixTerm,
          ndxDistance: row.ndxDistance ?? hit.ndxDistance,
          soxxDistance: row.soxxDistance ?? hit.soxxDistance,
          dxy: row.dxy ?? hit.dxy,
        }
      : row
    return attachPanicV2ToHistoryRow(merged, hit?.panicV2 ?? hit?.panic_v2)
  })
}
