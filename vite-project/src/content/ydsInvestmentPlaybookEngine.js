/**
 * YDS 투자 원칙 센터 (Playbook) — 시장·패닉·수익/손실·포트폴리오 원칙 + 준수율
 */

import { MARKET_STATE_STRATEGY } from "./ydsMarketStateCenter.js"
import { MARKET_POSITION_STAGES } from "./ydsMarketPositionEngine.js"
import { MACRO_V1_STATUS_BANDS } from "../panic-v2/panicMacroV1Status.js"
import { computeRecommendedAssetAllocation } from "./ydsPortfolioAllocationEngine.js"
import { buildV5Analysis, buildV5Holdings } from "./ydsPortfolioV5Engine.js"
import { resolveMarketStateCenterView } from "./ydsMarketStateCenter.js"

/** @typedef {import("./ydsMarketAdapter.js").YdsMarketAdapterContext} YdsMarketAdapterContext */
/** @typedef {import("./ydsPortfolioTradesStorage.js").PortfolioTrade} PortfolioTrade */

/** Playbook 전용 시장상태 라벨 (위축→공포, 충격→패닉) */
export const PLAYBOOK_MARKET_LABELS = {
  overheat: "과열",
  boundary: "경계",
  adjustment: "조정",
  fear: "공포",
  panic: "패닉",
}

/** @type {Record<string, { actions: string[]; avoid: string[]; cash: string }>} */
export const PLAYBOOK_MARKET_PRINCIPLES = {
  overheat: {
    actions: ["현금 60% 이상 유지", "익절·비중 축소 검토", "신규 추격매수 금지", "핵심 우량주만 홀딩"],
    avoid: ["급등주 추격", "레버리지 확대", "전량 신규 진입"],
    cash: "현금 비중 확대 · 주식 40% 이하 권장",
  },
  boundary: {
    actions: ["수익 구간 분할매도 검토", "신규 진입 축소", "현금 유지·소폭 확대", "TOP10 내 선별 관찰"],
    avoid: ["과열 섹터 추가 매수", "단기 급등 추격"],
    cash: "현금 50% 전후 · 비중 점검",
  },
  adjustment: {
    actions: ["관심 종목 발굴·워치리스트", "소량 분할 접근만", "현금 유지", "눌림 구간 대기"],
    avoid: ["전량 일괄 매수", "낮은 품질 종목"],
    cash: "현금 40~50% · 기회 대기",
  },
  fear: {
    actions: ["우량주 소량 분할매수", "현금에서 주식으로 점진 이동", "AI·반도체·전력 핵심만", "변동성 대비"],
    avoid: ["공포 매도", "저품질 저가 매수"],
    cash: "현금 25~35% · 분할 시작",
  },
  panic: {
    actions: ["계획된 현금 투입", "우량주 적극 분할매수", "장기 핵심 자산 집중", "일시적 변동성 감내"],
    avoid: ["현금 100% 방치", "레버리지 과다"],
    cash: "현금 5~15% · 공격적 배분",
  },
}

/** @type {{ min: number; max: number; label: string; rules: string[] }[]} */
export const PLAYBOOK_PANIC_BANDS = [
  {
    min: 0,
    max: 20,
    label: "0~20 · 공포 없음",
    rules: ["신규 매수 0%", "현금·방어 유지", "추격·레버리지 금지", "익절·비중 축소 우선"],
  },
  {
    min: 20,
    max: 40,
    label: "20~40 · 공포 부족",
    rules: ["월 투입 10% 이내", "소량 관심 등록", "분할 3회 이상", "현금 55% 이상"],
  },
  {
    min: 40,
    max: 60,
    label: "40~60 · 관심",
    rules: ["월 투입 20% 목표", "우량주 2~3종목 분할", "한 종목 5% 이내", "추격 금지"],
  },
  {
    min: 60,
    max: 80,
    label: "60~80 · 분할매수",
    rules: ["월 투입 50% 목표", "4~6회 분할", "섹터 분산", "현금 15~30%"],
  },
  {
    min: 80,
    max: 100,
    label: "80~100 · 인생 타점",
    rules: ["계획 현금의 80%까지 투입 가능", "우량주 집중", "변동성 감내", "장기 보유 전제"],
  },
]

