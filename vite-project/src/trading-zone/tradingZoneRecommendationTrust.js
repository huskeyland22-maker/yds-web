/** @typedef {import("./tacticalTradingZoneData.js").TradingZonePosition} TradingZonePosition */

function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function daysBetween(isoA, isoB) {
  const a = new Date(`${String(isoA).slice(0, 10)}T12:00:00`).getTime()
  const b = new Date(`${String(isoB).slice(0, 10)}T12:00:00`).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return Math.round((b - a) / 86_400_000)
}

/**
 * @param {number | null} winRate
 */
export function resolveTrustGrade(winRate) {
  const w = Number(winRate)
  if (!Number.isFinite(w)) return "C"
  if (w >= 60) return "A"
  if (w >= 50) return "B"
  if (w >= 40) return "C"
  return "D"
}

/**
 * @param {TradingZonePosition} position
 * @param {number} days
 */
export function buildPositionTrustSnapshot(position, days = 30) {
  const today = new Date().toISOString().slice(0, 10)
  const entries = [...(position.stageHistory ?? [])]
    .filter((h) => (h.stage === "interest" || h.stage === "pullback") && Number.isFinite(Number(h.price)))
    .map((h) => {
      const at = String(h.at ?? "").slice(0, 10)
      const recommended = toNum(h.price)
      const current = toNum(position.currentPrice)
      if (!recommended || !current || recommended <= 0) return null
      const diff = daysBetween(at, today)
      if (diff == null || diff < 0 || diff > days) return null
      const ret = ((current - recommended) / recommended) * 100
      return {
        at,
        ret,
      }
    })
    .filter(Boolean)

  const wins = entries.filter((e) => e.ret > 0).length
  const successes = entries.filter((e) => e.ret >= 20).length
  const failures = entries.filter((e) => e.ret <= -20).length
  const ongoing = entries.filter((e) => e.ret > -20 && e.ret < 20).length
  const avg = entries.length ? entries.reduce((sum, e) => sum + e.ret, 0) / entries.length : null
  const best = [...entries].sort((a, b) => b.ret - a.ret)[0] ?? null
  const winRate = entries.length ? (wins / entries.length) * 100 : null
  const successRate = entries.length ? (successes / entries.length) * 100 : null
  const failRate = entries.length ? (failures / entries.length) * 100 : null
  const ongoingRate = entries.length ? (ongoing / entries.length) * 100 : null

  return {
    count: entries.length,
    winRate,
    successRate,
    failRate,
    ongoingRate,
    avgReturn: avg,
    bestReturn: best?.ret ?? null,
    grade: resolveTrustGrade(winRate),
  }
}

/**
 * @param {TradingZonePosition[]} positions
 * @param {number} days
 */
export function buildTrustSnapshotMap(positions, days = 30) {
  /** @type {Record<string, { count: number; winRate: number | null; successRate: number | null; failRate: number | null; ongoingRate: number | null; avgReturn: number | null; bestReturn: number | null; grade: string }>} */
  const out = {}
  for (const p of positions ?? []) {
    out[p.id] = buildPositionTrustSnapshot(p, days)
  }
  return out
}

/**
 * @param {TradingZonePosition[]} positions
 * @param {number} days
 */
export function buildTrustSummary(positions, days = 30) {
  const byId = buildTrustSnapshotMap(positions, days)
  const rows = Object.entries(byId).map(([id, snap]) => ({ id, ...snap }))
  const active = rows.filter((r) => r.count > 0)
  const avgWin = active.length
    ? active.reduce((sum, r) => sum + Number(r.winRate ?? 0), 0) / active.length
    : null
  const avgRet = active.length
    ? active.reduce((sum, r) => sum + Number(r.avgReturn ?? 0), 0) / active.length
    : null
  return { byId, avgWinRate: avgWin, avgReturn: avgRet }
}
