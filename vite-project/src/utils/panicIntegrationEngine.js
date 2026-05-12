function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function normalizedFear(v, lo, hi, reverse = false) {
  const n = toNum(v)
  if (n == null) return 50
  const base = ((n - lo) / (hi - lo)) * 100
  const scaled = clamp(base, 0, 100)
  return reverse ? 100 - scaled : scaled
}

function mapState(score) {
  if (score <= 15) return "패닉"
  if (score <= 30) return "공포"
  if (score <= 45) return "반등초기"
  if (score <= 60) return "중립"
  if (score <= 75) return "순환매"
  if (score <= 90) return "과열"
  return "버블"
}

function mapRisk(score) {
  if (score <= 20) return "매우 높음"
  if (score <= 35) return "높음"
  if (score <= 60) return "보통"
  if (score <= 80) return "주의"
  return "높음"
}

function buildInterpretation(currentState, flow) {
  if (flow.includes("→")) return `${flow} 구간`
  if (currentState === "순환매") return "과열 이후 순환매 진행"
  if (currentState === "반등초기") return "공포 이후 반등초기 구간"
  if (currentState === "과열") return "단기 과열 부담 확대"
  return `${currentState} 구간 진행`
}

function buildStrategyHighlights({ currentState, horizon }) {
  const lines = []
  if (currentState === "패닉" || currentState === "공포") {
    lines.push("추격매수보다 분할 대기 우세")
    lines.push("방어 섹터 비중 유지")
  } else if (currentState === "과열" || currentState === "버블") {
    lines.push("단기 과열 구간, 익절 우선")
    lines.push("눌림 구간 재진입 전략 유리")
  } else {
    lines.push("주도 섹터 눌림목 관찰")
    lines.push("테마 순환 속 강도 상위군 집중")
  }
  if (horizon.short === "반등초기") lines.push("단기 반등 파동 연장 가능성")
  if (horizon.mid === "순환매") lines.push("중기 순환매 전개 가능성")
  return lines.slice(0, 4)
}

export function buildPanicIntegration(input = {}) {
  const vixFear = normalizedFear(input.vix, 12, 45, false)
  const fearGreedFear = normalizedFear(input.fearGreed, 0, 100, true)
  const putCallFear = normalizedFear(input.putCall, 0.6, 1.3, false)
  const bofaFear = normalizedFear(input.bofa, 0, 8, true)
  const hyFear = normalizedFear(input.highYield, 3, 8.5, false)
  const rateFear = normalizedFear(input.us10y, 3, 5.5, false)
  const dollarFear = normalizedFear(input.usdkrw, 1200, 1500, false)
  const liquidityFear = normalizedFear(input.liquidityStress, 0, 100, false)
  const creditFear = normalizedFear(input.creditRisk, 0, 100, false)

  const weightedFear =
    vixFear * 0.2 +
    fearGreedFear * 0.16 +
    putCallFear * 0.14 +
    bofaFear * 0.1 +
    hyFear * 0.16 +
    rateFear * 0.08 +
    dollarFear * 0.06 +
    liquidityFear * 0.05 +
    creditFear * 0.05

  const sentimentScore = Math.round(clamp(100 - weightedFear, 0, 100))
  const currentState = mapState(sentimentScore)

  const shortScore = Math.round(clamp((100 - vixFear) * 0.55 + (100 - putCallFear) * 0.45, 0, 100))
  const midScore = Math.round(clamp((100 - fearGreedFear) * 0.45 + (100 - bofaFear) * 0.35 + (100 - hyFear) * 0.2, 0, 100))
  const longScore = Math.round(clamp((100 - hyFear) * 0.45 + (100 - rateFear) * 0.3 + (100 - dollarFear) * 0.25, 0, 100))

  const prevProxy = mapState(Math.round((shortScore + midScore) / 2))
  const stateFlow = prevProxy === currentState ? currentState : `${prevProxy} → ${currentState}`
  const interpretation = buildInterpretation(currentState, stateFlow)
  const horizon = {
    short: mapState(shortScore),
    mid: mapState(midScore),
    long: mapState(longScore),
  }

  return {
    sentimentScore,
    currentState,
    stateFlow,
    interpretation,
    riskLevel: mapRisk(sentimentScore),
    horizon,
    strategyHighlights: buildStrategyHighlights({ currentState, horizon }),
  }
}