/** @type {{ threshold: number; label: string; action: string }[]} */
export const PLAYBOOK_PROFIT_RULES = [
  { threshold: 20, label: "+20%", action: "1차 익절·비중 10~20% 축소 검토" },
  { threshold: 30, label: "+30%", action: "추가 익절·핵심만 홀딩 · 추격매수 금지" },
  { threshold: 50, label: "+50%", action: "과열 구간 · 30~50% 차익·트레일링 스탑" },
]

/** @type {{ threshold: number; label: string; action: string }[]} */
export const PLAYBOOK_LOSS_RULES = [
  { threshold: -10, label: "-10%", action: "원칙 재점검 · 추가 매수 자제 · 손절선 설정" },
  { threshold: -15, label: "-15%", action: "비중 축소 검토 · 투자 논거 재확인" },
  { threshold: -20, label: "-20%", action: "손절·전량 정리 검토 · 감정 매도 금지" },
]

/**
 * @param {YdsMarketAdapterContext | null | undefined} ctx
 * @param {object | null | undefined} panicData
 */
export function buildPlaybookSnapshot(ctx, panicData = null) {
  const center = panicData ? resolveMarketStateCenterView(panicData) : null
  const positionId = center?.position?.id ?? ctx?.marketPositionId ?? "adjustment"
  const panicScore = center?.panicScore ?? ctx?.ydsScore ?? null
  const macroId = center?.macroId ?? ctx?.macroId ?? "neutral"
  const recommended = ctx?.ready ? computeRecommendedAssetAllocation(ctx) : computeRecommendedAssetAllocation({ macroId, isDefensive: true, cycleStageId: "normal" })

  const marketPrinciples = MARKET_POSITION_STAGES.map((stage) => {
    const id = stage.id
    const strategy = MARKET_STATE_STRATEGY[id]
    const extra = PLAYBOOK_MARKET_PRINCIPLES[id]
    return {
      id,
      emoji: stage.emoji,
      label: PLAYBOOK_MARKET_LABELS[id] ?? stage.label,
      strategy: strategy?.strategy ?? "—",
      actions: extra?.actions ?? strategy?.actions ?? [],
      avoid: extra?.avoid ?? [],
      cashGuide: extra?.cash ?? "—",
      isCurrent: id === positionId,
    }
  })

  const activeBand = MACRO_V1_STATUS_BANDS.find(
    (b) => panicScore != null && panicScore >= b.min && panicScore <= b.max,
  )

  return {
    currentMarketLabel: PLAYBOOK_MARKET_LABELS[positionId] ?? positionId,
    currentMarketId: positionId,
    panicScore,
    activePanicBand: activeBand,
    marketPrinciples,
    panicBands: PLAYBOOK_PANIC_BANDS,
    profitRules: PLAYBOOK_PROFIT_RULES,
    lossRules: PLAYBOOK_LOSS_RULES,
    portfolio: {
      recommendedCashPct: recommended.cashPct,
      recommendedStockPct: recommended.stockPct,
      recommendedUsPct: recommended.usPct,
      recommendedKrPct: recommended.krPct,
      note: recommended.note,
    },
    buyIntensityPct: center?.buyIntensityPct ?? null,
  }
}

/**
 * @param {YdsMarketAdapterContext | null | undefined} ctx
 * @param {PortfolioTrade[]} trades
 * @param {number} cashAmount
 * @param {Map<string, unknown>} quoteMap
 * @param {number | null | undefined} usdkrw
 * @param {object | null | undefined} panicData
 */
