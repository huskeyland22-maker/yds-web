/**
 * 실전 매매존 전략 엔진
 * - 거시 상태를 기반으로 종목 stage를 자동 보정
 * - UI는 기존 카드 디자인을 유지하고, 데이터만 치환해 사용
 */

/** @typedef {import("./tacticalTradingZoneData.js").TradingZonePosition} TradingZonePosition */

/** @param {unknown} v */
function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** @param {string} s */
function normalizeDate(s) {
  const d = String(s ?? "").slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : new Date().toISOString().slice(0, 10)
}

/**
 * @param {TradingZonePosition} p
 * @param {string} nextStage
 * @param {string} at
 */
function withShiftedStage(p, nextStage, at) {
  if (p.stage === nextStage) return p
  return {
    ...p,
    stage: /** @type {any} */ (nextStage),
    stageHistory: [...(p.stageHistory ?? []), { stage: /** @type {any} */ (nextStage), at }],
  }
}

/**
 * @param {{
 *   positions: TradingZonePosition[]
 *   panicData?: object | null
 *   engineLink?: { actions?: string[]; actionSummary?: string } | null
 * }} input
 */
export function buildTradingZoneStrategyState({ positions, panicData = null, engineLink = null }) {
  const vix = toNum(panicData?.vix)
  const fg = toNum(panicData?.fearGreed)
  const hy = toNum(panicData?.highYield ?? panicData?.hyOas)
  const date = normalizeDate(panicData?.date)

  const marketRiskUp =
    (vix != null && vix >= 28) || (hy != null && hy >= 5.8) || (fg != null && fg <= 30)
  const panicRecoveryEarly =
    (fg != null && fg >= 22 && fg <= 46) &&
    (vix == null || vix <= 30) &&
    (hy == null || hy <= 5.7)

  /** @type {string[]} */
  const transitions = []
  const adjusted = positions.map((p) => {
    let next = p
    if (marketRiskUp) {
      if (p.stage === "trend") {
        next = withShiftedStage(p, "pullback", date)
        transitions.push(`${p.symbol} 추세→눌림`)
      }
    } else if (panicRecoveryEarly) {
      if (p.stage === "pullback") {
        next = withShiftedStage(p, "interest", date)
        transitions.push(`${p.symbol} 눌림→관심`)
      } else if (p.stage === "interest" && (p.aux?.length ?? 0) >= 2) {
        next = withShiftedStage(p, "trend", date)
        transitions.push(`${p.symbol} 관심→추세`)
      }
    }
    return next
  })

  const banner = marketRiskUp
    ? "시장 위험 증가 → 눌림 대기 우선"
    : panicRecoveryEarly
      ? "패닉 회복 초기 → 관심 종목 확대"
      : engineLink?.actionSummary || "시장 중립 → 선별 대응 유지"

  const behavior = {
    reduceTrend: marketRiskUp,
    increasePullbackWait: marketRiskUp,
    restrictChasing: marketRiskUp,
    strongerTakeProfitWarning: marketRiskUp,
    enableScaleIn: panicRecoveryEarly,
  }

  // 향후 백테스트 연결용 준비 구조 (현재는 런타임 placeholder)
  const backtestSeed = {
    averageHoldingDays: null,
    winRate: null,
    maxDrawdown: null,
    targetHitRate: null,
    sampleSize: adjusted.length,
    updatedAt: date,
  }

  return {
    adjustedPositions: adjusted,
    banner,
    transitions,
    behavior,
    backtestSeed,
  }
}

