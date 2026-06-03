import { applyEventCompletion } from "./ydsHistoricalEventCompletions.js"
import {
  buildMarketMetrics,
  buildMilestonesFromKeyDates,
} from "./ydsHistoricalEventTypes.js"
import { offsetPrecursorDay } from "./ydsPrecursorInterpolation.js"
import { PANIC_VALIDATION_EXTENDED_HISTORY } from "./panicValidationExtendedHistory.js"
import { PRODUCTION_CANDIDATE_PANIC_IDS } from "./ydsProductionCandidateV3.js"

/** Phase 3 패닉 검증 표본 (15건+) */
export const PRECURSOR_PHASE3_PANIC_IDS = [
  ...PRODUCTION_CANDIDATE_PANIC_IDS,
  "panic-2011-us-downgrade",
  "interest-2016-brexit",
  "interest-2018-trade-war",
  "overheated-2000-dotcom",
  "panic-2018-q4",
  "panic-2015-china-deval",
  "panic-2022-ukraine",
  "panic-2019-repo",
  "panic-2010-flash",
]

/** Phase 3 비패닉 — 기존 이벤트 ID */
export const PRECURSOR_PHASE3_NON_PANIC_STATIC_IDS = [
  "nonpanic-2023-ai-rally",
  "nonpanic-2024-bull-market",
  "nonpanic-2024-ath-breakout",
  "nonpanic-2025-bull-continuation",
  "nonpanic-current-market",
  "dca-2020-reopening",
  "dca-2022-h2",
  "dca-2023-post-svb",
  "dca-2024-summer-pullback",
  "overheated-2020-liquidity",
  "overheated-2023-ai-rally",
  "overheated-2024-ai-rally2",
  "interest-2024-q1",
]

const PANIC_STRESS_DATES = new Set([
  "2020-03-16",
  "2022-06-17",
  "2022-01-21",
  "2023-03-17",
  "2025-04-04",
  "2025-04-07",
  "2019-01-04",
])