export function computePlaybookCompliance(ctx, trades, cashAmount, quoteMap, usdkrw, panicData = null) {
  const snapshot = buildPlaybookSnapshot(ctx, panicData)
  const analysis = buildV5Analysis(trades ?? [], cashAmount ?? 0, ctx, quoteMap, usdkrw)
  const holdings = buildV5Holdings(trades ?? [], cashAmount ?? 0, quoteMap, "returnPct", usdkrw)
  const rows = holdings?.rows ?? []
  const actualCash = analysis.actual?.cashPct ?? 0
  const recCash = snapshot.portfolio.recommendedCashPct

  /** @type {{ id: string; label: string; ok: boolean; detail: string; weight: number }[]} */
  const items = []

  const cashDiff = Math.abs(actualCash - recCash)
  items.push({
    id: "cash",
    label: "현금 비중",
    ok: cashDiff <= 12,
    detail: `실제 ${actualCash}% · 권장 ${recCash}% (차이 ${Math.round(cashDiff)}%p)`,
    weight: 25,
  })

  const positionId = snapshot.currentMarketId
  const defensiveStates = ["overheat", "boundary"]
  const aggressiveStates = ["fear", "panic"]
  const recentTrades = (trades ?? []).filter((t) => t.action === "buy" || t.action === "sell").slice(0, 8)

  let tradeOk = 0
  let tradeTotal = 0
  for (const t of recentTrades) {
    tradeTotal += 1
    let ok = true
    if (defensiveStates.includes(positionId) && t.action === "buy") ok = false
    if (aggressiveStates.includes(positionId) && t.action === "sell") ok = false
    if (ok) tradeOk += 1
  }

  const tradeCompliance = tradeTotal ? Math.round((tradeOk / tradeTotal) * 100) : 70
  items.push({
    id: "trades",
    label: "최근 거래 방향",
    ok: tradeCompliance >= 60,
    detail:
      tradeTotal > 0
        ? `${snapshot.currentMarketLabel} 구간 · 최근 ${tradeTotal}건 중 ${tradeOk}건 적합`
        : "거래 기록 없음 · 중립 평가",
    weight: 30,
  })

  let profitViolations = 0
  let lossViolations = 0
  for (const row of rows) {
    const ret = row.returnPct
    if (ret == null) continue
    if (ret >= 50 && row.weightPct >= 25) profitViolations += 1
    if (ret <= -20 && row.weightPct >= 15) lossViolations += 1
  }

  const holdingScore =
    rows.length === 0
      ? 65
      : Math.max(0, 100 - profitViolations * 20 - lossViolations * 25)

  items.push({
    id: "holdings",
    label: "수익·손실 원칙",
    ok: holdingScore >= 65,
    detail:
      rows.length > 0
        ? `과열 비중 ${profitViolations}건 · 깊은 손실 ${lossViolations}건`
        : "보유 없음 · 해당 없음",
    weight: 25,
  })

  const tradeScore = tradeTotal ? tradeCompliance : 70
  const cashScore = cashDiff <= 12 ? 100 : cashDiff <= 20 ? 70 : Math.max(30, 100 - cashDiff * 2)
  const weighted =
    (cashScore * 25 + tradeScore * 30 + holdingScore * 25) / 80 +
    (rows.length || tradeTotal ? 0 : 20)

  const scorePct = Math.round(Math.min(100, Math.max(0, weighted)))
  let grade = "C"
  if (scorePct >= 85) grade = "A"
  else if (scorePct >= 70) grade = "B"
  else if (scorePct >= 55) grade = "C"
  else grade = "D"

  return {
    scorePct,
    grade,
    items,
    analysis: {
      actualCashPct: actualCash,
      recommendedCashPct: recCash,
      recommendedStockPct: snapshot.portfolio.recommendedStockPct,
    },
  }
}

/**
 * @param {YdsMarketAdapterContext | null | undefined} ctx
 * @param {PortfolioTrade[]} trades
 * @param {number} cashAmount
 * @param {Map<string, unknown>} quoteMap
 * @param {number | null | undefined} usdkrw
 * @param {object | null | undefined} panicData
 */
export function buildInvestmentPlaybookReport(ctx, trades, cashAmount, quoteMap, usdkrw, panicData = null) {
  const snapshot = buildPlaybookSnapshot(ctx, panicData)
  const compliance = computePlaybookCompliance(ctx, trades, cashAmount, quoteMap, usdkrw, panicData)
  return { snapshot, compliance }
}
