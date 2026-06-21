/**
 * 추천 종목 수명주기 — 점수·타이밍·모멘텀·위치 기반 단계 판정
 */

import { getFieldDeltaForDays, readScoreHistory } from "./ydsStockPickScoreHistory.js"

/** @typedef {import("./ydsStockPickModel.js").StockPickView} StockPickView */

/** @typedef {'discovery' | 'interest' | 'earlyRise' | 'rising' | 'overheat' | 'weakening' | 'excluded'} LifecycleId */

/**
 * @typedef {{
 *   id: LifecycleId
 *   label: string
 *   hint: string
 *   tone: string
 * }} LifecycleView
 */

/** @type {Record<LifecycleId, LifecycleView>} */
export const LIFECYCLE_VIEWS = {
  discovery: {
    id: "discovery",
    label: "발굴",
    hint: "초기 발굴 구간",
    tone: "cyan",
  },
  interest: {
    id: "interest",
    label: "관심",
    hint: "관찰·등록",
    tone: "slate",
  },
  earlyRise: {
    id: "earlyRise",
    label: "상승초기",
    hint: "진입 가능",
    tone: "green",
  },
  rising: {
    id: "rising",
    label: "상승진행",
    hint: "보유 우위",
    tone: "green-mid",
  },
  overheat: {
    id: "overheat",
    label: "과열",
    hint: "추격 주의",
    tone: "orange",
  },
  weakening: {
    id: "weakening",
    label: "약화",
    hint: "관찰",
    tone: "red",
  },
  excluded: {
    id: "excluded",
    label: "제외",
    hint: "목록 외",
    tone: "muted",
  },
}

/**
 * @param {StockPickView} stock
 * @param {Record<string, unknown>} [history]
 * @returns {LifecycleView}
 */
export function resolveStockLifecycle(stock, history = readScoreHistory()) {
  const v4 = stock.v4Score
  const top5Eligible = v4?.top5Eligible !== false && stock.dataSource === "live"

  if (!top5Eligible) return LIFECYCLE_VIEWS.excluded

  const statusId = v4?.recommendStatusId ?? "watch"
  const positionId = stock.pickMeta?.positionState?.id ?? stock.statusDiag?.statusId ?? ""
  const stockStatus = stock.stockStatus?.id ?? stock.status

  const timingDelta = getFieldDeltaForDays(stock.ticker, "timing", 5, history)
  const marketFitDelta = getFieldDeltaForDays(stock.ticker, "marketFit", 5, history)
  const totalDelta = getFieldDeltaForDays(stock.ticker, "total", 5, history)

  const industry = stock.scoreBreakdown?.industry ?? 0
  const sector = stock.scoreBreakdown?.sector ?? 0
  const momentum = industry + sector

  const weakeningScore =
    (totalDelta?.delta ?? 0) <= -3 ||
    (timingDelta?.delta ?? 0) <= -2 ||
    (marketFitDelta?.delta ?? 0) <= -2

  const improvingScore =
    (totalDelta?.delta ?? 0) >= 3 ||
    (timingDelta?.delta ?? 0) >= 2

  if (
    statusId === "noChase" ||
    positionId === "downturn" ||
    stockStatus === "overheat" ||
    positionId === "overheat"
  ) {
    if (weakeningScore || positionId === "downturn") return LIFECYCLE_VIEWS.weakening
    return LIFECYCLE_VIEWS.overheat
  }

  if (weakeningScore && (timingDelta?.delta ?? 0) < 0) {
    return LIFECYCLE_VIEWS.weakening
  }

  if (positionId === "earlyRise" || stockStatus === "dip") {
    return LIFECYCLE_VIEWS.earlyRise
  }

  if (positionId === "rising" || stockStatus === "trend") {
    return LIFECYCLE_VIEWS.rising
  }

  if (positionId === "pullback") {
    return improvingScore ? LIFECYCLE_VIEWS.earlyRise : LIFECYCLE_VIEWS.interest
  }

  if (statusId === "aggressiveBuy" || statusId === "buy") {
    if (momentum >= 30 && improvingScore) return LIFECYCLE_VIEWS.rising
    return LIFECYCLE_VIEWS.earlyRise
  }

  if (statusId === "scaleIn") {
    return LIFECYCLE_VIEWS.interest
  }

  if (stock.pickMeta?.rankTrack?.isNewEntry || stock.pickMeta?.rankChange?.id === "newEntry") {
    return LIFECYCLE_VIEWS.discovery
  }

  if (improvingScore && momentum >= 22) {
    return LIFECYCLE_VIEWS.discovery
  }

  return LIFECYCLE_VIEWS.interest
}

/** @param {LifecycleView} lifecycle */
export function serializeLifecycleForSnapshot(lifecycle) {
  return {
    id: lifecycle.id,
    label: lifecycle.label,
    hint: lifecycle.hint,
  }
}
