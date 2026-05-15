import { buildPanicIntegration } from "./panicIntegrationEngine.js"
import { extractPanicMetrics, resolveMarketState } from "./marketStateEngine.js"

function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const STATE_META = {
  panic: { label: "패닉", color: "#ef4444", risk: "매우 높음" },
  fear: { label: "공포", color: "#f97316", risk: "높음" },
  neutral: { label: "중립", color: "#9ca3af", risk: "보통" },
  rebound: { label: "반등초기", color: "#38bdf8", risk: "보통" },
  rotation: { label: "순환매", color: "#3b82f6", risk: "보통" },
  overheating: { label: "과열", color: "#facc15", risk: "주의" },
  bubble: { label: "버블", color: "#a855f7", risk: "매우 높음" },
}

function stateColorFromLabel(label) {
  switch (label) {
    case "패닉":
      return "#ef4444"
    case "공포":
      return "#f97316"
    case "반등초기":
      return "#38bdf8"
    case "순환매":
      return "#3b82f6"
    case "과열":
      return "#facc15"
    case "버블":
      return "#a855f7"
    default:
      return "#9ca3af"
  }
}

function classifyState({ vix, fearGreed, bofa, putCall, highYield }) {
  if (vix >= 36 || fearGreed <= 15 || highYield >= 6.2) return "panic"
  if (vix >= 28 || fearGreed <= 30 || putCall >= 1.08 || highYield >= 5.4) return "fear"
  if (fearGreed >= 88 && vix <= 13 && bofa >= 7.5 && putCall <= 0.62) return "bubble"
  if (fearGreed >= 75 && vix <= 16 && putCall <= 0.7) return "overheating"
  if (fearGreed <= 45 && vix <= 22 && putCall <= 0.92) return "rebound"
  if (fearGreed >= 50 && fearGreed <= 72 && vix <= 22 && highYield <= 4.8) return "rotation"
  return "neutral"
}

function buildBullets(m) {
  const out = []
  if (m.vix != null) out.push(m.vix <= 20 ? "VIX 안정권" : "VIX 변동성 확대 구간")
  if (m.highYield != null) out.push(m.highYield <= 4.8 ? "하이일드 스프레드 정상" : "하이일드 스프레드 경계 필요")
  if (m.putCall != null) out.push(m.putCall >= 1 ? "방어 심리 우세" : "추격 심리 유입 가능")
  if (m.fearGreed != null) out.push(m.fearGreed >= 65 ? "탐욕 심리 강세" : "공포 심리 잔존")
  if (m.bofa != null) out.push(m.bofa <= 3 ? "중장기 리스크 프리미엄 유효" : "위험자산 선호 회복")
  return out.slice(0, 5)
}

function buildBriefingLines(stateKey, m) {
  const lines = []
  if (stateKey === "rotation") {
    lines.push("AI 인프라 강세 유지, 순환매 확산.")
    lines.push("전력/인프라는 눌림 이후 재진입 구간.")
    lines.push("추격매수보다 눌림 관찰 우세.")
    return lines
  }
  if (stateKey === "overheating" || stateKey === "bubble") {
    lines.push("주도 섹터 강세는 유지되나 단기 과열 부담.")
    lines.push("고점 추격보다 체결 강도 둔화 구간 확인 필요.")
    lines.push("분할 익절과 눌림 재진입 병행 권고.")
    return lines
  }
  if (stateKey === "panic" || stateKey === "fear") {
    lines.push("리스크 오프 우세, 변동성 방어가 우선.")
    lines.push("반등은 기술적 성격 가능성 높음.")
    lines.push("현금 비중 유지 + 분할 접근 권고.")
    return lines
  }
  lines.push("방향성은 중립, 테마별 차별화 진행.")
  lines.push(m.vix != null && m.vix <= 20 ? "변동성 안정권, 종목 선택 장세." : "변동성 재확대 가능성 점검 필요.")
  lines.push("주도 업종 눌림 구간 중심 대응.")
  return lines
}

export function buildAiMarketBrief(data) {
  const metrics = extractPanicMetrics(data)
  const marketState = resolveMarketState(data)
  const legacyKey = classifyState(metrics)
  const integrated = buildPanicIntegration({
    ...metrics,
    us10y: data?.us10y,
    usdkrw: data?.usdkrw,
  })
  const bullets = buildBullets(metrics)

  const shortStrategy =
    marketState.stateKey === "fear_dominant" || marketState.stateKey === "volatility_expansion"
      ? "변동성 급등 구간, 분할 접근 중심"
      : marketState.stateKey === "risk_on"
        ? "추격보다 눌림·지지 확인 우선"
        : marketState.stateKey === "defensive"
          ? "방어·현금 탄력, 신용 스프레드 점검"
          : "강한 테마 추격보다 눌림 관찰"
  const midStrategy =
    marketState.stateKey === "fear_dominant" || marketState.stateKey === "defensive"
      ? "방어적 섹터 우선, 현금 비중 유지"
      : "AI 인프라 사이클 지속 가능성 점검하며 비중 유지"
  const briefingLines = integrated.strategyHighlights?.length
    ? integrated.strategyHighlights
    : buildBriefingLines(legacyKey, metrics)

  return {
    state: marketState.label,
    stateKey: marketState.stateKey,
    stateColor: marketState.color,
    risk: integrated.riskLevel ?? marketState.risk,
    marketState,
    basisLabelKst: marketState.basisLabelKst,
    basisNote: marketState.basisNote,
    integration: integrated,
    headline: marketState.headline || integrated.interpretation,
    briefingLines,
    bullets,
    shortStrategy,
    midStrategy,
    sectors: {
      strong: [
        {
          name: "AI 반도체",
          score: marketState.stateKey === "fear_dominant" || marketState.stateKey === "defensive" ? 62 : 84,
          trend: "상승 추세 유지",
          comment: "수급 집중 지속",
        },
        { name: "전력/인프라", score: 76, trend: "눌림 후 재상승", comment: "정책·수요 모멘텀 유효" },
        { name: "원자재", score: 68, trend: "박스 상단 테스트", comment: "인플레 헤지 수요 반영" },
      ],
      weak: [
        { name: "2차전지", score: 39, trend: "약세 반등 실패", comment: "실적 확인 전 변동성 큼" },
        { name: "소비재", score: 44, trend: "횡보 하단", comment: "금리 민감도 부담" },
      ],
    },
  }
}
