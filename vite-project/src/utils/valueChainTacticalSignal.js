/**
 * Value chain 종목 패널 하단 — 일봉 스냅샷 기반 행동 가이드 요약 (투자 권유 아님).
 */

const STATUS_TO_STRATEGY = {
  "과매도·거래 감소 (반등 확인)": "반등 트리거 대기",
  "강세·거래 동반 (과열 주의)": "과열 경계·선별 대응",
  "거래량 동반 움직임": "수급 동반 추세 추적",
  "눌림·지지 확인 구간": "눌림 구간 관찰",
  "상방 에너지 유지": "상승 관성 유지",
  "박스 내 밸런스": "박스권 밸런스",
  "데이터 부족": "추가 확인 필요",
}

function buildActionBullets(snap) {
  const out = []
  const trend = snap?.movingAverage?.trend
  const vol = snap?.volumeChangePct
  const rsi = snap?.rsi14

  if (trend === "bullish") {
    out.push("20일선 지지·이탈과 재돌파 시 거래량을 함께 본다")
  } else if (trend === "bearish") {
    out.push("60일선·전고 저항에서 반등이 약하면 비중·손절 라인을 먼저 정리한다")
  } else {
    out.push("이평 혼재 구간에서는 방향 확정 전까지 분할·관망 비중을 유지한다")
  }

  if (vol != null) {
    if (vol < -12) {
      out.push("거래량 회복이 붙기 전까지 추격 매수는 자제한다")
    } else if (vol > 28) {
      out.push("거래 폭증 구간은 분할 체결과 손절 구간을 우선 점검한다")
    } else if (rsi != null && rsi > 62) {
      out.push("RSI 상단에서는 신규 진입보다 보유 포지션 관리에 무게를 둔다")
    } else if (rsi != null && rsi < 40) {
      out.push("RSI 하단에서는 반등 시 거래량 동반 여부를 확인한다")
    } else {
      out.push("가격 방향과 거래량 흐름이 같은지 당일·전일 흐름에서 교차 확인한다")
    }
  } else {
    out.push("거래량 추이를 차트에서 대조해 수급 지속성을 점검한다")
  }

  return out.slice(0, 2)
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
      positionLine: null,
      flowLine: null,
      bullets: [
        "일봉·보조지표를 불러오면 행동 가이드가 갱신됩니다.",
        `${label} 기준으로 타점 체크리스트 화면과 연결됩니다.`,
      ],
      tone: "muted",
    }
  }

  if (error || !snap?.narrative) {
    return {
      strategy: "시그널 확인 필요",
      positionLine: null,
      flowLine: null,
      bullets: [
        "일봉 엔진 응답이 없어 종목별 행동 가이드를 자동 채우지 못했습니다.",
        "매매 시그널 화면에서 시장 맥락·체크리스트를 함께 확인하세요.",
      ],
      tone: "warn",
    }
  }

  const { narrative } = snap
  const strategy = STATUS_TO_STRATEGY[narrative.status] ?? narrative.status
  const positionLine = narrative.position && narrative.position !== "산출 불가" ? narrative.position : null
  const flowLine = narrative.flow && narrative.flow !== "산출 불가" ? narrative.flow : null

  return {
    strategy,
    positionLine,
    flowLine,
    bullets: buildActionBullets(snap),
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
