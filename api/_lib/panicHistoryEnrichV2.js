/**
 * panic_index_history API 응답 — panic_v2 보강 (DB V2 + 레벨 가중치 + HY 버킷)
 */
import { cycleRowFromHistorySource, fetchPanicHistoryV2Rows } from "./panicHistoryV2Db.js"
import { computePanicV2LevelScore } from "./panicV2LevelScore.js"

/** @param {number | null | undefined} hy */
export function highYieldBucketScore(hy) {
  if (hy == null || !Number.isFinite(Number(hy))) return null
  const h = Number(hy)
  if (h <= 3) return 15
  if (h <= 4) return 30
  if (h <= 5) return 50
  return 70
}

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
  })

  const { score: levelScore } = computePanicV2LevelScore(cycle ?? clientRow)
  const hyBucket = highYieldBucketScore(clientRow.highYield ?? clientRow.hyOas)

  if (levelScore != null && hyBucket != null) {
    return Math.round(Math.max(0, Math.min(100, (levelScore + hyBucket) / 2)))
  }
  if (levelScore != null) return levelScore
  if (hyBucket != null) return hyBucket
  return null
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
        .map((r) => [String(r.date).slice(0, 10), r.panicV2]),
    )
  } catch (err) {
    console.warn("[panic] enrichPanicIndexHistoryWithV2 v2 fetch skipped", err)
  }

  return clientRows.map((row) => {
    const date = String(row?.date ?? "").slice(0, 10)
    return attachPanicV2ToHistoryRow(row, v2ByDate.get(date))
  })
}