/** @type {Array<{ id: string; name: string; category: "panic"; keyDates: Record<string, string>; milestones: Record<string, { historyData: object }> }>} */
const PHASE3_EXTRA_PANIC_SPECS = [
  {
    id: "panic-2018-q4",
    name: "2018 Q4 급락",
    keyDates: {
      start: "2018-10-01",
      rally: "2018-11-01",
      fearExpansion: "2018-12-14",
      extreme: "2018-12-24",
      recovery: "2019-01-18",
    },
    milestones: {
      start: { historyData: { vix: 12.0, cnn: 62, bofa: 5.9, highYield: 3.4, putCall: 0.76 } },
      rise: { historyData: { vix: 21.0, cnn: 35, bofa: 5.0, highYield: 4.2, putCall: 0.9 } },
      fearExpansion: { historyData: { vix: 30.0, cnn: 18, bofa: 4.2, highYield: 5.0, putCall: 1.0 } },
      climax: { historyData: { vix: 36.0, cnn: 12, bofa: 3.8, highYield: 5.4, putCall: 1.05 } },
      recovery: { historyData: { vix: 18.0, cnn: 42, bofa: 5.2, highYield: 4.0, putCall: 0.88 } },
    },
  },
  {
    id: "panic-2015-china-deval",
    name: "2015 중국 디플레이션 쇼크",
    keyDates: {
      start: "2015-08-01",
      rally: "2015-08-10",
      fearExpansion: "2015-08-21",
      extreme: "2015-08-24",
      recovery: "2015-10-12",
    },
    milestones: {
      start: { historyData: { vix: 13.0, cnn: 55, bofa: 5.7, highYield: 3.8, putCall: 0.8 } },
      rise: { historyData: { vix: 22.0, cnn: 32, bofa: 4.8, highYield: 4.5, putCall: 0.95 } },
      fearExpansion: { historyData: { vix: 35.0, cnn: 15, bofa: 3.9, highYield: 5.8, putCall: 1.08 } },
      climax: { historyData: { vix: 40.0, cnn: 10, bofa: 3.5, highYield: 6.2, putCall: 1.12 } },
      recovery: { historyData: { vix: 20.0, cnn: 38, bofa: 5.0, highYield: 4.6, putCall: 0.9 } },
    },
  },
  {
    id: "panic-2022-ukraine",
    name: "2022 우크라이나 침공 쇼크",
    keyDates: {
      start: "2022-02-01",
      rally: "2022-02-14",
      fearExpansion: "2022-02-24",
      extreme: "2022-03-08",
      recovery: "2022-04-01",
    },
    milestones: {
      start: { historyData: { vix: 20.0, cnn: 42, bofa: 5.2, highYield: 4.0, putCall: 0.86 } },
      rise: { historyData: { vix: 28.0, cnn: 25, bofa: 4.2, highYield: 4.8, putCall: 0.95 } },
      fearExpansion: { historyData: { vix: 37.0, cnn: 14, bofa: 3.6, highYield: 5.5, putCall: 1.04 } },
      climax: { historyData: { vix: 36.0, cnn: 16, bofa: 3.7, highYield: 5.3, putCall: 1.02 } },
      recovery: { historyData: { vix: 22.0, cnn: 35, bofa: 4.8, highYield: 4.5, putCall: 0.9 } },
    },
  },
  {
    id: "panic-2019-repo",
    name: "2019 Repo 유동성 쇼크",
    keyDates: {
      start: "2019-08-01",
      rally: "2019-09-01",
      fearExpansion: "2019-09-17",
      extreme: "2019-09-19",
      recovery: "2019-10-15",
    },
    milestones: {
      start: { historyData: { vix: 17.9, cnn: 35, bofa: 5.0, highYield: 4.0, putCall: 0.88 } },
      rise: { historyData: { vix: 16.0, cnn: 40, bofa: 5.2, highYield: 3.9, putCall: 0.86 } },
      fearExpansion: { historyData: { vix: 22.0, cnn: 28, bofa: 4.6, highYield: 4.3, putCall: 0.94 } },
      climax: { historyData: { vix: 24.0, cnn: 25, bofa: 4.4, highYield: 4.5, putCall: 0.96 } },
      recovery: { historyData: { vix: 13.0, cnn: 62, bofa: 5.8, highYield: 3.6, putCall: 0.78 } },
    },
  },
  {
    id: "panic-2010-flash",
    name: "2010 플래시 크래시",
    keyDates: {
      start: "2010-04-20",
      rally: "2010-05-01",
      fearExpansion: "2010-05-06",
      extreme: "2010-05-06",
      recovery: "2010-05-20",
    },
    milestones: {
      start: { historyData: { vix: 17.0, cnn: 48, bofa: 5.4, highYield: 4.0, putCall: 0.85 } },
      rise: { historyData: { vix: 22.0, cnn: 35, bofa: 4.9, highYield: 4.4, putCall: 0.92 } },
      fearExpansion: { historyData: { vix: 40.0, cnn: 12, bofa: 3.8, highYield: 5.5, putCall: 1.1 } },
      climax: { historyData: { vix: 42.0, cnn: 10, bofa: 3.6, highYield: 5.8, putCall: 1.12 } },
      recovery: { historyData: { vix: 24.0, cnn: 38, bofa: 5.0, highYield: 4.5, putCall: 0.9 } },
    },
  },
]

function calcDurationDays(startDate, endDate) {
  const s = new Date(`${startDate}T12:00:00`).getTime()
  const e = new Date(`${endDate}T12:00:00`).getTime()
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return null
  return Math.round((e - s) / 86_400_000) + 1
}

/**
 * @param {typeof PANIC_VALIDATION_EXTENDED_HISTORY[0]} row
 */
function rowToMilestoneData(row, scale = 1) {
  const vix = Number(row.vix)
  const cnn = Number(row.fearGreed)
  const bofa = Number(row.bofa)
  const hy = Number(row.highYield)
  const pc = Number(row.putCall)
  const bump = (v, d) => (Number.isFinite(v) ? Math.round((v + d * scale) * 10) / 10 : null)
  return {
    vix: bump(vix, 0),
    cnn: bump(cnn, -2 * scale),
    bofa: bump(bofa, -0.15 * scale),
    highYield: bump(hy, 0.1 * scale),
    putCall: bump(pc, 0.02 * scale),
  }
}

/**
 * @param {string} anchorDate
 * @param {typeof PANIC_VALIDATION_EXTENDED_HISTORY[0]} row
 */
