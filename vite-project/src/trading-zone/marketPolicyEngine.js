/**
 * 단일 Market Policy Engine
 * - 시장 상태 계산
 * - 행동 정책/리스크 강도/섹터 바이어스 통합
 */

/**
 * @typedef {"overheat" | "caution" | "neutral" | "pullback" | "panic"} MarketState
 * @typedef {"low" | "mid" | "high"} MarketRiskLevel
 * @typedef {"safe" | "caution" | "danger"} ActionLevel
 * @typedef {"no-change" | "recovery" | "risk-onset" | "risk-expansion" | "stabilization"} TransitionState
 * @typedef {"hidden" | "tag" | "highlight" | "strong"} TransitionVisibility
 */

/**
 * @param {{ panicData?: object | null; positionStage?: string | null; panicStage?: string | null }} input
 * @returns {MarketState}
 */
function resolveMarketState({ panicData = null, positionStage = null, panicStage = null }) {
  const fg = Number(panicData?.fearGreed)
  const vix = Number(panicData?.vix)
  const hasPanicStage = typeof panicStage === "string" && /panic|fear|risk/i.test(panicStage)
  const hasOverheatStage = typeof panicStage === "string" && /greed|heat|over/i.test(panicStage)

  if (hasPanicStage || positionStage === "risk" || (Number.isFinite(vix) && vix >= 33)) return "panic"
  if (hasOverheatStage || positionStage === "takeProfit" || (Number.isFinite(fg) && fg >= 78)) return "overheat"
  if (positionStage === "pullback" || (Number.isFinite(vix) && vix >= 25)) return "pullback"
  if ((Number.isFinite(vix) && vix >= 21) || (Number.isFinite(fg) && fg <= 35)) return "caution"
  return "neutral"
}

/**
 * @param {MarketState} state
 * @returns {MarketRiskLevel}
 */
function resolveRiskLevel(state) {
  if (state === "panic" || state === "overheat") return "high"
  if (state === "pullback" || state === "caution") return "mid"
  return "low"
}

/**
 * @param {MarketState} state
 */
function buildActionPolicy(state) {
  /** @type {Record<MarketState, { lead: string; tacticalMode: string; uiTone: string; items: { key: string; icon: string; text: string; level: ActionLevel }[] }>} */
  const byState = {
    panic: {
      lead: "패닉 회복/확산 구간, 분할 기준 우선",
      tacticalMode: "defense-accumulate",
      uiTone: "red",
      items: [
        { key: "split-buy", icon: "🟠", text: "분할매수 강화", level: "safe" },
        { key: "ban-allin", icon: "⛔", text: "일괄 진입 금지", level: "danger" },
        { key: "vol-check", icon: "⚠", text: "변동성 재확인 후 진입", level: "caution" },
      ],
    },
    overheat: {
      lead: "과열 구간, 추격 억제 + 현금 확보",
      tacticalMode: "risk-off",
      uiTone: "orange",
      items: [
        { key: "wait-pullback", icon: "🟡", text: "눌림 대기", level: "caution" },
        { key: "ban-chase", icon: "⛔", text: "추격 매수 금지", level: "danger" },
        { key: "cash-up", icon: "🧊", text: "현금 비중 확대", level: "danger" },
      ],
    },
    pullback: {
      lead: "조정 구간, 선택 종목 분할 대응",
      tacticalMode: "pullback",
      uiTone: "yellow",
      items: [
        { key: "watch-core", icon: "🟢", text: "핵심 종목 압축 관찰", level: "safe" },
        { key: "split-entry", icon: "✅", text: "눌림 시 분할 진입", level: "safe" },
        { key: "ban-chase", icon: "⚠", text: "추격 진입 제한", level: "danger" },
      ],
    },
    caution: {
      lead: "경계 구간, 리스크 선확인",
      tacticalMode: "balanced-defense",
      uiTone: "amber",
      items: [
        { key: "watch-selective", icon: "🟢", text: "선택 종목 감시", level: "safe" },
        { key: "risk-check", icon: "⚠", text: "리스크 신호 우선 확인", level: "caution" },
        { key: "ban-chase", icon: "⛔", text: "추격 매수 금지", level: "danger" },
      ],
    },
    neutral: {
      lead: "중립 구간, 기다림 허용 + 선택 집중",
      tacticalMode: "balanced",
      uiTone: "green",
      items: [
        { key: "focus-core", icon: "🟢", text: "선택 종목 압축", level: "safe" },
        { key: "wait-pullback", icon: "🟡", text: "눌림 대기", level: "caution" },
        { key: "ban-chase", icon: "⛔", text: "추격 금지", level: "danger" },
      ],
    },
  }
  return byState[state]
}

