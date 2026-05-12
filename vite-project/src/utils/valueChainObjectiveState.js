/**
 * 밸류체인 우측 패널 상단 — 차트/수급/추세 객관 요약 (행동 지시와 문구 분리).
 */

/**
 * @param {object | null} snap
 * @returns {{ liquidity: string; structure: string; pulse: string } | null}
 */
export function buildObjectiveStateSnapshot(snap) {
  if (!snap?.panel) return null

  const { panel, movingAverage } = snap
  let liquidity = panel.volumeHeadline || "—"
  if (liquidity === "평균 수준") {
    liquidity = "거래량 평균권"
  } else if (liquidity !== "—" && liquidity !== "산출 불가" && !liquidity.endsWith("구간")) {
    liquidity = `${liquidity} 구간`
  }

  const tr = movingAverage?.trend
  let structure = "중기 추세 산출 불가"
  if (tr === "bullish") structure = "중기 상승 추세 유지"
  else if (tr === "bearish") structure = "중기 조정·역배열"
  else if (tr === "mixed") structure = "중기 추세 혼재"

  const macdL = panel.macdLine
  const rsi = snap.rsi14
  let pulse = "단기 방향성 혼재"

  if (macdL === "산출 불가" || macdL == null) {
    pulse = Number.isFinite(rsi) ? (rsi < 40 ? "단기 약세 쪽 체류" : rsi > 60 ? "단기 강세 쪽 체류" : "단기 박스권") : "단기 모멘텀 산출 불가"
  } else if (macdL === "음전환" || macdL === "시그널 하방") {
    pulse = Number.isFinite(rsi) && rsi < 44 ? "단기 조정 진행" : "단기 모멘텀 약화"
  } else if (macdL === "양전환 시도" || macdL === "시그널 상방") {
    pulse = Number.isFinite(rsi) && rsi > 56 ? "단기 상방 우위" : "단기 모멘텀 회복 시도"
  } else if (macdL === "방향성 대기") {
    pulse = "단기 흐름 대기"
  }

  return { liquidity, structure, pulse }
}