function buildCalmAnchorSpec(anchorDate, row) {
  const id = `nonpanic-anchor-${anchorDate}`
  const recovery = offsetPrecursorDay(anchorDate, 14)
  return {
    id,
    category: /** @type {const} */ ("overheated"),
    name: `Calm Window ${anchorDate}`,
    startDate: offsetPrecursorDay(anchorDate, -28),
    endDate: recovery,
    keyDates: {
      start: offsetPrecursorDay(anchorDate, -28),
      rally: offsetPrecursorDay(anchorDate, -14),
      fearExpansion: offsetPrecursorDay(anchorDate, -7),
      extreme: anchorDate,
      recovery,
    },
    milestones: {
      start: { historyData: rowToMilestoneData(row, 0.3) },
      rise: { historyData: rowToMilestoneData(row, 0.15) },
      fearExpansion: { historyData: rowToMilestoneData(row, 0.05) },
      climax: { historyData: rowToMilestoneData(row, 0) },
      recovery: { historyData: rowToMilestoneData(row, -0.1) },
    },
  }
}

const CALM_ANCHOR_DATES = PANIC_VALIDATION_EXTENDED_HISTORY.map((r) => r.date.slice(0, 10)).filter(
  (d) => !PANIC_STRESS_DATES.has(d),
)

/** @type {ReturnType<typeof buildCalmAnchorSpec>[]} */
const PHASE3_ANCHOR_NON_PANIC_SPECS = CALM_ANCHOR_DATES.map((date) => {
  const row = PANIC_VALIDATION_EXTENDED_HISTORY.find((r) => r.date.startsWith(date))
  return buildCalmAnchorSpec(date, row)
})

export const PRECURSOR_PHASE3_NON_PANIC_IDS = [
  ...PRECURSOR_PHASE3_NON_PANIC_STATIC_IDS,
  ...PHASE3_ANCHOR_NON_PANIC_SPECS.map((s) => s.id),
]

export const PRECURSOR_PHASE3_ALL_IDS = [
  ...PRECURSOR_PHASE3_PANIC_IDS,
  ...PRECURSOR_PHASE3_NON_PANIC_IDS,
]

function specToEvent(spec) {
  const milestones = buildMilestonesFromKeyDates(spec.keyDates)
  for (const [key, patch] of Object.entries(spec.milestones ?? {})) {
    if (!milestones[key]) continue
    milestones[key].historyData = {
      ...milestones[key].historyData,
      yds: null,
      ...patch.historyData,
    }
  }
  return applyEventCompletion({
    id: spec.id,
    category: spec.category,
    name: spec.name,
    startDate: spec.startDate ?? spec.keyDates.start,
    endDate: spec.endDate ?? spec.keyDates.recovery,
    keyDates: spec.keyDates,
    phase: spec.category,
    event: spec.name,
    milestones,
    marketPerformance: buildMarketMetrics(),
    durationDays: calcDurationDays(
      spec.startDate ?? spec.keyDates.start,
      spec.endDate ?? spec.keyDates.recovery,
    ),
    completionStatus: "complete",
    performanceNotes: "Phase 3 Precursor 검증 자동 생성 표본",
  })
}

const PHASE3_GENERATED_EVENTS = [
  ...PHASE3_EXTRA_PANIC_SPECS.map(specToEvent),
  ...PHASE3_ANCHOR_NON_PANIC_SPECS.map(specToEvent),
]

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} baseEvents
 */
export function buildPhase3ValidationDataset(baseEvents) {
  const byId = new Map(baseEvents.map((e) => [e.id, e]))
  for (const ev of PHASE3_GENERATED_EVENTS) {
    if (!byId.has(ev.id)) byId.set(ev.id, ev)
  }
  return PRECURSOR_PHASE3_ALL_IDS.map((id) => byId.get(id)).filter(Boolean)
}

export function getPhase3DatasetCounts() {
  return {
    panic: PRECURSOR_PHASE3_PANIC_IDS.length,
    nonPanic: PRECURSOR_PHASE3_NON_PANIC_IDS.length,
    total: PRECURSOR_PHASE3_ALL_IDS.length,
    anchorCalm: PHASE3_ANCHOR_NON_PANIC_SPECS.length,
  }
}