/**
 * @param {ReturnType<typeof buildActionPolicy>} actionPolicy
 * @returns {{ primary: string; caution: string; execution: string; summary: string }}
 */
function buildActionLines(actionPolicy) {
  const items = actionPolicy?.items ?? []
  const primary = items.find((item) => item.level === "safe")?.text ?? items[0]?.text ?? "핵심 종목 감시"
  const caution = items.find((item) => item.level === "danger")?.text ?? "리스크 우선 점검"
  const execution = items.find((item) => item.level === "caution")?.text ?? items[1]?.text ?? "분할 기준 유지"
  const summary = `🟢 ${primary} | ⚠ ${caution}`
  return { primary, caution, execution, summary }
}

/**
 * @param {MarketState} state
 */
function buildSectorBias(state) {
  if (state === "panic") return { label: "방어 + 초과낙폭 분할", sectors: ["현금", "방어주", "초과낙폭 ETF"] }
  if (state === "overheat") return { label: "고베타 축소", sectors: ["현금", "대형주", "방어주"] }
  if (state === "pullback") return { label: "성장주 눌림 우선", sectors: ["AI", "반도체", "대형 테크"] }
  if (state === "caution") return { label: "균형 방어", sectors: ["대형주", "퀄리티", "현금"] }
  return { label: "선택 집중", sectors: ["반도체", "AI", "로봇"] }
}

/**
 * @param {MarketState} state
 * @returns {{ newEntry: "open" | "limited" | "blocked"; chase: "allowed" | "discouraged" | "blocked"; splitBuy: "encourage" | "allow" | "strict"; cash: "low" | "mid" | "high" }}
 */
function buildStockActionRange(state) {
  if (state === "panic") return { newEntry: "limited", chase: "blocked", splitBuy: "encourage", cash: "mid" }
  if (state === "overheat") return { newEntry: "blocked", chase: "blocked", splitBuy: "strict", cash: "high" }
  if (state === "pullback") return { newEntry: "open", chase: "discouraged", splitBuy: "encourage", cash: "mid" }
  if (state === "caution") return { newEntry: "limited", chase: "discouraged", splitBuy: "allow", cash: "mid" }
  return { newEntry: "open", chase: "discouraged", splitBuy: "allow", cash: "low" }
}

/**
 * @param {ReturnType<typeof buildStockActionRange>} range
 * @returns {{ icon: string; text: string; tone: "ok" | "warn" | "danger" }[]}
 */
export function buildTodayActionBarRows(range) {
  if (!range) return []

  /** @type {{ icon: string; text: string; tone: "ok" | "warn" | "danger" }[]} */
  const rows = []

  if (range.newEntry === "open") rows.push({ icon: "✓", text: "신규 진입 가능", tone: "ok" })
  else if (range.newEntry === "limited") rows.push({ icon: "⚠", text: "신규 진입 제한", tone: "warn" })
  else rows.push({ icon: "⛔", text: "신규 진입 금지", tone: "danger" })

  if (range.splitBuy === "encourage") rows.push({ icon: "✓", text: "분할매수 강화", tone: "ok" })
  else if (range.splitBuy === "allow") rows.push({ icon: "✓", text: "분할매수 가능", tone: "ok" })
  else rows.push({ icon: "⚠", text: "분할매수 보수", tone: "warn" })

  if (range.chase === "blocked") rows.push({ icon: "⚠", text: "추격 금지", tone: "warn" })
  else if (range.chase === "discouraged") rows.push({ icon: "⚠", text: "추격 진입 제한", tone: "warn" })
  else rows.push({ icon: "✓", text: "추격 허용", tone: "ok" })

  return rows
}

