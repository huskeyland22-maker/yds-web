import { YDS_MILESTONE_STEP_LABEL } from "./ydsHistoricalEventTypes.js"
import { buildPeakYdsRow } from "./ydsPanicPeakRankingReport.js"
import { buildYdsScoreBreakdown } from "./ydsScoreBreakdown.js"

/** 관세 쇼크 심층 검증 — 최고 YDS 4건 비교 */
export const TARIFF_DEEP_COMPARE_IDS = [
  "panic-2008-lehman",
  "panic-2020-covid",
  "panic-2025-tariff-shock",
  "panic-2024-yen-carry",
]

const TARIFF_EVENT_ID = "panic-2025-tariff-shock"
const COVID_EVENT_ID = "panic-2020-covid"

const INDICATOR_LABELS = {
  vix: "VIX",
  cnn: "CNN",
  bofa: "BofA",
  highYield: "HY",
  putCall: "Put/Call",
}

const CONTRIBUTION_LABELS = {
  vix: "VIX 기여",
  cnn: "CNN 기여",
  bofa: "BofA 기여",
  highYield: "HY 기여",
  putCall: "PutCall 기여",
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData} event
 */
export function buildPeakIndicatorCompareRow(event) {
  const peak = buildPeakYdsRow(event)
  const peakKey = peak.peakKey
  if (!peakKey) {
    return { id: event.id, name: event.name, ydsComputable: false }
  }

  const milestone = event.milestones?.[peakKey]
  const h = milestone?.historyData ?? {}
  const breakdown = buildYdsScoreBreakdown(h)

  return {
    id: event.id,
    name: event.name,
    ydsComputable: breakdown.computable,
    maxYds: peak.maxYds,
    peakMilestone: peak.peakMilestone,
    peakDate: peak.peakDate,
    peakKey,
    vix: h.vix ?? null,
    cnn: h.cnn ?? null,
    bofa: h.bofa ?? null,
    highYield: h.highYield ?? null,
    putCall: h.putCall ?? null,
    breakdown,
  }
}

/**
 * @param {ReturnType<typeof buildPeakIndicatorCompareRow>} rowA
 * @param {ReturnType<typeof buildPeakIndicatorCompareRow>} rowB
 */
function buildIndicatorDiffTable(rowA, rowB) {
  const keys = ["maxYds", "vix", "cnn", "bofa", "highYield", "putCall"]
  const labels = {
    maxYds: "최고 YDS",
    vix: "VIX",
    cnn: "CNN F&G",
    bofa: "BofA",
    highYield: "HY Spread",
    putCall: "Put/Call",
  }

  return keys.map((key) => {
    const a = rowA[key]
    const b = rowB[key]
    const delta =
      a != null && b != null && Number.isFinite(Number(a)) && Number.isFinite(Number(b))
        ? Math.round((Number(a) - Number(b)) * 10) / 10
        : null
    return { key, label: labels[key] ?? key, tariff: a, covid: b, delta }
  })
}

/**
 * @param {ReturnType<typeof buildPeakIndicatorCompareRow>} tariffRow
 * @param {ReturnType<typeof buildPeakIndicatorCompareRow>} covidRow
 */
