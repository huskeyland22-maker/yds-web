import { getAction, getFinalScore } from "./tradingScores.js"

function toNum(x) {
  const n = Number(x)
  return Number.isFinite(n) ? n : NaN
}

/**
 * 분할 매수 단계 (점수 높을수록 공포·역발상 매수 구간).
 * @returns {{ phase: string, step: number, allocationPct: number, message: string, kind: 'buy'|'neutral'|'danger' }}
 */
export function getBuySteps(score) {
  const x = toNum(score)
  const s = Number.isFinite(x) ? x : 0

  if (s >= 80) {
    return {
      step: 1,
      phase: "1차 진입",
      allocationPct: 30,
      message: "극단 공포에 가깝습니다. 계획 금액 대비 1차로 30%만 분할 진입을 검토하세요.",
      kind: "buy",
    }
  }
  if (s >= 70) {
    return {
      step: 2,
      phase: "2차 진입",
      allocationPct: 30,
      message: "공포가 유지되는 구간입니다. 2차 분할로 추가 30% 진입을 검토하세요.",
      kind: "buy",
    }
  }
  if (s >= 60) {
    return {
      step: 3,
      phase: "3차 진입",
      allocationPct: 20,
      message: "여전히 역발상 매수 여지가 있습니다. 3차로 20% 비중 진입을 검토하세요.",
      kind: "buy",
    }
  }
  if (s >= 50) {
    return {
      step: 4,
      phase: "4차 진입",
      allocationPct: 10,
      message: "신호가 약해지는 구간입니다. 소액(10%) 트레일링·눌림 분할만 검토하세요.",
      kind: "buy",
    }
  }
  if (s >= 40) {
    return {
      step: 0,
      phase: "관망",
      allocationPct: 0,
      message: "추가 지표·뉴스를 보고 진입 시점을 조정하세요. 신규 적극 매수는 자제합니다.",
      kind: "neutral",
    }
  }
  return {
    step: -1,
    phase: "매수 금지",
    allocationPct: 0,
    message: "점수가 낮아 역발상 매수 신호가 약합니다. 신규 매수는 피하고 기존 포지션만 점검하세요.",
    kind: "danger",
  }
}

/**
 * 익절·방어 (점수 낮을수록 탐욕·과열 쪽으로 가정).
 */
export function getSellStrategy(score) {
  const x = toNum(score)
  const s = Number.isFinite(x) ? x : 0

  if (s <= 20) {
    return {
      level: "full_exit",
      label: "전량 회피",
      message: "리스크가 크다고 판단됩니다. 신규 진입 중단·헷지·현금 비중 확대를 검토하세요.",
    }
  }
  if (s <= 25) {
    return {
      level: "aggressive",
      label: "적극 익절",
      message: "수익 구간이면 비중을 크게 줄이고, 손실 구간이면 손절 기준을 재확인하세요.",
    }
  }
  if (s <= 35) {
    return {
      level: "partial",
      label: "일부 익절",
      message: "일부 구간에서 이익 실현 또는 포지션 축소를 검토하세요.",
    }
  }
  return {
    level: "none",
    label: "익절 신호 없음",
    message: "현재 점수 구간에서는 별도 익절·방어 규칙을 강제하지 않습니다.",
  }
}

/**
 * VIX 기반 진입 비중 조정.
 * @returns {{ adjustedAllocation: number, blocked: boolean, factor: number, note: string }}
 */
export function adjustRisk(vix, baseAllocation) {
  const v = toNum(vix)
  const base = Math.max(0, Number(baseAllocation) || 0)

  if (!Number.isFinite(v)) {
    return { adjustedAllocation: base, blocked: false, factor: 1, note: "" }
  }
  if (v > 30) {
    return { adjustedAllocation: 0, blocked: true, factor: 0, note: "VIX 30 초과 — 신규 진입 금지" }
  }
  if (v > 25) {
    const adj = Math.round(base * 0.5)
    return {
      adjustedAllocation: adj,
      blocked: false,
      factor: 0.5,
      note: "VIX 25 초과 — 진입 비중 절반으로 축소",
    }
  }
  return { adjustedAllocation: base, blocked: false, factor: 1, note: "" }
}

function strategyHint(score, buyStep, riskAdj, sellStrategy) {
  if (riskAdj.blocked) {
    return "고변동 구간입니다. VIX 안정 후 분할 계획을 다시 세우세요."
  }
  if (sellStrategy.level !== "none") {
    return "낮은 점수 구간 — 익절·손절 규칙을 우선 적용하세요."
  }
  if (buyStep.kind === "neutral") {
    return "관망 구간 — 눌림·추가 악재 시에만 소액 분할을 검토하세요."
  }
  if (buyStep.kind === "danger") {
    return "매수 금지 구간 — 현금·질 좋은 자산 위주로 대기하세요."
  }
  if (buyStep.step >= 1 && buyStep.step <= 4) {
    return "추천: 눌림 시 분할 진입, 한 번에 올인하지 않기."
  }
  return "점수·VIX 변화에 맞춰 단계를 재평가하세요."
}

function riskLevelLabel(vix, blocked) {
  const v = toNum(vix)
  if (!Number.isFinite(v)) return "보통"
  if (blocked || v > 30) return "매우 높음 (진입 금지)"
  if (v > 25) return "상승 (분할 축소)"
  return "보통"
}

/** 패널 색: 매수 초록 / 중립 노랑 / 위험 빨강 */
export function getStrategyPanelTone(signal) {
  if (signal.sellStrategy.level === "full_exit" || signal.sellStrategy.level === "aggressive") {
    return "danger"
  }
  if (signal.riskAdj.blocked || signal.buyStep.kind === "danger") {
    return "danger"
  }
  if (signal.sellStrategy.level === "partial" || signal.buyStep.kind === "neutral") {
    return "neutral"
  }
  return "buy"
}

/**
 * 최종 매매 전략 (서버 data 한 번에).
 */
export function getTradingSignal(data) {
  const score = getFinalScore(data)
  const action = getAction(score)
  const buyStep = getBuySteps(score)
  const sellStrategy = getSellStrategy(score)
  const riskAdj = adjustRisk(data.vix, buyStep.allocationPct)

  const effectivePct = riskAdj.blocked ? 0 : riskAdj.adjustedAllocation
  const riskLevel = riskLevelLabel(data.vix, riskAdj.blocked)

  let strategyHeadline = ""
  if (riskAdj.blocked) {
    strategyHeadline = `현재 전략: 진입 금지 (VIX ${Number(data.vix).toFixed(1)})`
  } else if (buyStep.phase === "매수 금지") {
    strategyHeadline = "현재 전략: 매수 금지"
  } else if (buyStep.phase === "관망") {
    strategyHeadline = "현재 전략: 관망 (신규 0%)"
  } else {
    strategyHeadline = `현재 전략: ${buyStep.step}차 매수 진행 (${effectivePct}%)`
  }

  const hint = strategyHint(score, buyStep, riskAdj, sellStrategy)

  const signal = {
    score,
    action,
    buyStep: {
      ...buyStep,
      effectiveAllocationPct: effectivePct,
      baseAllocationPct: buyStep.allocationPct,
    },
    sellStrategy,
    riskAdj,
    riskLevel,
    strategyHeadline,
    strategyHint: hint,
  }
  return { ...signal, panelTone: getStrategyPanelTone(signal) }
}
