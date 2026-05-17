/** AI·수동 입력 — panic_metrics / panic_index_history 동일 스냅샷 */

export const PANIC_METRIC_KEYS = [
  "vix",
  "vxn",
  "fearGreed",
  "putCall",
  "bofa",
  "move",
  "skew",
  "highYield",
  "gsBullBear",
]

export function toPanicNum(v) {
  if (v == null || v === "") return null
  const n = Number(String(v).replace(/%/g, "").replace(/,/g, "").trim())
  return Number.isFinite(n) ? n : null
}

export function resolvePanicTradeDate(body, tradeDateOverride) {
  const raw = tradeDateOverride || body?.tradeDate || body?.historyDate
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.slice(0, 10))) return raw.slice(0, 10)
  const u = body?.updatedAt ?? body?.updated_at
  if (typeof u === "string" && /^\d{4}-\d{2}-\d{2}/.test(u)) return u.slice(0, 10)
  return new Date().toISOString().slice(0, 10)
}

/**
 * @param {Record<string, unknown>} body
 * @param {{ tradeDate?: string, source?: string }} [opts]
 */
export function normalizePanicPayload(body, opts = {}) {
  const tradeDate = resolvePanicTradeDate(body, opts.tradeDate)
  const updatedAt =
    typeof body?.updatedAt === "string" && body.updatedAt
      ? body.updatedAt
      : `${tradeDate}T12:00:00.000Z`
  const source = typeof opts.source === "string" && opts.source ? opts.source : "api"

  const snap = {
    tradeDate,
    updatedAt,
    source,
    vix: toPanicNum(body?.vix),
    vxn: toPanicNum(body?.vxn),
    fearGreed: toPanicNum(body?.fearGreed ?? body?.fear_greed),
    putCall: toPanicNum(body?.putCall ?? body?.put_call),
    bofa: toPanicNum(body?.bofa),
    move: toPanicNum(body?.move),
    skew: toPanicNum(body?.skew),
    highYield: toPanicNum(body?.highYield ?? body?.hyOas ?? body?.hy_oas ?? body?.high_yield),
    gsBullBear: toPanicNum(body?.gsBullBear ?? body?.gsSentiment ?? body?.gs_bb ?? body?.gs),
  }
  return snap
}

/** @param {ReturnType<typeof normalizePanicPayload>} snap */
export function panicIndexHistoryRowFromSnapshot(snap) {
  const hy = snap.highYield
  const gs = snap.gsBullBear
  return {
    date: snap.tradeDate,
    vix: snap.vix,
    vxn: snap.vxn,
    fear_greed: snap.fearGreed,
    put_call: snap.putCall,
    move: snap.move,
    bofa: snap.bofa,
    skew: snap.skew,
    hy_oas: hy,
    gs_bb: gs,
    high_yield: hy,
    gs_sentiment: gs,
    source: snap.source,
    updated_at: snap.updatedAt,
  }
}

/** @param {ReturnType<typeof normalizePanicPayload>} snap */
export function panicObjectFromSnapshot(snap) {
  return {
    vix: snap.vix,
    vxn: snap.vxn,
    fearGreed: snap.fearGreed,
    putCall: snap.putCall,
    bofa: snap.bofa,
    move: snap.move,
    skew: snap.skew,
    highYield: snap.highYield,
    gsBullBear: snap.gsBullBear,
    updatedAt: snap.updatedAt,
    accessTier: "pro",
    riskRegime: deriveRiskRegimeFromSnap(snap),
  }
}

function deriveRiskRegimeFromSnap(snap) {
  const vix = Number(snap?.vix)
  const fg = Number(snap?.fearGreed)
  if (!Number.isFinite(vix) || !Number.isFinite(fg)) return "neutral"
  if (fg <= 35 || vix >= 26) return "risk-off"
  if (fg >= 72 && vix < 18) return "risk-on"
  return "neutral"
}

/** AI 수동 입력 최소 필드 */
export function snapshotHasRequiredHistoryMetrics(snap) {
  return (
    snap.vix != null &&
    snap.fearGreed != null &&
    snap.putCall != null &&
    snap.highYield != null &&
    snap.bofa != null
  )
}
