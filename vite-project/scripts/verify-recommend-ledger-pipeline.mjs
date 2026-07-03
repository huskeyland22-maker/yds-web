/**
 * 영구 추천 원장 파이프라인 검증 (Node — localStorage mock + 실제 엔진)
 * 실행: node vite-project/scripts/verify-recommend-ledger-pipeline.mjs
 */

import { pathToFileURL } from "node:url"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcRoot = path.resolve(__dirname, "../src")

if (!import.meta.env || import.meta.env.DEV === undefined) {
  Object.defineProperty(import.meta, "env", {
    value: { DEV: false, PROD: true, MODE: "production" },
    configurable: true,
  })
}

/** @type {Map<string, string>} */
const mem = new Map()
globalThis.localStorage = {
  getItem: (k) => mem.get(k) ?? null,
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
}

const importSrc = (rel) => import(pathToFileURL(path.join(srcRoot, rel)).href)

const { VALIDATION_PICKS_KEY, saveValidationPicks, loadValidationPicks } = await importSrc(
  "content/ydsValidationStorage.js",
)
const { captureTodayPickSnapshots, refreshValidationPicks } = await importSrc(
  "content/ydsValidationEngine.js",
)
const { buildValidationPriceMap } = await importSrc("content/ydsValidationPriceResolver.js")
const { buildHubHistoryViewRows } = await importSrc("content/ydsHubHistoryViewEngine.js")
const { buildRecommendPerfReport } = await importSrc("content/ydsRecommendPerfReportEngine.js")
const { buildAiTrackRecordReport } = await importSrc("content/ydsAiTrackRecordEngine.js")
const { sealNewRecommendLedgerRecord } = await importSrc("content/ydsRecommendLedger.js")
const { normalizePickRecord } = await importSrc("content/ydsValidationStorage.js")
const { todayDateKey } = await importSrc("content/ydsPortfolioTradesStorage.js")

/** @type {{ id: string; ok: boolean; detail: string }[]} */
const results = []

function pass(id, detail) {
  results.push({ id, ok: true, detail })
  console.log(`✅ [${id}] ${detail}`)
}

function fail(id, detail) {
  results.push({ id, ok: false, detail })
  console.error(`❌ [${id}] ${detail}`)
}

function assert(cond, id, detail) {
  if (cond) pass(id, detail)
  else fail(id, detail)
}

/** @returns {import("../src/content/ydsStockPickModel.js").StockPickView} */
function mockAmdStock(price, rank = 1) {
  return {
    ticker: "AMD",
    name: "AMD",
    country: "US",
    rank,
    dataSource: "live",
    score: 93,
    snapshot: { price, close: price },
    v4Score: {
      finalRankScore: 93,
      total: 93,
      qualityDisplayGrade: "A+",
      qualityGrade: "A+",
      timingGrade: "A",
      quality: 88,
      timing: 82,
    },
    scoreBreakdown: { quality: 88, timing: 82, marketEnv: 12 },
    stockStatus: { id: "trend", label: "상승 추세" },
    recommendRationales: [
      { id: "r1", category: "theme", source: "ai", score: 9, max: 10, text: "AI 서버 투자 확대" },
    ],
    recommendEngine: { compositeScore: 93 },
  }
}

const marketContext = {
  macroId: "neutral",
  strategyLabel: "조정안정",
  unifiedMarketStateLabel: "조정안정",
  marketStateLabel: "조정안정",
  ydsScore: 35,
  panicLabel: "안정",
  cycleStageId: "recovery",
  cycleLabel: "회복 초기",
}

const panicData = { vix: 18.5, fearGreed: 52, bofa: 4.2 }

const today = todayDateKey()
const yesterday = (() => {
  const d = new Date(`${today}T12:00:00`)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
})()

mem.clear()

// ── 시나리오 1: 오늘 AMD 추천 → 원장 저장 ─────────────────────────────
const amd517 = mockAmdStock(517.8)
captureTodayPickSnapshots(marketContext, 10, [amd517], { panicData })

let picks = loadValidationPicks()
const amdToday = picks.filter((p) => p.ticker === "AMD" && p.recommendedAt === today)

assert(amdToday.length === 1, "S1-count", `오늘 AMD 추천 1건 저장 (실제 ${amdToday.length}건)`)

const rec1 = amdToday[0]
if (rec1) {
  assert(rec1.id.startsWith("rec-"), "S1-rec-id", `rec-ID 형식: ${rec1.id}`)
  assert(rec1.immutableSealed === true, "S1-sealed", "immutableSealed=true")
  assert(rec1.recommendedPrice === 517.8, "S1-price", `추천가 517.80 (실제 ${rec1.recommendedPrice})`)
  assert(rec1.lockedRecommendedPrice === 517.8, "S1-locked-price", `잠금 추천가 517.80`)
  assert(
    rec1.recommendedScore === 93 || Math.round(rec1.recommendedScore) === 93,
    "S1-score",
    `AI점수 93 (실제 ${rec1.recommendedScore})`,
  )
  assert(
    rec1.marketLedger?.marketStateLabel === "조정안정" ||
      rec1.recommendSnapshot?.marketStateLabel === "조정안정",
    "S1-market",
    `시장상태 조정안정 (ledger=${rec1.marketLedger?.marketStateLabel})`,
  )
  assert(
    rec1.marketLedger?.panicIntensity === 35,
    "S1-panic",
    `패닉강도 35 (실제 ${rec1.marketLedger?.panicIntensity})`,
  )
  assert(Boolean(rec1.recommendedAtIso), "S1-datetime", `추천일시 ${rec1.recommendedAtIso}`)
}

