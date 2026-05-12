/**
 * 밸류체인 패널 하단 — 행동 전략·체크리스트 (상단 객관 상태와 문구 분리).
 */

function buildStrategyLine(snap) {
  const trend = snap?.movingAverage?.trend
  const vt = snap?.panel?.volumeTier
  const vol = snap?.volumeChangePct
  const rsi = snap?.rsi14

  if (trend === "bullish") {
    if (vt === "cold" || vt === "down" || (vol != null && vol < -12)) {
      return "추격보다 눌림·지지 확인 우선"
    }
    if (vt === "explosion" || (rsi != null && rsi > 68)) {
      return "급변 구간·분할·손절 라인 정리에 무게"
    }
    if (vt === "inflow" || vt === "lift") {
      return "추세 추종 시에도 과열 구간만 선별"
    }
    return "박스·이격 구간에서는 확인 매수 위주"
  }

  if (trend === "bearish") {
    return "반등은 저항 확인 후, 약하면 비중 축소"
  }

  return "방향 확정 전 분할·관망으로 대기"
}

function buildCheckpoints(snap) {
  const trend = snap?.movingAverage?.trend
  const vol = snap?.volumeChangePct
  /** @type {string[]} */
  const cps = []

  if (trend === "bullish") {
    cps.push("20일선 지지·이탈 여부")
  } else if (trend === "bearish") {
    cps.push("60일선·전고 저항대 반응")
  } else {
    cps.push("20·60일선 방향·수렵 여부")
  }

  if (vol != null && vol < -15) {
    cps.push("거래량 회복 여부")
  } else if (vol != null && vol > 35) {
    cps.push("거래 폭증 구간 분할·손절 재설정")
  } else {
    cps.push("거래량이 가격 방향과 맞는지")
  }

  cps.push("외국인·기관 순매수 추이(당일·전일)")

  return cps.slice(0, 3)
}

/**
 * @param {object | null} snap — /api/stock-indicators 페이로드
 * @param {{ loading?: boolean; error?: boolean; stock?: { name?: string; code?: string } }} ctx
 */
export function buildValueChainTacticalSignal(snap, ctx = {}) {
  const { loading, error, stock } = ctx

  if (loading) {
    const label = stock?.name ? `${stock.name}` : "선택 종목"
    return {
      strategy: "지표 동기화 중",
      checkpoints: [
        "일봉·보조지표 로딩 후 갱신됩니다.",
        `${label} 기준 체크리스트로 이어집니다.`,
        "매매 시그널 화면에서 맥락을 보완하세요.",
      ],
      tone: "muted",
    }
  }

  if (error || !snap?.panel) {
    return {
      strategy: "시그널 확인 필요",
      checkpoints: [
        "일봉 엔진 응답이 없어 자동 체크리스트를 채우지 못했습니다.",
        "매매 시그널 화면에서 시장·수급 맥락을 함께 확인하세요.",
      ],
      tone: "warn",
    }
  }

  return {
    strategy: buildStrategyLine(snap),
    checkpoints: buildCheckpoints(snap),
    tone: "ok",
  }
}

export function timingPageSearchParams(stock) {
  if (!stock?.code) return ""
  const q = new URLSearchParams()
  q.set("code", String(stock.code).replace(/\D/g, "").padStart(6, "0"))
  if (stock.name) q.set("name", String(stock.name))
  return `?${q.toString()}`
}
