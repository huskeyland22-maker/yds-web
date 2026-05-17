/**
 * 패닉 히스토리 차트 구간 범례 + hover 설명
 */
import { MOOD_SPECTRUM } from "./panicDeskMood.js"
import { metricZoneBands } from "./panicHistoryZoneLines.js"

/** @typedef {{ id: string; label: string; color: string; hint: string }} HistoryLegendItem */

/** @param {string} metricKey @returns {HistoryLegendItem[]} */
export function historyZoneLegendItems(metricKey) {
  if (metricKey === "fearGreed") {
    return MOOD_SPECTRUM.map((m) => ({
      id: m.id,
      label: m.label,
      color: m.color,
      hint: `F&G ${m.min}–${m.max}: ${m.label} 구간`,
    }))
  }

  const hints = ZONE_HINTS[metricKey] ?? {}
  return metricZoneBands(metricKey).map((b) => ({
    id: b.label,
    label: b.label,
    color: b.color,
    hint: hints[b.label] ?? `${b.label} 구간`,
  }))
}

/** @type {Record<string, Record<string, string>>} */
const ZONE_HINTS = {
  vix: {
    "극저변동": "VIX 15 이하 — 변동성 매우 낮음, 과도한 낙관 주의",
    안정: "VIX 15–20 — 변동성 안정 구간",
    경계: "VIX 20–30 — 변동성 상승·경계",
    공포: "VIX 30+ — 공포·헤지 수요 확대",
  },
  putCall: {
    콜과열: "P/C 0.55 이하 — 콜 쏠림·과열",
    중립: "P/C 0.55–0.85 — 옵션 수요 균형",
    풋쏠림: "P/C 0.85+ — 풋·헤지 수요 우세",
  },
  highYield: {
    신용안정: "HY OAS 3% 미만 — 신용 스트레스 낮음",
    경계: "HY OAS 3–5.5% — 스프레드 확대·경계",
    스트레스: "HY OAS 5.5%+ — 신용 스트레스",
  },
  bofa: {
    "극도 공포": "BofA 0–2 — 극단적 약세 심리",
    공포: "BofA 2–4 — 방어적 심리",
    중립: "BofA 4–6 — 중립권",
    탐욕: "BofA 6–8 — 낙관·위험선호",
    "극도 탐욕": "BofA 8+ — 과열 심리",
  },
  move: {
    안정: "MOVE 90 미만 — 채권 변동성 낮음",
    경계: "MOVE 90–110 — 금리 변동성 상승",
    위험: "MOVE 110+ — 채권 시장 스트레스",
  },
  skew: {
    낮음: "SKEW 125 미만 — 꼬리위험 프리미엄 낮음",
    보통: "SKEW 125–140 — 평균 수준",
    꼬리위험: "SKEW 140+ — 하방 헤지 수요 강함",
  },
  gsBullBear: {
    "극도 약세": "GS B/B 0–25 — 극단적 약세",
    약세: "GS B/B 25–40 — 약세 우세",
    중립: "GS B/B 40–60 — 중립",
    강세: "GS B/B 60–75 — 강세 우세",
    "극도 강세": "GS B/B 75+ — 극단적 강세",
  },
}