// ── 시나리오 2: 현재가 변경 → 수익률 계산, 추천가 불변 ─────────────────
const amd534 = mockAmdStock(534.2)
const priceMap1 = buildValidationPriceMap([amd534])
picks = refreshValidationPicks(loadValidationPicks(), priceMap1, {
  liveStocks: [amd534],
  marketContext,
  panicData,
})

const afterRefresh1 = picks.find((p) => p.id === rec1?.id)
if (afterRefresh1 && rec1) {
  const expectedRet = Math.round(((534.2 - 517.8) / 517.8) * 1000) / 10
  assert(afterRefresh1.recommendedPrice === 517.8, "S2-price-locked", `추천가 유지 517.80`)
  assert(afterRefresh1.currentPrice === 534.2, "S2-current", `현재가 534.20`)
  assert(
    afterRefresh1.returnPct != null && Math.abs(afterRefresh1.returnPct - expectedRet) < 0.15,
    "S2-return",
    `수익률 ~+3.2% (실제 ${afterRefresh1.returnPct}%, 기대 ${expectedRet}%)`,
  )
}

// ── 시나리오 3: 다음 거래일 시뮬 — 추천가 유지, 현재가만 갱신 ───────────
// 어제 추천 기록을 만들고 오늘 가격으로 refresh (동일 refresh 경로)
const draftYesterday = normalizePickRecord({
  ticker: "AMD",
  name: "AMD",
  country: "US",
  rank: 1,
  isTop3: true,
  recommendedAt: yesterday,
  recommendedPrice: 500,
  recommendedScore: 90,
  qualityGrade: "A",
  timingGrade: "B+",
  marketFitGrade: "A",
  statusId: "trend",
  statusLabel: "상승 추세",
  currentPrice: null,
  returnPct: null,
  priceLog: { [yesterday]: 500 },
  regimeId: "neutral",
  regimeLabel: "조정안정",
  strategyLabel: "조정안정",
  recommendSnapshot: {
    name: "AMD",
    recommendedAt: yesterday,
    recommendedPrice: 500,
    totalScore: 90,
    qualityGrade: "A",
    timingGrade: "B+",
    marketFitGrade: "A",
    marketStateLabel: "조정안정",
    panicIntensity: 30,
    panicLabel: "안정",
    capturedAt: yesterday,
    frozen: true,
  },
  recordedAt: Date.now() - 86400000,
})
const sealedYesterday = sealNewRecommendLedgerRecord(draftYesterday, marketContext, panicData)
const allWithYesterday = [...loadValidationPicks().filter((p) => p.id !== sealedYesterday.id), sealedYesterday]
saveValidationPicks(allWithYesterday)

const amd510 = mockAmdStock(510)
const priceMap2 = buildValidationPriceMap([amd534])
picks = refreshValidationPicks(loadValidationPicks(), priceMap2, {
  liveStocks: [amd534],
  marketContext,
})

const yPick = picks.find((p) => p.recommendedAt === yesterday && p.ticker === "AMD")
if (yPick) {
  const livePrice = 534.2
  const expectedRet3 = Math.round(((livePrice - 500) / 500) * 1000) / 10
  assert(yPick.recommendedPrice === 500, "S3-price", `어제 추천가 500 유지 (실제 ${yPick.recommendedPrice})`)
  assert(yPick.lockedRecommendedPrice === 500, "S3-locked", `잠금가 500 유지`)
  assert(
    yPick.currentPrice === livePrice,
    "S3-current",
    `현재가 ${livePrice} 갱신 (실제 ${yPick.currentPrice})`,
  )
  assert(
    yPick.returnPct != null && Math.abs(yPick.returnPct - expectedRet3) < 0.15,
    "S3-return",
    `수익률 ${expectedRet3}% (실제 ${yPick.returnPct}%) — 추천가 고정·현재가만 반영`,
  )
}

// ── 시나리오 4: 같은 AMD 재추천 → 새 rec-ID, 기존 미수정 ─────────────────
const idBefore = rec1?.id
const priceBeforeReRec = afterRefresh1?.recommendedPrice

// 다음 거래일 시뮬: hasAutoCapturePickToday는 날짜별 — 어제 기록만 있으면 오늘 재캡처 가능
// 오늘 rec1이 이미 있으므로, 다른 날짜로 시뮬
const nextDay = (() => {
  const d = new Date(`${today}T12:00:00`)
  d.setDate(d.getDate() + 14)
  return d.toISOString().slice(0, 10)
})()