/** @type {Record<MarketState, number>} */
const MARKET_STATE_ORDER = {
  panic: 0,
  caution: 1,
  pullback: 2,
  neutral: 3,
  overheat: 4,
}

/**
 * @param {ReturnType<typeof buildMarketPolicy> | null | undefined} prevPolicy
 * @param {ReturnType<typeof buildMarketPolicy> | null | undefined} currentPolicy
 * @returns {{
 *   changed: boolean
 *   transitionState: TransitionState
 *   transitionStrength: "low" | "mid" | "high"
 *   transitionLabel: string
 *   directionTag: string
 * }}
 */
export function detectMarketTransition(prevPolicy, currentPolicy) {
  const prev = prevPolicy?.marketState
  const next = currentPolicy?.marketState
  const prevVix = Number(prevPolicy?.metrics?.vix)
  const nextVix = Number(currentPolicy?.metrics?.vix)
  const prevFg = Number(prevPolicy?.metrics?.fearGreed)
  const nextFg = Number(currentPolicy?.metrics?.fearGreed)
  const stateDelta = Math.abs((MARKET_STATE_ORDER[next] ?? 0) - (MARKET_STATE_ORDER[prev] ?? 0))
  const riskScale = { low: 0, mid: 1, high: 2 }
  const riskDelta = Math.abs((riskScale[currentPolicy?.riskLevel ?? "low"] ?? 0) - (riskScale[prevPolicy?.riskLevel ?? "low"] ?? 0))
  const vixDelta = Number.isFinite(prevVix) && Number.isFinite(nextVix) ? Math.abs(nextVix - prevVix) : 0
  const fgDelta = Number.isFinite(prevFg) && Number.isFinite(nextFg) ? Math.abs(nextFg - prevFg) : 0
  const prevKeys = new Set((prevPolicy?.actionPolicy?.items ?? []).map((item) => item.key || item.text))
  const nextKeys = new Set((currentPolicy?.actionPolicy?.items ?? []).map((item) => item.key || item.text))
  let actionChangedCount = 0
  for (const key of nextKeys) {
    if (!prevKeys.has(key)) actionChangedCount += 1
  }
  let transitionConfidence = Math.min(
    100,
    Math.round(
      Math.min(42, stateDelta * 16) +
      Math.min(18, riskDelta * 9) +
      Math.min(16, vixDelta * 1.8) +
      Math.min(14, fgDelta * 0.6) +
      Math.min(10, actionChangedCount * 4) +
      (stateDelta >= 1 ? 8 : 0),
    ),
  )
  // Noise guard: tiny one-day oscillations stay internal.
  if (stateDelta <= 1 && vixDelta < 1.8 && fgDelta < 4) transitionConfidence = Math.max(0, transitionConfidence - 22)
  const visibility =
    transitionConfidence >= 85 ? "strong"
      : transitionConfidence >= 70 ? "highlight"
        : transitionConfidence >= 40 ? "tag"
          : "hidden"
  if (!prev || !next || prev === next) {
    return {
      changed: false,
      transitionState: "no-change",
      transitionStrength: "low",
      transitionLabel: "상태 유지",
      directionTag: "→ 상태 유지",
      transitionConfidence: 0,
      visibility: "hidden",
    }
  }
  const delta = (MARKET_STATE_ORDER[next] ?? 0) - (MARKET_STATE_ORDER[prev] ?? 0)
  /** @param {{transitionState: TransitionState, transitionStrength: "low"|"mid"|"high", transitionLabel: string, directionTag: string}} base */
  const withConfidence = (base) => ({
    ...base,
    transitionConfidence,
    visibility,
  })
  if (visibility === "hidden") {
    return withConfidence({
      changed: false,
      transitionState: "no-change",
      transitionStrength: "low",
      transitionLabel: "미세 변동",
      directionTag: "→ 미세 변동",
    })
  }
  if ((prev === "panic" || prev === "caution") && (next === "pullback" || next === "neutral")) {
    return withConfidence({
      changed: true,
      transitionState: "recovery",
      transitionStrength: Math.abs(delta) >= 2 ? "high" : "mid",
      transitionLabel: transitionConfidence >= 70 ? "회복 강화" : "약한 회복",
      directionTag: transitionConfidence >= 70 ? "↑ 회복 강화" : "↗ 회복 신호",
    })
  }
  if (prev === "panic" && next === "caution") {
    return withConfidence({
      changed: true,
      transitionState: "stabilization",
      transitionStrength: "mid",
      transitionLabel: "안정화 진입",
      directionTag: "↑ 안정화 진입",
    })
  }
  if (next === "overheat" || (prev !== "overheat" && next === "caution" && delta > 0)) {
    return withConfidence({
      changed: true,
      transitionState: "risk-onset",
      transitionStrength: next === "overheat" ? "high" : "mid",
      transitionLabel: transitionConfidence >= 75 ? "강한 과열 접근" : "과열 접근",
      directionTag: transitionConfidence >= 75 ? "⚠ 과열 접근" : "⚠ 과열 징후",
    })
  }
  if (delta < 0) {
    return withConfidence({
      changed: true,
      transitionState: "risk-expansion",
      transitionStrength: Math.abs(delta) >= 2 ? "high" : "mid",
      transitionLabel: transitionConfidence >= 70 ? "변동성 확대" : "변동성 흔들림",
      directionTag: transitionConfidence >= 70 ? "↓ 변동성 확대" : "↓ 변동성 주의",
    })
  }
  return withConfidence({
    changed: true,
    transitionState: "recovery",
    transitionStrength: "low",
    transitionLabel: "완만한 회복",
    directionTag: "↑ 완만한 회복",
  })
}

