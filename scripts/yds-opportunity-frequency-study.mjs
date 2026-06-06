/**
 * YDS Opportunity Frequency Study — read-only research
 * Engine / weights / zone thresholds NOT modified.
 *
 * Usage: node scripts/yds-opportunity-frequency-study.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { resolveMacroV1Status, MACRO_V1_STATUS_BANDS } from "../vite-project/src/panic-v2/panicMacroV1Status.js"
import { panicDataFromCycleRow } from "../vite-project/src/utils/cycleHistoryUtils.js"
import { getFinalScore } from "../vite-project/src/utils/tradingScores.js"
import {
  mergeYdsSourceHistory,
  pickYdsWeeklySteps,
} from "../vite-project/src/trading-zone/ydsSignalHistory.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const STAGE_LABEL = Object.fromEntries(MACRO_V1_STATUS_BANDS.map((b) => [b.id, b.label]))

function rowDateKey(row) {
  return String(row?.date ?? row?.ts ?? "").slice(0, 10)
}

function scoreRow(row) {
  const panic = panicDataFromCycleRow(row)
  if (!panic) return null
  const score = getFinalScore(panic)
  if (!Number.isFinite(score)) return null
  const stage = resolveMacroV1Status(score)
  if (!stage) return null
  return { score: Math.round(score), stageId: stage.id, stageLabel: stage.label }
}

function daySpan(d0, d1) {
  return (new Date(`${d1}T12:00:00`).getTime() - new Date(`${d0}T12:00:00`).getTime()) / 86_400_000
}

/** Contiguous calendar-day episodes per zone between anchors */
function analyzeEpisodes(sortedAsc, targetStage) {
  /** @type {Array<{ start: string; end: string; days: number; startScore: number; endScore: number }>} */
  const episodes = []
  let inEpisode = false
  let startDate = null
  let startScore = null
  let episodeDays = 0

  for (let i = 0; i < sortedAsc.length; i++) {
    const cur = sortedAsc[i]
    const s = scoreRow(cur)
    if (!s) continue
    const d0 = rowDateKey(cur)
    const d1 = i + 1 < sortedAsc.length ? rowDateKey(sortedAsc[i + 1]) : d0
    const span = i + 1 < sortedAsc.length ? daySpan(d0, d1) : 0

    if (s.stageId === targetStage) {
      if (!inEpisode) {
        inEpisode = true
        startDate = d0
        startScore = s.score
      }
      episodeDays += span
    } else if (inEpisode) {
      episodes.push({
        start: startDate,
        end: d0,
        days: Math.round(episodeDays),
        startScore,
        endScore: s.score,
      })
      inEpisode = false
      episodeDays = 0
      startDate = null
      startScore = null
    }
  }

  if (inEpisode && startDate) {
    const last = rowDateKey(sortedAsc[sortedAsc.length - 1])
    episodes.push({
      start: startDate,
      end: last,
      days: Math.round(episodeDays),
      startScore,
      endScore: scoreRow(sortedAsc[sortedAsc.length - 1])?.score ?? startScore,
    })
  }

  return episodes
}

function findTransitions(steps) {
  /** @type {Array<{ date: string; from: string; to: string; score: number }>} */
  const out = []
  let prev = null
  for (const row of steps) {
    const s = scoreRow(row)
    if (!s) continue
    const date = rowDateKey(row)
    if (prev && prev.stageId !== s.stageId) {
      out.push({ date, from: prev.stageId, to: s.stageId, score: s.score })
    }
    prev = { ...s, date }
  }
  return out
}

function findZoneEntries(steps) {
  /** @type {Array<{ date: string; stageId: string; score: number }>} */
  const entries = []
  let prevStage = null
  for (const row of steps) {
    const s = scoreRow(row)
    if (!s) continue
    if (s.stageId !== prevStage) {
      entries.push({ date: rowDateKey(row), stageId: s.stageId, score: s.score })
      prevStage = s.stageId
    }
  }
  return entries
}

function avg(nums) {
  const v = nums.filter(Number.isFinite)
  if (!v.length) return null
  return v.reduce((a, b) => a + b, 0) / v.length
}