// 수동으로 14일 후 AMD 추천 추가 (capture는 today만 사용하므로 직접 seal)
const draftReRec = normalizePickRecord({
  ticker: "AMD",
  name: "AMD",
  country: "US",
  rank: 2,
  isTop3: true,
  recommendedAt: nextDay,
  recommendedPrice: 545,
  recommendedScore: 91,
  qualityGrade: "A+",
  timingGrade: "A",
  marketFitGrade: "A",
  statusId: "trend",
  statusLabel: "상승 추세",
  priceLog: { [nextDay]: 545 },
  regimeId: "neutral",
  regimeLabel: "조정안정",
  strategyLabel: "조정안정",
  recommendSnapshot: {
    name: "AMD",
    recommendedAt: nextDay,
    recommendedPrice: 545,
    totalScore: 91,
    marketStateLabel: "조정안정",
    panicIntensity: 40,
    panicLabel: "안정",
    capturedAt: nextDay,
    frozen: true,
  },
  recordedAt: Date.now() + 14 * 86400000,
})
const sealedReRec = sealNewRecommendLedgerRecord(draftReRec, marketContext, panicData)
const merged = [...loadValidationPicks(), sealedReRec]
saveValidationPicks(merged)

picks = loadValidationPicks()
const amdAll = picks.filter((p) => p.ticker === "AMD")
const rec1After = picks.find((p) => p.id === idBefore)

assert(amdAll.length >= 2, "S4-count", `AMD 추천 ${amdAll.length}건 (기존+신규)`)
assert(sealedReRec.id !== idBefore, "S4-new-id", `신규 rec-ID ${sealedReRec.id} ≠ 기존 ${idBefore}`)
assert(
  rec1After?.recommendedPrice === priceBeforeReRec,
  "S4-old-intact",
  `기존 기록 추천가 ${rec1After?.recommendedPrice} 유지`,
)

// ── 시나리오 5: Track Record에 AMD 2건+ 표시 ───────────────────────────
const liveStocks = [amd534]
const trackReport = buildAiTrackRecordReport(liveStocks)
const amdTrackRows = trackReport.rows.filter((r) => r.ticker === "AMD")

assert(trackReport.visible === true, "S5-visible", "Track Record visible")
assert(amdTrackRows.length >= 2, "S5-amd-rows", `Track Record AMD ${amdTrackRows.length}건`)

// ── 시나리오 6: 3화면 표시값 일치 ───────────────────────────────────────
const hubRows = buildHubHistoryViewRows(liveStocks)
const perfReport = buildRecommendPerfReport(picks, 0, liveStocks)

function rowDisplay(pickId) {
  const hub = hubRows.find((r) => r.pickId === pickId)
  const perf = perfReport.recentPicks.find((r) => {
    const p = picks.find((x) => x.id === pickId)
    return p && r.ticker === p.ticker && r.recommendedAt === hub?.recommendedAtLabel
  })
  const track = trackReport.rows.find((r) => r.pickId === pickId)
  return { hub, perf, track }
}

let s6ok = true
const s6details = []

for (const pick of amdAll.slice(0, 3)) {
  const { hub, perf, track } = rowDisplay(pick.id)
  if (!hub || !track) {
    s6ok = false
    s6details.push(`${pick.id}: hub=${!!hub} track=${!!track}`)
    continue
  }
  const fields = [
    ["추천일", hub.recommendedAtLabel, track.recommendedAtLabel, perf?.recommendedAt],
    ["추천가", hub.recommendedPriceLabel, track.recommendedPriceLabel, perf?.recommendedPrice],
    ["현재가", hub.currentPriceLabel, track.currentPriceLabel, perf?.currentPrice],
    ["수익률", hub.returnLabel, track.returnLabel, perf?.returnLabel],
    ["D+N", hub.elapsedLabel, track.elapsedLabel, perf?.elapsedLabel],
  ]
  for (const [name, h, t, p] of fields) {
    if (h !== t) {
      s6ok = false
      s6details.push(`${pick.ticker} ${name}: hub≠track (${h} vs ${t})`)
    }
    if (p != null && p !== h) {
      s6ok = false
      s6details.push(`${pick.ticker} ${name}: hub≠perf (${h} vs ${p})`)
    }
  }
}

assert(
  s6ok,
  "S6-consistency",
  s6ok ? "히스토리·성과리포트·Track Record 표시값 일치" : s6details.join("; "),
)

// ── 요약 ─────────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.ok)
console.log("\n========== 영구 추천 원장 파이프라인 검증 ==========")
console.log(`총 ${results.length}항목 · 성공 ${results.length - failed.length} · 실패 ${failed.length}`)
if (failed.length) {
  console.log("\n실패 항목:")
  for (const f of failed) console.log(`  - ${f.id}: ${f.detail}`)
  process.exit(1)
}
console.log("\n파이프라인: 추천 → 저장 → 수익률 계산 → Track Record ✅ 정상")
process.exit(0)
