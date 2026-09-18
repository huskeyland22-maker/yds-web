/**
 * 신규 Panic V2 end-to-end 일관성 (DB 미기록 · 과거 데이터 미수정)
 *
 * raw → getPanicScoreV2 → snapshot 저장 payload → history/history-v2 응답 shape
 * → History chart (panicIntensityScoreForRow / getFinalScore)
 *
 * Usage: node scripts/panic-v2-snapshot-save.test.mjs
 */
import assert from "node:assert/strict"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import {
  getFinalScore,
  getPanicScoreV2 as clientGetPanicScoreV2,
} from "../vite-project/src/utils/tradingScores.js"
import { panicIntensityScoreForRow } from "../vite-project/src/content/ydsMarketTrendSeries.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const { getPanicScoreV2: apiGetPanicScoreV2 } = await import(
  pathToFileURL(join(root, "api/_lib/panicScores.js")).href,
)
const {
  resolveNewSnapshotPanicV2Score,
  panicIndexHistoryV2DbRow,
  panicHistoryV2RowToClient,
  cycleRowFromHistorySource,
} = await import(pathToFileURL(join(root, "api/_lib/panicHistoryV2Db.js")).href)
const { attachPanicV2ToHistoryRow, resolvePanicV2ForHistoryRow } = await import(
  pathToFileURL(join(root, "api/_lib/panicHistoryEnrichV2.js")).href,
)
const { mapPanicIndexHistoryRowToClient } = await import(
  pathToFileURL(join(root, "api/_lib/panicIndexHistoryColumns.js")).href,
)

const RAW = {
  date: "2099-01-15", // synthetic — never written to DB
  vix: 22.22,
  fearGreed: 27,
  putCall: 0.71,
  move: 77.15, // must not affect V2
  bofa: 6.6,
  highYield: 2.82,
}

const EXPECTED = 42

// 1) raw → getPanicScoreV2 (client + api)
const scoreClient = clientGetPanicScoreV2(RAW)
const scoreApi = apiGetPanicScoreV2(RAW)
assert.equal(scoreClient, EXPECTED)
assert.equal(scoreApi, EXPECTED)
assert.equal(scoreApi, scoreClient)

// 2) snapshot save path score
const scoreSnap = resolveNewSnapshotPanicV2Score(RAW)
assert.equal(scoreSnap, EXPECTED)

// 3) DB row payload panic_v2 / panic_index_v2 (no network upsert)
const cycle = cycleRowFromHistorySource({
  date: RAW.date,
  vix: RAW.vix,
  fear_greed: RAW.fearGreed,
  put_call: RAW.putCall,
  move: RAW.move,
  bofa: RAW.bofa,
  hy_oas: RAW.highYield,
})
const dbRow = panicIndexHistoryV2DbRow(cycle, scoreSnap, "e2e_dry_run")
assert.ok(dbRow)
assert.equal(dbRow.panic_index_v2, EXPECTED)
assert.equal(dbRow.vix, RAW.vix)
assert.equal(dbRow.fear_greed, RAW.fearGreed)
assert.equal(dbRow.put_call, RAW.putCall)

// 4) history-v2 API client shape
const historyV2Client = panicHistoryV2RowToClient(dbRow)
assert.equal(historyV2Client.panicV2, EXPECTED)
assert.equal(historyV2Client.panic_v2, EXPECTED)
assert.equal(historyV2Client.panicV2Score, EXPECTED)

// 5) /api/panic/history enrich: stored V2 wins
const indexClient = mapPanicIndexHistoryRowToClient({
  date: RAW.date,
  vix: RAW.vix,
  fear_greed: RAW.fearGreed,
  put_call: RAW.putCall,
  move: RAW.move,
  bofa: RAW.bofa,
  hy_oas: RAW.highYield,
})
const enriched = attachPanicV2ToHistoryRow(indexClient, historyV2Client.panicV2)
assert.equal(resolvePanicV2ForHistoryRow(indexClient, historyV2Client.panicV2), EXPECTED)
assert.equal(enriched.panicV2, EXPECTED)
assert.equal(enriched.panic_v2, EXPECTED)
assert.equal(enriched.panicV2Score, EXPECTED)

// 6) History chart transform (raw → getFinalScore / panicIntensityScoreForRow)
const chartFromFinal = getFinalScore({
  vix: RAW.vix,
  fearGreed: RAW.fearGreed,
  putCall: RAW.putCall,
  move: RAW.move,
  bofa: RAW.bofa,
  highYield: RAW.highYield,
})
const chartFromIntensity = panicIntensityScoreForRow({
  date: RAW.date,
  vix: RAW.vix,
  fearGreed: RAW.fearGreed,
  putCall: RAW.putCall,
  move: RAW.move,
  bofa: RAW.bofa,
  highYield: RAW.highYield,
  panicV2: enriched.panicV2, // chart must ignore stored field and recompute from raw
})
assert.equal(chartFromFinal, EXPECTED)
assert.equal(chartFromIntensity, EXPECTED)

// End-to-end equality
const chain = {
  getPanicScoreV2: scoreClient,
  upsertScore: scoreSnap,
  db_panic_index_v2: dbRow.panic_index_v2,
  historyV2_api: historyV2Client.panicV2,
  history_api_enriched: enriched.panicV2,
  history_chart: chartFromIntensity,
}
for (const [k, v] of Object.entries(chain)) {
  assert.equal(v, EXPECTED, `${k} !== ${EXPECTED} (got ${v})`)
}

// Regression: incomplete cores → null (no invent)
assert.equal(resolveNewSnapshotPanicV2Score({ vix: 22, fearGreed: 27 }), null)

console.log("panic-v2-snapshot-save.test.mjs E2E OK")
console.log(JSON.stringify({ raw: { vix: RAW.vix, fearGreed: RAW.fearGreed, putCall: RAW.putCall }, expected: EXPECTED, chain }, null, 2))