/**
 * @param {Array<{ at: string; marketState: MarketState; transitionLabel: string; transitionConfidence: number }>} history
 * @param {ReturnType<typeof detectMarketTransition>} transition
 * @param {ReturnType<typeof buildMarketPolicy>} policy
 * @returns {Array<{ at: string; marketState: MarketState; transitionLabel: string; transitionConfidence: number }>}
 */
export function appendTransitionHistory(history, transition, policy) {
  if (!transition?.changed || !policy?.marketState || (transition.transitionConfidence ?? 0) < 40) return history ?? []
  const next = [
    ...(history ?? []),
    {
      at: new Date().toISOString(),
      marketState: policy.marketState,
      transitionLabel: transition.transitionLabel,
      transitionConfidence: transition.transitionConfidence ?? 0,
    },
  ]
  return next.slice(-10)
}

/**
 * @param {{ id?: string; score?: number | null }} card
 * @param {MarketState} marketState
 * @returns {string}
 */
export function resolveHorizonStatusLabel(card, marketState) {
  const id = card?.id
  if (id === "tactical") return "추격 제한"
  if (id === "short") {
    if (marketState === "overheat" || marketState === "panic") return "추격 제한"
    if (marketState === "caution") return "눌림 대기"
    return "눌림 우세"
  }
  if (id === "mid") {
    if (marketState === "overheat" || marketState === "panic") return "리스크 관리"
    if (marketState === "caution") return "선별 대기"
    return "선별 대응"
  }
  if (id === "long") {
    if (marketState === "overheat") return "고점 경계"
    if (marketState === "panic") return "방어 우선"
    if (marketState === "caution") return "밸류 점검"
    return "고점 경계"
  }
  return marketState === "overheat" || marketState === "panic" ? "추격 제한" : "선별 대응"
}

