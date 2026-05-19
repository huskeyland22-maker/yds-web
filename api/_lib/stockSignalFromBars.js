import { computePosition52w, computeStockSignal } from "./stockSignalEngine.js"

function smaLast(values, period) {
  if (!Array.isArray(values) || values.length < period) return null
  let s = 0
  for (let i = values.length - period; i < values.length; i++) s += values[i]
  return s / period
}

function volumeChangePct(volumes) {
  if (!Array.isArray(volumes) || volumes.length < 22) return null
  const last = volumes[volumes.length - 1]
  let sum = 0
  for (let i = volumes.length - 21; i < volumes.length - 1; i++) sum += volumes[i]
  const avg = sum / 20
  if (!avg) return null
  return ((last - avg) / avg) * 100
}

/**
 * @param {{
 *   rows: Array<{ close: number; volume?: number }>
 *   price?: number | null
 *   rsi14?: number | null
 *   sectorScore?: number | null
 *   panicIndex?: number | null
 * }} ctx
 */
export function buildStockSignalBundle(ctx) {
  const rows = ctx.rows ?? []
  const closes = rows.map((r) => r.close).filter((c) => Number.isFinite(c))
  const volumes = rows.map((r) => (Number.isFinite(r.volume) ? r.volume : 0))
  const price = ctx.price ?? (closes.length ? closes[closes.length - 1] : null)
  const ma10 = smaLast(closes, 10)
  const ma20 = smaLast(closes, 20)
  const volPct = volumeChangePct(volumes)
  const position52w = computePosition52w(closes)

  const result = computeStockSignal({
    price,
    ma10,
    ma20,
    rsi14: ctx.rsi14,
    position52w,
    volumeChangePct: volPct,
    sectorScore: ctx.sectorScore,
    panicIndex: ctx.panicIndex,
  })

  return {
    ...result,
    price,
    ma10,
    ma20,
    rsi14: ctx.rsi14 ?? null,
    position52w,
    volumeChangePct: volPct,
    sectorScore: ctx.sectorScore ?? null,
    panicIndex: ctx.panicIndex ?? null,
  }
}
