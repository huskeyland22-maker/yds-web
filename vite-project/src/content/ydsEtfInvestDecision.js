/**
 * Phase E/F — presentation-only Quality × DBB decision helpers.
 * Does NOT combine scores, alter DBB thresholds, or invent quality grades.
 */

/** Matches etfQualityEngine grade bands: A≥80, B≥65. */
export const ETF_QUALITY_STRONG_GRADES = Object.freeze(["A", "B"])

/** Calendar-day lag beyond which price is treated as delayed (not a live buy signal). */
export const ETF_PRICE_STALE_LAG_DAYS = 5

export const ETF_INVEST_DECISION = Object.freeze({
  quality_buy: Object.freeze({
    id: "quality_buy",
    label: "품질 우수 + 매수 조건 충족",
    shortLabel: "품질·매수 모두 긍정",
    hint: "장기 품질과 현재 매수 조건이 모두 긍정적입니다. 점수를 합산하지 않습니다.",
    matrix: true,
  }),
  quality_wait: Object.freeze({
    id: "quality_wait",
    label: "품질 우수 + 매수 조건 미충족",
    shortLabel: "품질 우수 · 매수 대기",
    hint: "품질은 양호하나 현재 DBB 매수 조건을 기다리는 상태입니다.",
    matrix: true,
  }),
  caution_buy: Object.freeze({
    id: "caution_buy",
    label: "품질 낮음/보류 + 매수 조건 충족",
    shortLabel: "매수 신호 · 품질 검토",
    hint: "DBB 신호가 있어도 품질·보류 사유를 별도로 검토하세요. 신호를 무효화하지 않습니다.",
    matrix: true,
  }),
  observe: Object.freeze({
    id: "observe",
    label: "품질 낮음/보류 + 매수 조건 미충족",
    shortLabel: "우선 관찰",
    hint: "품질·매수 모두 우선 관찰 대상입니다.",
    matrix: true,
  }),
  dbb_unavailable: Object.freeze({
    id: "dbb_unavailable",
    label: "DBB 데이터 오류",
    shortLabel: "DBB 데이터 오류",
    hint: "가격·지표 계산 불가로 매수 조건을 평가할 수 없습니다. 매수 대기와 다릅니다.",
    matrix: false,
  }),
  data_stale: Object.freeze({
    id: "data_stale",
    label: "데이터 지연",
    shortLabel: "데이터 지연",
    hint: "가격 기준일이 오래되어 정상 매수 신호로 표시하지 않습니다.",
    matrix: false,
  }),
})

export const ETF_QUALITY_PILLAR_LABELS = Object.freeze({
  performance: "성과",
  risk: "위험",
  cost: "비용",
  liquidity: "유동성",
  composition: "구성",
  stability: "안정성",
})

export const ETF_PENDING_REASON_LABELS = Object.freeze({
  missing_aum: "공식 AUM 미확보",
  missing_expense_ratio: "운용보수 미확보",
  missing_inception_date: "운용 개시일 미확보",
  missing_fund_meta: "펀드 메타 없음",
  insufficient_3y_price_history: "3년 가격 이력 부족",
  insufficient_bars: "가격 바 부족",
  awaiting_price_context: "가격 컨텍스트 대기",
  low_data_coverage: "데이터 충족률 부족",
  excessive_pillar_exclusion: "제외 항목 과다",
  no_scorable_pillars: "채점 가능 필라 없음",
  missing_official_top10: "공식 Top10 미확보",
  cache_missing: "가격 캐시 없음",
  unavailable: "데이터 없음",
})

/**
 * Prefer quality as-of when DBB asOf is redacted (FREE summary).
 * @param {unknown} card
 */