/** @type {Record<MarketState, Record<"fearGreed" | "vix" | "bofa", string>>} */
const CORE_METRIC_POLICY_HINT = {
  overheat: {
    fearGreed: "추격 금지",
    vix: "신규 제한",
    bofa: "현금 확보",
  },
  caution: {
    fearGreed: "추격 금지",
    vix: "눌림 대기",
    bofa: "현금 확보",
  },
  neutral: {
    fearGreed: "추격 금지",
    vix: "눌림 대기",
    bofa: "현금 확보",
  },
  pullback: {
    fearGreed: "눌림 대기",
    vix: "분할 진입",
    bofa: "분할 진입",
  },
  panic: {
    fearGreed: "분할 매수",
    vix: "현금 확보",
    bofa: "분할 매수",
  },
}

/**
 * 핵심 지표 카드 — Market Policy Engine 기반 행동 해석 (데이터 상태와 분리)
 * @param {"fearGreed" | "vix" | "bofa"} metricKey
 * @ {{ marketState?: MarketState } | null | undefined} marketPolicy
 */
export function resolveCoreMetricPolicyHint(metricKey, marketPolicy) {
  const state = marketPolicy?.marketState ?? "neutral"
  return CORE_METRIC_POLICY_HINT[state]?.[metricKey] ?? CORE_METRIC_POLICY_HINT.neutral[metricKey] ?? "추격 금지"
}

/**
 * @param {string} label
 * @returns {"pullback" | "selective" | "guard" | "limit" | "neutral"}
 */
export function resolveHorizonStatusTone(label) {
  if (label === "눌림 우세" || label === "눌림 대기") return "pullback"
  if (label === "선별 대응" || label === "선별 대기") return "selective"
  if (label === "고점 경계" || label === "밸류 점검" || label === "방어 우선" || label === "리스크 관리") return "guard"
  if (label === "추격 제한") return "limit"
  return "neutral"
}

/**
 * @param {{ panicData?: object | null; position?: { stage?: string } | null; panicStage?: string | null }} input
 */
export function buildMarketPolicy(input = {}) {
  const marketState = resolveMarketState({
    panicData: input.panicData,
    positionStage: input.position?.stage ?? null,
    panicStage: input.panicStage ?? null,
  })
  const riskLevel = resolveRiskLevel(marketState)
  const actionPolicy = buildActionPolicy(marketState)
  const actionLines = buildActionLines(actionPolicy)
  const sectorBias = buildSectorBias(marketState)
  const stockActionRange = buildStockActionRange(marketState)
  const metrics = {
    vix: Number(input?.panicData?.vix),
    fearGreed: Number(input?.panicData?.fearGreed),
  }
  const marketStateLabel =
    marketState === "panic"
      ? "패닉"
      : marketState === "overheat"
        ? "과열"
        : marketState === "pullback"
          ? "눌림"
          : marketState === "caution"
            ? "경계"
            : "중립"

  return {
    marketState,
    marketStateLabel,
    riskLevel,
    actionPolicy,
    actionLines,
    sectorBias,
    stockActionRange,
    marketTransition: null,
    metrics,
    tacticalMode: actionPolicy.tacticalMode,
    uiTone: actionPolicy.uiTone,
  }
}

/**
 * @param {{
 *   marketStateLabel?: string
 *   actionLines?: { primary?: string; caution?: string; execution?: string }
 *   sectorBias?: { sectors?: string[] }
 * }} policy
 * @returns {string}
 */
export function buildPolicyBriefing(policy) {
  const stateLabel = policy?.marketStateLabel ?? "중립"
  const sectors = policy?.sectorBias?.sectors?.slice(0, 2).join(" / ") || "핵심 섹터"
  const primary = policy?.actionLines?.primary ?? "관심 종목 감시"
  const caution = policy?.actionLines?.caution ?? "추격 금지"
  const execution = policy?.actionLines?.execution ?? "분할 대응"
  const confidence = policy?.marketTransition?.transitionConfidence ?? 0
  const transitionLine = policy?.marketTransition?.changed && confidence >= 40
    ? `${confidence >= 85 ? "강한 변화 감지:" : confidence >= 70 ? "의미 변화 감지:" : "약한 변화 신호:"} ${policy.marketTransition.directionTag}. `
    : ""
  return `${transitionLine}${stateLabel} 정책: ${primary}. ${execution}. ${caution}. ${sectors} 우선 점검.`
}

