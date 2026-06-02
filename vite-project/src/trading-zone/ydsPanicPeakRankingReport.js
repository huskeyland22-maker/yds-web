import { YDS_MILESTONE_ORDER, YDS_MILESTONE_STEP_LABEL } from "./ydsHistoricalEventTypes.js"
import { computeYdsScore, resolveYdsStage } from "./ydsHistoricalEventTypes.js"
import { formatStageBadge } from "./ydsPanicEventValidation.js"

/** 최고 YDS 순위 산출 대상 (리먼 포함 · 엔진/현재 구간만) */
export const PANIC_PEAK_RANKING_IDS = [
  "panic-2008-lehman",
  "panic-2011-us-downgrade",
  "panic-2020-covid",
  "panic-2022-tightening",
  "panic-2023-svb",
  "panic-2024-yen-carry",
]

const HISTORIC_PANIC_MIN_SCORE = 85
const CURRENT_PANIC_BUY_MIN = 80

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData} event
 */
export function buildPeakYdsRow(event) {
  const snapshots = YDS_MILESTONE_ORDER.map((key) => {
    const h = event?.milestones?.[key]?.historyData
    const yds = computeYdsScore(h)
    const currentStage = resolveYdsStage(yds)
    return {
      key,
      label: YDS_MILESTONE_STEP_LABEL[key],
      date: event?.milestones?.[key]?.date ?? null,
      yds,
      currentStage,
      isHistoricPanic: yds != null && yds >= HISTORIC_PANIC_MIN_SCORE,
      isCurrentPanicBuy: yds != null && yds >= CURRENT_PANIC_BUY_MIN,
    }
  })

  const computable = snapshots.filter((s) => s.yds != null)
  const peak =
    computable.length > 0
      ? computable.reduce((best, cur) => (cur.yds > best.yds ? cur : best), computable[0])
      : null

  return {
    id: event.id,
    name: event.name,
    maxYds: peak?.yds ?? null,
    peakMilestone: peak?.label ?? null,
    peakDate: peak?.date ?? null,
    peakKey: peak?.key ?? null,
    currentStage: peak?.currentStage ?? null,
    snapshots,
    ydsComputable: computable.length > 0,
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 */
export function buildPanicPeakRankingReport(events) {
  const rows = events
    .filter((e) => PANIC_PEAK_RANKING_IDS.includes(e.id))
    .map(buildPeakYdsRow)
    .filter((r) => r.ydsComputable)
    .sort((a, b) => (b.maxYds ?? 0) - (a.maxYds ?? 0))
    .map((row, idx) => ({ ...row, rank: idx + 1 }))

  const historicPanicEvents = rows.filter((r) => r.maxYds != null && r.maxYds >= HISTORIC_PANIC_MIN_SCORE)
  const currentPanicBuyEvents = rows.filter((r) => r.maxYds != null && r.maxYds >= CURRENT_PANIC_BUY_MIN)

  const lehman = rows.find((r) => r.id === "panic-2008-lehman")
  const covid = rows.find((r) => r.id === "panic-2020-covid")
  const lehmanVsCovid = buildLehmanVsCovidNote(lehman, covid, rows)

  return {
    rows,
    lehmanVsCovid,
    historicPanic: {
      threshold: HISTORIC_PANIC_MIN_SCORE,
      label: "역사적패닉 (실험 구간 기준)",
      exists: historicPanicEvents.length > 0,
      events: historicPanicEvents,
      note: "엔진 점수만 사용 · 실험 구간(85+) 미반영 · 비교용",
    },
    currentStageSummary: {
      panicBuyMin: CURRENT_PANIC_BUY_MIN,
      panicBuyCount: currentPanicBuyEvents.length,
      events: rows.map((r) => ({
        name: r.name,
        maxYds: r.maxYds,
        stageLabel: r.currentStage?.label ?? "—",
        stageEmoji: r.currentStage?.emoji ?? "",
      })),
    },
    summary: {
      ranked: rows.length,
      topEvent: rows[0]?.name ?? null,
      topYds: rows[0]?.maxYds ?? null,
    },
  }
}

function buildLehmanVsCovidNote(lehman, covid, rankedRows) {
  if (!lehman?.maxYds || !covid?.maxYds) {
    return { lines: ["리먼 또는 코로나 YDS 계산 불가"], table: [] }
  }

  const table = [
    {
      label: "최고 YDS",
      lehman: lehman.maxYds,
      covid: covid.maxYds,
      delta: lehman.maxYds - covid.maxYds,
    },
    {
      label: "최고 시점",
      lehman: `${lehman.peakMilestone} (${lehman.peakDate})`,
      covid: `${covid.peakMilestone} (${covid.peakDate})`,
      delta: null,
    },
    {
      label: "현재 구간",
      lehman: formatStageBadge(lehman.currentStage?.emoji, lehman.currentStage?.label),
      covid: formatStageBadge(covid.currentStage?.emoji, covid.currentStage?.label),
      delta: null,
    },
  ]

  const lehmanRank = rankedRows.findIndex((r) => r.id === "panic-2008-lehman") + 1
  const covidRank = rankedRows.findIndex((r) => r.id === "panic-2020-covid") + 1

  const lines = [
    `최고 YDS 순위: 리먼 ${lehmanRank}위(${lehman.maxYds}) · 코로나 ${covidRank}위(${covid.maxYds})`,
    lehman.maxYds > covid.maxYds
      ? `리먼 최고 YDS가 코로나보다 ${lehman.maxYds - covid.maxYds}p 높음 (리먼 ${lehman.peakMilestone}).`
      : `코로나 최고 YDS가 리먼보다 ${covid.maxYds - lehman.maxYds}p 높음 (코로나 ${covid.peakMilestone}).`,
    `리먼 CNN은 F&G 미출시 구간 근사값 사용 — 순위는 getFinalScore 엔진 결과만 비교.`,
  ]

  return { lines, table, lehmanRank, covidRank }
}

export { formatStageBadge, HISTORIC_PANIC_MIN_SCORE, CURRENT_PANIC_BUY_MIN }