function buildTariffHighYdsInterpretation(tariffRow, covidRow) {
  const lines = []
  const t = tariffRow.breakdown
  const c = covidRow.breakdown
  if (!t?.computable || !c?.computable) {
    return ["관세 또는 코로나 YDS 분해 불가 — 지표 미입력."]
  }

  const tContrib = t.contributions
  const cContrib = c.contributions
  const vixDelta = (tContrib?.vix ?? 0) - (cContrib?.vix ?? 0)
  const cnnDelta = (tContrib?.cnn ?? 0) - (cContrib?.cnn ?? 0)
  const putDelta = (tContrib?.putCall ?? 0) - (cContrib?.putCall ?? 0)

  // 1. VIX 영향
  const tVixRaw = Number(tariffRow.vix)
  const cVixRaw = Number(covidRow.vix)
  const tVixScore = t.componentScores?.vix
  const cVixScore = c.componentScores?.vix
  if (tVixRaw > 40 && cVixRaw > 40) {
    lines.push(
      `VIX: 관세 ${tVixRaw}(scoreVIX ${tVixScore}) · 코로나 ${cVixRaw}(scoreVIX ${cVixScore}) — 둘 다 40+ 캡(100)이지만, 관세는 단기 가중 ${Math.round(t.weights.wShort * 100)}%로 VIX 기여 ${tContrib.vix}p vs 코로나 ${cContrib.vix}p (${vixDelta >= 0 ? "+" : ""}${Math.round(vixDelta * 10) / 10}p).`,
    )
  } else {
    lines.push(
      `VIX: 관세 ${tVixRaw}(scoreVIX ${tVixScore}, 기여 ${tContrib.vix}p) · 코로나 ${cVixRaw}(scoreVIX ${cVixScore}, 기여 ${cContrib.vix}p).`,
    )
  }

  // 2. CNN 영향
  lines.push(
    `CNN: 관세 ${tariffRow.cnn}(기여 ${tContrib.cnn}p) · 코로나 ${covidRow.cnn}(기여 ${cContrib.cnn}p) — 차이 ${Math.round(cnnDelta * 10) / 10}p. 극단 공포(0~10)가 아니면 중기 점수가 완화됩니다.`,
  )

  // 3. HY 가중 영향
  const tHy = Number(tariffRow.highYield)
  const cHy = Number(covidRow.highYield)
  lines.push(
    `HY 가중: 관세 HY ${tHy}%${tHy > 6 ? " (>6 → 중기 60%)" : " (≤6 → VIX>25 시 단기 70%)"} · 코로나 HY ${cHy}%${cHy > 6 ? " (>6 → 중기 60%, VIX 극단값 기여 40%로 축소)" : ""}. ${t.weightNote}`,
  )
  if (tHy <= 6 && cHy > 6) {
    lines.push(
      "핵심: 코로나는 HY>6으로 VIX 캡(100)이 최종 YDS에 40%만 반영되는 반면, 관세는 HY≤6·VIX>25로 단기 70% 가중 → VIX·PutCall 반영이 상대적으로 큼.",
    )
  }

  // 4. PutCall 영향
  lines.push(
    `Put/Call: 관세 ${tariffRow.putCall}(기여 ${tContrib.putCall}p) · 코로나 ${covidRow.putCall}(기여 ${cContrib.putCall}p) — 차이 ${Math.round(putDelta * 10) / 10}p (단기 40% × 단기 가중).`,
  )

  const ydsGap = (tariffRow.maxYds ?? 0) - (covidRow.maxYds ?? 0)
  if (ydsGap > 0) {
    lines.push(
      `종합: 관세 최고 YDS ${tariffRow.maxYds}(${tariffRow.peakMilestone})가 코로나 ${covidRow.maxYds}(${covidRow.peakMilestone})보다 +${ydsGap}p — 원시 VIX는 낮아도 HY≤6 단기 가중(70%)이 VIX 캡 효과를 더 많이 전달합니다.`,
    )
  }

  return lines
}

/**
 * @param {import("./ydsHistoricalEventTypes.js").EventDetailData[]} events
 */
export function buildTariffShockDeepValidationReport(events) {
  const compareRows = TARIFF_DEEP_COMPARE_IDS.map((id) => {
    const event = events.find((e) => e.id === id)
    return event ? buildPeakIndicatorCompareRow(event) : null
  }).filter(Boolean)

  const tariffRow = compareRows.find((r) => r.id === TARIFF_EVENT_ID)
  const covidRow = compareRows.find((r) => r.id === COVID_EVENT_ID)

  const tariffBreakdown = tariffRow?.breakdown?.computable ? tariffRow.breakdown : null
  const indicatorDiff =
    tariffRow?.ydsComputable && covidRow?.ydsComputable
      ? buildIndicatorDiffTable(tariffRow, covidRow)
      : []

  const interpretation =
    tariffRow?.ydsComputable && covidRow?.ydsComputable
      ? buildTariffHighYdsInterpretation(tariffRow, covidRow)
      : []

  const contributionRows = tariffBreakdown?.contributions
    ? Object.entries(tariffBreakdown.contributions).map(([key, value]) => ({
        key,
        label: CONTRIBUTION_LABELS[key] ?? key,
        contribution: value,
        componentScore: tariffBreakdown.componentScores?.[key] ?? null,
      }))
    : []

  return {
    compareRows,
    tariffBreakdown,
    tariffPeak: tariffRow
      ? {
          milestone: tariffRow.peakMilestone,
          date: tariffRow.peakDate,
          maxYds: tariffRow.maxYds,
        }
      : null,
    covidPeak: covidRow
      ? {
          milestone: covidRow.peakMilestone,
          date: covidRow.peakDate,
          maxYds: covidRow.maxYds,
        }
      : null,
    indicatorDiff,
    interpretation,
    contributionRows,
    notes: [
      "getFinalScore 엔진 그대로 · 최고 YDS = 이벤트 내 milestone 중 최대값.",
      "관세 vs 코로나 비교는 각 이벤트 최고 YDS 시점(관세: 극점 · 코로나: 공포확대) 기준.",
    ],
  }
}

export { INDICATOR_LABELS, CONTRIBUTION_LABELS, TARIFF_EVENT_ID }
