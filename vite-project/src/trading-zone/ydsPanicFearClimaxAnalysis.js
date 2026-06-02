import { YDS_MILESTONE_ORDER, YDS_MILESTONE_STEP_LABEL } from "./ydsHistoricalEventTypes.js"
import { computeYdsScore, resolveYdsStage } from "./ydsHistoricalEventTypes.js"
import { buildYdsScoreBreakdown } from "./ydsScoreBreakdown.js"
import { formatStageBadge } from "./ydsPanicEventValidation.js"

/** 공포확대 vs 극점 최종 검증 대상 (YDS 계산 가능 4건) */
export const FEAR_CLIMAX_ANALYSIS_IDS = [
  "panic-2020-covid",
  "panic-2022-tightening",
  "panic-2023-svb",
  "panic-2024-yen-carry",
]

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData} event
 * @param {import("./ydsHistoricalEventTypes.js").ReplayMilestoneKey} key
 */
function snapshotMilestone(event, key) {
  const milestone = event?.milestones?.[key]
  const h = milestone?.historyData ?? {}
  const yds = computeYdsScore(h)
  const stage = resolveYdsStage(yds)
  const breakdown = buildYdsScoreBreakdown(h)
  return {
    key,
    label: YDS_MILESTONE_STEP_LABEL[key],
    date: milestone?.date ?? null,
    yds,
    stageId: stage?.id ?? null,
    stageLabel: stage?.label ?? null,
    stageEmoji: stage?.emoji ?? null,
    vix: h.vix ?? null,
    cnn: h.cnn ?? null,
    highYield: h.highYield ?? null,
    weightNote: breakdown.weightNote,
    shortScore: breakdown.shortScore,
    midScore: breakdown.midScore,
    weights: breakdown.weights,
    vixCapped: Number(h.vix) > 40,
    hyWeighted60: Number(h.highYield) > 6,
  }
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData} event
 */
export function buildFearClimaxCompareRow(event) {
  const fear = snapshotMilestone(event, "fearExpansion")
  const climax = snapshotMilestone(event, "climax")

  const allSnapshots = YDS_MILESTONE_ORDER.map((k) => snapshotMilestone(event, k)).filter(
    (s) => s.yds != null,
  )
  const peak =
    allSnapshots.length > 0
      ? allSnapshots.reduce((best, cur) => (cur.yds > best.yds ? cur : best), allSnapshots[0])
      : null

  const fearHigherThanClimax =
    fear.yds != null && climax.yds != null ? fear.yds > climax.yds : null
  const peakAtFear = peak?.key === "fearExpansion"
  const peakAtClimax = peak?.key === "climax"

  return {
    id: event.id,
    name: event.name,
    fear,
    climax,
    peak,
    fearHigherThanClimax,
    peakAtFear,
    peakAtClimax,
    deltaFearMinusClimax:
      fear.yds != null && climax.yds != null ? Math.round((fear.yds - climax.yds) * 10) / 10 : null,
    insights: buildEventFearClimaxInsights(event, { fear, climax, peak, fearHigherThanClimax }),
  }
}