export function pickEtfDataAsOf(card) {
  if (!card || typeof card !== "object") return null
  const c = /** @type {Record<string, unknown>} */ (card)
  const q = c.quality && typeof c.quality === "object" ? /** @type {Record<string, unknown>} */ (c.quality) : null
  const candidates = [c.asOfDate, q?.asOfDate]
  for (const v of candidates) {
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return null
}

/**
 * @param {string | null | undefined} asOf
 * @param {string | Date} [today]
 * @returns {number | null}
 */
export function getEtfPriceLagDays(asOf, today = new Date()) {
  if (typeof asOf !== "string" || !asOf.trim()) return null
  const a = Date.parse(`${asOf.trim()}T00:00:00Z`)
  const t =
    today instanceof Date
      ? Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
      : Date.parse(`${String(today).slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(a) || !Number.isFinite(t)) return null
  return Math.round((t - a) / 86400000)
}

/**
 * @param {unknown} card
 * @param {{ today?: string | Date, maxLagDays?: number }} [opts]
 */
export function isEtfPriceStale(card, opts = {}) {
  const maxLag = opts.maxLagDays ?? ETF_PRICE_STALE_LAG_DAYS
  const lag = getEtfPriceLagDays(pickEtfDataAsOf(card), opts.today)
  return lag != null && lag > maxLag
}

/**
 * @param {unknown} card
 * @param {{ today?: string | Date }} [opts]
 */
export function getEtfDbbComputeStatus(card, opts = {}) {
  if (!card || typeof card !== "object") {
    return { id: "error", label: "DBB 데이터 오류", detail: "unavailable" }
  }
  const c = /** @type {Record<string, unknown>} */ (card)
  if (c.ok !== true) {
    const detail = typeof c.error === "string" && c.error ? c.error : "unavailable"
    return {
      id: "error",
      label: "DBB 데이터 오류",
      detail,
      detailLabel: formatEtfPendingReason(detail),
    }
  }
  if (isEtfPriceStale(c, opts)) {
    const asOf = pickEtfDataAsOf(c)
    return {
      id: "stale",
      label: "데이터 지연",
      detail: asOf,
      lagDays: getEtfPriceLagDays(asOf, opts.today),
    }
  }
  return { id: "ok", label: "정상", detail: null }
}

/**
 * @param {unknown} card
 */
export function isEtfQualityStrong(card) {
  if (!card || typeof card !== "object") return false
  const c = /** @type {Record<string, unknown>} */ (card)
  const q = c.quality && typeof c.quality === "object" ? /** @type {Record<string, unknown>} */ (c.quality) : null
  const status = c.qualityStatus ?? q?.status
  if (status !== "scored") return false
  const grade = String(c.qualityGrade ?? q?.grade ?? "")
  return ETF_QUALITY_STRONG_GRADES.includes(grade)
}

/**
 * DBB buy-ready = existing 3-of-4 rule (unchanged).
 * Stale / error cards are never buy-ready for presentation.
 * @param {unknown} card
 * @param {{ today?: string | Date }} [opts]
 */
export function isEtfDbbBuyReady(card, opts = {}) {
  if (!card || typeof card !== "object") return false
  const status = getEtfDbbComputeStatus(card, opts)
  if (status.id !== "ok") return false
  const c = /** @type {Record<string, unknown>} */ (card)
  return c.ok === true && Number(c.count) >= 3
}

/**
 * @param {unknown} card
 * @param {{ today?: string | Date }} [opts]
 */
export function classifyEtfInvestDecision(card, opts = {}) {
  const dbbStatus = getEtfDbbComputeStatus(card, opts)
  if (dbbStatus.id === "error") {
    return { ...ETF_INVEST_DECISION.dbb_unavailable, dbbStatus }
  }
  if (dbbStatus.id === "stale") {
    return { ...ETF_INVEST_DECISION.data_stale, dbbStatus }
  }

  const qualityStrong = isEtfQualityStrong(card)
  const buyReady = isEtfDbbBuyReady(card, opts)
  if (qualityStrong && buyReady) return { ...ETF_INVEST_DECISION.quality_buy, dbbStatus }
  if (qualityStrong && !buyReady) return { ...ETF_INVEST_DECISION.quality_wait, dbbStatus }
  if (!qualityStrong && buyReady) return { ...ETF_INVEST_DECISION.caution_buy, dbbStatus }
  return { ...ETF_INVEST_DECISION.observe, dbbStatus }
}

/**
 * @param {unknown[]} cards
 * @param {{ today?: string | Date }} [opts]
 */
export function groupCardsByInvestDecision(cards, opts = {}) {
  /** @type {Record<string, unknown[]>} */
  const groups = {
    quality_buy: [],
    quality_wait: [],
    caution_buy: [],
    observe: [],
    dbb_unavailable: [],
    data_stale: [],
  }
  for (const card of Array.isArray(cards) ? cards : []) {
    const bucket = classifyEtfInvestDecision(card, opts)
    if (!groups[bucket.id]) groups[bucket.id] = []
    groups[bucket.id].push(card)
  }
  return groups
}

/**
 * @param {unknown} reason
 */
export function formatEtfPendingReason(reason) {
  const key = String(reason ?? "")
  return ETF_PENDING_REASON_LABELS[key] || key || "사유 미기재"
}

/**
 * Presentation helpers from existing pillar scores (no re-scoring).
 * Strength: score ≥ 65 · Weakness: score &lt; 40 · Excluded listed separately.
 * @param {unknown} quality
 */
export function describeQualityHighlights(quality) {
  /** @type {string[]} */
  const strengths = []
  /** @type {string[]} */
  const weaknesses = []
  /** @type {string[]} */
  const excluded = []
  if (!quality || typeof quality !== "object") {
    return { strengths, weaknesses, excluded }
  }
  const q = /** @type {Record<string, unknown>} */ (quality)
  const pillars = q.pillars && typeof q.pillars === "object" ? /** @type {Record<string, any>} */ (q.pillars) : null
  if (!pillars) return { strengths, weaknesses, excluded }

  for (const [key, pillar] of Object.entries(pillars)) {
    const label = ETF_QUALITY_PILLAR_LABELS[key] || key
    if (!pillar || typeof pillar !== "object") continue
    if (pillar.excluded || pillar.score == null) {
      const why = pillar.excludeReason ? formatEtfPendingReason(pillar.excludeReason) : "데이터 부족·제외"
      excluded.push(`${label} (${why})`)
      continue
    }
    const score = Number(pillar.score)
    if (!Number.isFinite(score)) continue
    if (score >= 65) strengths.push(`${label} ${score}`)
    else if (score < 40) weaknesses.push(`${label} ${score}`)
  }
  return { strengths, weaknesses, excluded }
}

/**
 * DBB column label for overview — distinguishes error / stale / unmet / buy.
 * @param {unknown} card
 * @param {{ today?: string | Date }} [opts]
 */
export function formatEtfDbbStatusLabel(card, opts = {}) {
  const status = getEtfDbbComputeStatus(card, opts)
  if (status.id === "error") {
    return `오류 · ${status.detailLabel || status.detail || "unavailable"}`
  }
  if (status.id === "stale") {
    const c = /** @type {Record<string, unknown>} */ (card || {})
    const count = c.ok === true ? Number(c.count) : null
    return `지연${status.detail ? ` · ${status.detail}` : ""}${
      count != null ? ` · 참고 ${count}/4` : ""
    }`
  }
  const c = /** @type {Record<string, unknown>} */ (card || {})
  const stage = c.stage && typeof c.stage === "object" ? /** @type {Record<string, unknown>} */ (c.stage) : null
  return `${c.count}/4${stage?.label ? ` · ${stage.label}` : ""}`
}
