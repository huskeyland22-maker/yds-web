/**
 * FREE/summary redaction for equity Daily Bottom Buy payloads.
 * Engine thresholds and buildEquityDailyBottomBuyView stay unchanged — response shape only.
 */

/**
 * Brief candidate status for FREE: id + label only (no reading/detail prose).
 * @param {unknown} state
 * @returns {unknown}
 */
function redactState(state) {
  if (!state || typeof state !== "object") return state
  const s = /** @type {Record<string, unknown>} */ (state)
  return {
    id: s.id ?? null,
    label: s.label ?? null,
  }
}

/**
 * Keep symbol / group / score / brief state; drop indicator values and condition details.
 * @param {unknown} view
 * @returns {unknown}
 */
export function redactEquityDailyBottomBuyView(view) {
  if (!view || typeof view !== "object") return view
  const v = /** @type {Record<string, unknown>} */ (view)
  /** @type {Record<string, unknown>} */
  const out = {
    ok: v.ok === true,
    symbol: v.symbol ?? null,
    name: v.name ?? null,
    group: v.group ?? null,
    priority: v.priority ?? null,
    message: v.message ?? null,
    asOf: v.asOf ?? null,
    source: v.source ?? null,
    score: typeof v.score === "number" ? v.score : v.score == null ? null : Number(v.score),
    state: redactState(v.state),
    readOnly: true,
  }
  if (!Number.isFinite(/** @type {number} */ (out.score)) && out.score !== null) {
    out.score = null
  }
  return out
}

/**
 * @param {unknown} payload
 * @returns {unknown}
 */
export function redactEquityDailyBottomBuyPayload(payload) {
  if (!payload || typeof payload !== "object") return payload
  const p = /** @type {Record<string, unknown>} */ (payload)
  return {
    ...p,
    access: "summary",
    view: redactEquityDailyBottomBuyView(p.view),
  }
}

/**
 * True when a view still contains PRO-only detail fields.
 * @param {unknown} view
 * @returns {boolean}
 */
export function equityViewHasProDetails(view) {
  if (!view || typeof view !== "object") return false
  const v = /** @type {Record<string, unknown>} */ (view)
  if (v.price != null) return true
  if (v.atrPct != null) return true
  if (v.atrRisk != null) return true
  if (v.dd120 != null) return true
  if (v.atrNote != null || v.atrMeaning != null) return true
  if (v.note != null) return true
  if (Array.isArray(v.conditions) && v.conditions.length > 0) return true
  if (v.state && typeof v.state === "object") {
    const s = /** @type {Record<string, unknown>} */ (v.state)
    if (s.detail != null || s.reading != null) return true
  }
  return false
}

/**
 * @param {unknown} payload
 * @returns {boolean}
 */
export function equityPayloadHasProDetails(payload) {
  if (!payload || typeof payload !== "object") return false
  return equityViewHasProDetails(/** @type {Record<string, unknown>} */ (payload).view)
}
