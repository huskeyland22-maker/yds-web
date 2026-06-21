/**
 * 행동 가이드 — V4·타이밍 등급 기반 접근 해석 (매수 추천·자동매매 신호 아님)
 */

import { resolvePricePosition } from "./ydsStockPickV5Insights.js"

/** @typedef {import("./ydsStockPickModel.js").StockPickView} StockPickView */
/** @typedef {import("./ydsStockPickV4Scoring.js").V4RecommendStatusId} V4RecommendStatusId */
/** @typedef {import("./ydsStockPickV4Scoring.js").ScoreLetterGrade} ScoreLetterGrade */

/** @typedef {'entry' | 'scaleIn' | 'noChase' | 'watch' | 'waitPullback'} ActionGuideId */

/**
 * @typedef {{
 *   id: ActionGuideId
 *   source: string
 *   text: string
 * }} ActionGuideItem
 */

/**
 * @typedef {{
 *   items: ActionGuideItem[]
 *   summary: string
 *   primaryId: ActionGuideId
 *   timingGrade: string
 *   recommendStatusId: string
 * }} ActionGuideView
 */

export const ACTION_GUIDE_MAX_ITEMS = 2

/** @type {Record<ActionGuideId, string>} */
export const ACTION_GUIDE_LABELS = {
  entry: "1차 진입 가능",
  scaleIn: "분할매수 권장",
  noChase: "추격매수 금지",
  watch: "관찰 우선",
  waitPullback: "눌림목 대기",
}

/** @param {ActionGuideId} id @param {string} source */
function item(id, source) {
  return { id, source, text: ACTION_GUIDE_LABELS[id] }
}

/** @param {ActionGuideItem[]} items */
function dedupeById(items) {
  const seen = new Set()
  /** @type {ActionGuideItem[]} */
  const out = []
  for (const it of items) {
    if (seen.has(it.id)) continue
    seen.add(it.id)
    out.push(it)
  }
  return out
}

/**
 * @param {V4RecommendStatusId | undefined} statusId
 * @param {ScoreLetterGrade | string | undefined} timingGrade
 */
function resolvePrimaryGuide(statusId, timingGrade) {
  const tg = String(timingGrade ?? "F")
  const st = statusId ?? "watch"

  if (st === "noChase") return item("noChase", "v4.noChase")

  if (tg === "A") {
    if (st === "aggressiveBuy" || st === "buy") return item("entry", `v4.${st}+timingA`)
    if (st === "scaleIn") return item("scaleIn", "v4.scaleIn+timingA")
    return item("watch", "v4.watch+timingA")
  }

  if (tg === "B") {
    if (st === "aggressiveBuy" || st === "buy") return item("scaleIn", `v4.${st}+timingB`)
    if (st === "scaleIn") return item("scaleIn", "v4.scaleIn+timingB")
    return item("watch", "v4.watch+timingB")
  }

  if (tg === "C") return item("watch", "timing.gradeC")

  if (tg === "D" || tg === "F") {
    if (st === "aggressiveBuy" || st === "buy" || st === "scaleIn") {
      return item("waitPullback", `timing.grade${tg}`)
    }
    return item("noChase", `timing.grade${tg}`)
  }

  return item("watch", "v4.fallback")
}

/** @param {StockPickView} stock @param {ActionGuideItem} primary */
function resolveSecondaryGuide(stock, primary) {
  const pricePos = stock.pickMeta?.pricePosition?.id ?? resolvePricePosition(stock).id
  const statusId = stock.stockStatus?.id ?? stock.status
  const checks = stock.timingScore?.checks ?? []
  const rsiFail = checks.some((c) => c.id === "rsi" && !c.pass)
  const position52w = stock.statusDiag?.inputs?.position52w
  const high52w =
    typeof position52w === "number" && Number.isFinite(position52w) && position52w >= 97

  if (primary.id === "noChase") {
    if (pricePos === "dip" || statusId === "dip") return item("waitPullback", "price.dip")
    return item("watch", "v4.noChase")
  }

  if (primary.id === "entry" && (rsiFail || high52w || statusId === "overheat" || pricePos === "overheat")) {
    return item("noChase", "guard.overheat")
  }

  if (primary.id === "scaleIn") {
    if (pricePos === "dip" || statusId === "dip") return item("waitPullback", "price.dip")
    return item("watch", "v4.scaleIn")
  }

  if (primary.id === "watch" && (pricePos === "dip" || statusId === "dip")) {
    return item("waitPullback", "price.dip")
  }

  if (primary.id === "waitPullback") return item("watch", "timing.weak")

  return null
}

/**
 * @param {StockPickView} stock
 * @returns {ActionGuideView}
 */
export function buildActionGuide(stock) {
  const v4 = stock.v4Score
  const timingGrade = v4?.timingGrade ?? "F"
  const recommendStatusId = v4?.recommendStatusId ?? "watch"
  const top5Eligible = v4?.top5Eligible !== false && stock.dataSource === "live"

  if (!top5Eligible) {
    const items = [item("watch", "v4.top5Ineligible")]
    return {
      items,
      summary: items[0].text,
      primaryId: "watch",
      timingGrade,
      recommendStatusId,
    }
  }

  const primary = resolvePrimaryGuide(recommendStatusId, timingGrade)
  /** @type {ActionGuideItem[]} */
  const raw = [primary]
  const secondary = resolveSecondaryGuide(stock, primary)
  if (secondary && secondary.id !== primary.id) raw.push(secondary)

  const items = dedupeById(raw).slice(0, ACTION_GUIDE_MAX_ITEMS)
  const summary = items.map((i) => i.text).join(" · ")

  return {
    items,
    summary,
    primaryId: items[0]?.id ?? "watch",
    timingGrade,
    recommendStatusId,
  }
}

/** @param {ActionGuideView | null | undefined} guide */
export function serializeActionGuideForSnapshot(guide) {
  if (!guide?.items?.length) return undefined
  return {
    primaryId: guide.primaryId,
    timingGrade: guide.timingGrade,
    recommendStatusId: guide.recommendStatusId,
    summary: guide.summary,
    items: guide.items.map((i) => ({ id: i.id, source: i.source, text: i.text })),
  }
}