/** After each interest entry, did dca occur before study end? */
function analyzeInterestToDca(entries) {
  const interestEntries = entries.filter((e) => e.stageId === "interest")
  let reachedDca = 0
  /** @type {Array<{ interestDate: string; dcaDate: string | null; daysToDca: number | null }>} */
  const details = []

  for (const ie of interestEntries) {
    const ieTs = new Date(`${ie.date}T12:00:00`).getTime()
    const later = entries.filter((e) => new Date(`${e.date}T12:00:00`).getTime() > ieTs)
    const nextDca = later.find((e) => e.stageId === "dca")
    if (nextDca) {
      reachedDca++
      details.push({
        interestDate: ie.date,
        dcaDate: nextDca.date,
        daysToDca: Math.round(daySpan(ie.date, nextDca.date)),
      })
    } else {
      details.push({ interestDate: ie.date, dcaDate: null, daysToDca: null })
    }
  }

  return {
    interestEntryCount: interestEntries.length,
    reachedDcaCount: reachedDca,
    conversionPct: interestEntries.length ? (reachedDca / interestEntries.length) * 100 : 0,
    details,
  }
}

function recommend(metrics) {
  const { dcaDwellPct, dcaEntriesPerYear, interestToDcaPct, dcaEpisodesPerYear } = metrics

  // Primary: DCA frequency vs investor usability
  if (dcaDwellPct < 8 && dcaEntriesPerYear < 0.35) {
    return {
      code: "C",
      label: "분할 확대 (UI·철학 — 엔진 유지)",
      rationale:
        `분할매수 체류 ${dcaDwellPct.toFixed(1)}% · 연 ${dcaEntriesPerYear.toFixed(2)}회 진입 — 실전 「핵심 매집」 기회가 드묾. ` +
        "V1은 60–79를 UI·행동 가이드에서 강조하되, 구간 경계 변경은 V2 연구.",
    }
  }
  if (interestToDcaPct >= 25 && dcaDwellPct >= 10 && dcaDwellPct <= 20) {
    return {
      code: "A",
      label: "유지",
      rationale:
        "관심→분할 전환과 체류 빈도가 사이클 엔진 설계(드문 고품질 매집)와 정합. UI는 관심 준비·분할 실행 철학 유지.",
    }
  }
  if (dcaDwellPct > 25 || dcaEpisodesPerYear > 1.5) {
    return {
      code: "B",
      label: "관심 확대 (UI·가이드)",
      rationale: "분할 빈도가 높음 — 관심(40–59) 구간에서 준비·선별 UX를 더 강조해 과잉 매집 방지.",
    }
  }
  if (dcaDwellPct < 5 && dcaEntriesPerYear < 0.25) {
    return {
      code: "D",
      label: "패닉 기준 재검토 (V2 연구)",
      rationale:
        "분할·패닉 모두 희소 — 80+ 미도달로 극단 기회 포착 실패 가능. V2에서 임계값·가중치 시뮬레이션만 검토(본 연구는 엔진 미변경).",
    }
  }

  return {
    code: "C",
    label: "분할 확대 (UI·철학)",
    rationale:
      `연 ${dcaEntriesPerYear.toFixed(2)}회·체류 ${dcaDwellPct.toFixed(1)}% — 투자자 관점 「적을 수 있음」. ` +
      "관심 44% + 분할 12% 구조는 준비는 많고 실행은 적음 → UI에서 분할=핵심 강조(이미 V1 적용 중).",
  }
}

// --- main ---
const merged = mergeYdsSourceHistory([])
const steps = pickYdsWeeklySteps(merged)
const first = rowDateKey(merged[0])
const last = rowDateKey(merged[merged.length - 1])
const spanYears =
  first && last ? daySpan(first, last) / 365.25 : 0

const dcaEpisodes = analyzeEpisodes(merged, "dca")
const interestEpisodes = analyzeEpisodes(merged, "interest")
const transitions = findTransitions(steps)
const entries = findZoneEntries(steps)

const dcaEntries = entries.filter((e) => e.stageId === "dca")
const interestToDcaDirect = transitions.filter((t) => t.from === "interest" && t.to === "dca")
const interestToDca = analyzeInterestToDca(entries)

const dcaDwellDays = dcaEpisodes.reduce((s, e) => s + e.days, 0)
const totalSpanDays = daySpan(first, last)
const dcaDwellPct = totalSpanDays > 0 ? (dcaDwellDays / totalSpanDays) * 100 : 0