function buildEventFearClimaxInsights(event, ctx) {
  const { fear, climax, peak, fearHigherThanClimax } = ctx
  const lines = []

  if (peak) {
    lines.push(
      `최고 YDS ${peak.yds} → ${peak.label}(${peak.date})${peak.key === "climax" ? " · 시장 저점 구간" : peak.key === "fearExpansion" ? " · 공포 확대 구간" : ""}`,
    )
  }

  if (fearHigherThanClimax === true) {
    lines.push(
      `공포확대 YDS(${fear.yds}) > 극점 YDS(${climax.yds}) → 공포 피크가 저점보다 먼저 감지됨(공포 탐지기 성향).`,
    )
  } else if (fearHigherThanClimax === false) {
    lines.push(
      `극점 YDS(${climax.yds}) ≥ 공포확대 YDS(${fear.yds}) → 저점 구간에서 점수 정점(저점 탐지기 성향).`,
    )
  }

  if (fear.vixCapped && fear.hyWeighted60) {
    lines.push("공포확대: VIX 캡(40+) + HY>6 → 단기 기여 40%로 제한.")
  } else if (fear.vixCapped && !fear.hyWeighted60) {
    lines.push("공포확대: VIX 캡 적용 + HY≤6 → 단기 가중 70%로 공포 반영 큼.")
  }

  if (climax.vixCapped && climax.hyWeighted60) {
    lines.push("극점: VIX 캡 + HY>6(60% 중기) → 극단 VIX가 최종 점수를 깎음.")
  } else if (!climax.hyWeighted60 && Number(climax.vix) > 25) {
    lines.push("극점: HY≤6 + VIX>25 → 단기 가중 70%로 VIX 반영 우위.")
  }

  if (event.id === "panic-2024-yen-carry" && climax.yds > fear.yds) {
    lines.push(
      "엔캐리: 극점 HY 4.5%로 HY>6 규칙 미적용 → VIX 급등이 단기 70% 가중으로 반영되어 극점 YDS가 상대적으로 높음.",
    )
  }

  if (event.id === "panic-2020-covid" && fear.yds > climax.yds) {
    lines.push(
      `코로나: 극점 CNN ${climax.cnn}(공포확대 ${fear.cnn}보다 완화) + HY ${climax.highYield}% → 중기 비중 60%로 극점 YDS 하락.`,
    )
  }

  return lines
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 */
export function buildFearClimaxAnalysisReport(events) {
  const rows = events
    .filter((e) => FEAR_CLIMAX_ANALYSIS_IDS.includes(e.id))
    .map(buildFearClimaxCompareRow)

  const fearPeakCount = rows.filter((r) => r.peakAtFear).length
  const climaxPeakCount = rows.filter((r) => r.peakAtClimax).length
  const fearHigherCount = rows.filter((r) => r.fearHigherThanClimax === true).length

  const yen = rows.find((r) => r.id === "panic-2024-yen-carry")
  const covid = rows.find((r) => r.id === "panic-2020-covid")

  const globalInsights = buildGlobalInsights(rows, { yen, covid, fearPeakCount, climaxPeakCount, fearHigherCount })

  return {
    rows,
    summary: {
      compared: rows.length,
      fearPeakCount,
      climaxPeakCount,
      fearHigherCount,
      climaxHigherCount: rows.filter((r) => r.fearHigherThanClimax === false).length,
    },
    globalInsights,
    yenVsCovidClimax: buildYenVsCovidClimaxNote(yen, covid),
  }
}

function buildGlobalInsights(rows, stats) {
  const lines = []

  lines.push(
    `4건 중 최고 YDS가 공포확대인 경우 ${stats.fearPeakCount}건 · 극점인 경우 ${stats.climaxPeakCount}건.`,
  )
  lines.push(
    `공포확대 YDS > 극점 YDS: ${stats.fearHigherCount}건 → 단기 공포 선행 감지 패턴.`,
  )

  const vixCapAtFear = rows.filter((r) => r.fear.vixCapped).length
  const hy60AtClimax = rows.filter((r) => r.climax.hyWeighted60).length
  lines.push(
    `VIX 캡(40+) 영향: 공포확대 시점 ${vixCapAtFear}/4건에서 scoreVIX=100 상한 적용.`,
  )
  lines.push(
    `HY 가중(60%) 영향: 극점 시점 ${hy60AtClimax}/4건에서 HY>6 → 단기(VIX) 기여가 40%로 축소.`,
  )

  if (stats.fearPeakCount >= stats.climaxPeakCount) {
    lines.push(
      "종합 판정(엔진 튜닝 전): YDS는 '시장 저점 단일 탐지기'보다 '공포 확대 탐지기' 성향이 강함.",
    )
  } else {
    lines.push(
      "종합 판정(엔진 튜닝 전): 이벤트별 혼합 — 일부는 저점(극점) 정점, 일부는 공포확대 정점.",
    )
  }

  return lines
}

function buildYenVsCovidClimaxNote(yen, covid) {
  if (!yen?.climax?.yds || !covid?.climax?.yds) return []
  return [
    `극점 YDS 비교: 엔캐리 ${yen.climax.yds} > 코로나 ${covid.climax.yds} (+${yen.climax.yds - covid.climax.yds}).`,
    `엔캐리 극점 VIX ${yen.climax.vix} (캡 미적용 구간) · HY ${yen.climax.highYield}% → VIX>25 단기 가중 70%.`,
    `코로나 극점 VIX ${covid.climax.vix} (캡=100) · HY ${covid.climax.highYield}% → HY>6 중기 가중 60%로 VIX 기여 상한.`,
    `코로나는 공포확대 YDS ${covid.fear.yds}가 최고이며, 극점에서는 CNN·HY 완화로 점수가 ${covid.fear.yds - covid.climax.yds}p 하락.`,
    "결론: 엔캐리 극점이 코로나 극점보다 높은 것은 '공포 강도'가 아니라 가중 규칙(HY·VIX 캡) 차이 영향이 큼.",
  ]
}

export { formatStageBadge }
