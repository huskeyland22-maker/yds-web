/**
 * FREE/summary redaction for Daily Bottom Buy ETF payloads.
 * Engine thresholds and evaluation stay unchanged — this only strips detail fields.
 */

/** @type {readonly string[]} */
const DETAIL_CARD_KEYS = Object.freeze([
  "rsi14",
  "stochK",
  "bbPctB",
  "ma20DevPct",
  "flags",
  "close",
  "asOfDate",
])

/**
 * @param {unknown} stage
 * @returns {unknown}
 */
function redactStage(stage) {
  if (!stage || typeof stage !== "object") return stage
  const s = /** @type {Record<string, unknown>} */ (stage)
  return {
    id: s.id,
    count: s.count,
    label: s.label,
    priority: s.priority,
  }
}

/**
 * Keep symbol / theme / count / stage label; drop indicator values and flags.
 * @param {unknown} card
 * @returns {unknown}
 */
export function redactDailyBottomBuyCard(card) {
  if (!card || typeof card !== "object") return card
  const c = /** @type {Record<string, unknown>} */ (card)
  /** @type {Record<string, unknown>} */
  const out = {
    symbol: c.symbol,
    theme: c.theme,
    themeShort: c.themeShort,
    role: c.role ?? null,
    ok: c.ok === true,
    count: typeof c.count === "number" ? c.count : 0,
    stage: redactStage(c.stage),
  }
  if (c.ok !== true) {
    out.error = "unavailable"
  }
  for (const key of DETAIL_CARD_KEYS) {
    if (key in out) delete out[key]
  }
  return out
}

/**
 * @param {unknown} list
 * @returns {unknown}
 */
function redactCardList(list) {
  if (!Array.isArray(list)) return list
  return list.map((card) => redactDailyBottomBuyCard(card))
}

/**
 * @param {unknown} payload
 * @returns {unknown}
 */
export function redactDailyBottomBuyPayload(payload) {
  if (!payload || typeof payload !== "object") return payload
  const p = /** @type {Record<string, unknown>} */ (payload)
  return {
    ...p,
    access: "summary",
    opportunities: redactCardList(p.opportunities),
    watch: redactCardList(p.watch),
    waiting: redactCardList(p.waiting),
    all: redactCardList(p.all),
  }
}

/**
 * True when a card/payload still contains PRO-only detail fields.
 * @param {unknown} card
 * @returns {boolean}
 */
export function cardHasProDetails(card) {
  if (!card || typeof card !== "object") return false
  const c = /** @type {Record<string, unknown>} */ (card)
  if (c.flags != null) return true
  if (c.rsi14 != null || c.stochK != null || c.bbPctB != null || c.ma20DevPct != null) return true
  if (c.close != null) return true
  if (c.stage && typeof c.stage === "object" && "splitHint" in /** @type {object} */ (c.stage)) {
    return /** @type {Record<string, unknown>} */ (c.stage).splitHint != null
  }
  return false
}

/**
 * @param {unknown} payload
 * @returns {boolean}
 */
export function payloadHasProDetails(payload) {
  if (!payload || typeof payload !== "object") return false
  const p = /** @type {Record<string, unknown>} */ (payload)
  const lists = [p.opportunities, p.watch, p.waiting, p.all]
  for (const list of lists) {
    if (!Array.isArray(list)) continue
    if (list.some((card) => cardHasProDetails(card))) return true
  }
  return false
}