const dcaEpisodeDays = dcaEpisodes.map((e) => e.days)
const dcaEntriesPerYear = spanYears > 0 ? dcaEntries.length / spanYears : 0
const dcaEpisodesPerYear = spanYears > 0 ? dcaEpisodes.length / spanYears : 0

const anchorTimeline = merged.map((row) => {
  const s = scoreRow(row)
  return {
    date: rowDateKey(row),
    score: s?.score ?? null,
    stage: s?.stageId ?? null,
    stageLabel: s?.stageLabel ?? null,
  }
})

const yearlyDca = {}
for (const e of dcaEntries) {
  const y = e.date.slice(0, 4)
  yearlyDca[y] = (yearlyDca[y] ?? 0) + 1
}

const result = {
  generatedAt: new Date().toISOString(),
  methodology: {
    engine: "getFinalScore (unmodified)",
    dcaZone: "60–79 (분할매수)",
    interestZone: "40–59 (관심)",
    dataSource: "PANIC_VALIDATION_EXTENDED_HISTORY (monthly anchors)",
    anchorCount: merged.length,
    period: { first, last, spanYears: Math.round(spanYears * 10) / 10 },
    episodeMethod: "contiguous calendar-day segments while anchor-assigned stage = target",
    entryMethod: "stage transition on weekly steps",
    limitations: [
      "Monthly anchors (~35) — daily Supabase would refine episode length",
      "Episode end date = first anchor after zone exit (upper bound approximate)",
    ],
  },
  dca: {
    dwellPctCalendar: dcaDwellPct,
    dwellDaysTotal: dcaDwellDays,
    episodeCount: dcaEpisodes.length,
    entryCount: dcaEntries.length,
    entriesPerYear: dcaEntriesPerYear,
    episodesPerYear: dcaEpisodesPerYear,
    avgEpisodeDays: avg(dcaEpisodeDays),
    medianEpisodeDays: dcaEpisodeDays.length
      ? [...dcaEpisodeDays].sort((a, b) => a - b)[Math.floor(dcaEpisodeDays.length / 2)]
      : null,
    episodes: dcaEpisodes,
    entries: dcaEntries,
    yearlyEntryCount: yearlyDca,
  },
  interest: {
    dwellPctCalendar: totalSpanDays > 0 ? (interestEpisodes.reduce((s, e) => s + e.days, 0) / totalSpanDays) * 100 : 0,
    episodeCount: interestEpisodes.length,
    entryCount: entries.filter((e) => e.stageId === "interest").length,
  },
  interestToDca: {
    directTransitions: interestToDcaDirect,
    directTransitionCount: interestToDcaDirect.length,
    ...interestToDca,
  },
  anchorTimeline,
  recommendation: recommend({
    dcaDwellPct,
    dcaEntriesPerYear,
    dcaEpisodesPerYear,
    interestToDcaPct: interestToDca.conversionPct,
  }),
}

mkdirSync(join(__dirname, ".cache"), { recursive: true })
const outPath = join(__dirname, ".cache", "yds-opportunity-frequency-result.json")
writeFileSync(outPath, JSON.stringify(result, null, 2))

console.log("YDS Opportunity Frequency Study")
console.log(`Period: ${first} → ${last} (${spanYears.toFixed(1)}y)`)
console.log("\n--- 분할매수 (60–79) ---")
console.log(`체류 비율: ${dcaDwellPct.toFixed(1)}% (${dcaDwellDays}일 / ${Math.round(totalSpanDays)}일)`)
console.log(`에피소드: ${dcaEpisodes.length}회 · 진입(전환): ${dcaEntries.length}회`)
console.log(`연간 진입: ${dcaEntriesPerYear.toFixed(2)}회/년 · 연간 에피소드: ${dcaEpisodesPerYear.toFixed(2)}회/년`)
console.log(`평균 지속: ${avg(dcaEpisodeDays)?.toFixed(0) ?? "—"}일 · 에피소드별: ${dcaEpisodeDays.join(", ")}`)
console.log("\n--- 관심 → 분할매수 ---")
console.log(`관심 진입: ${interestToDca.interestEntryCount}회`)
console.log(`이후 분할 도달: ${interestToDca.reachedDcaCount}회 (${interestToDca.conversionPct.toFixed(1)}%)`)
console.log(`직접 전환(interest→dca): ${interestToDcaDirect.length}회`)
console.log(`\n권장: ${result.recommendation.code}. ${result.recommendation.label}`)
console.log(`JSON: ${outPath}`)
