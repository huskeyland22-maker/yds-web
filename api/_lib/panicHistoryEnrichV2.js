/**
 * panic_index_history API 응답 — panic_v2 보강
 * stored V2 우선 · 없을 때만 Hero/신규 스냅샷과 동일 3지표 getPanicScoreV2.
 * level-score(computePanicV2LevelScore)는 panic_v2에 혼합하지 않음 (backfill 경로 보존).
 */
import { fetchPanicHistoryV2Rows } from "./panicHistoryV2Db.js"
import { getPanicScoreV2 } from "./panicScores.js"

/**
 * @param {object} clientRow — mapPanicIndexHistoryRowToClient 결과
 * @param {number | null | undefined} storedV2 — panic_history_v2 저장값
 */
export function resolvePanicV2ForHistoryRow(clientRow, storedV2) {
  if (storedV2 != null && Number.isFinite(Number(storedV2))) {
    return Math.round(Number(storedV2))
  }

  return getPanicScoreV2({
    vix: clientRow?.vix,
    fearGreed: clientRow?.fearGreed,
    putCall: clientRow?.putCall,
  })
}

/**
 * @param {object} clientRow
 * @param {number | null | undefined} storedV2
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
