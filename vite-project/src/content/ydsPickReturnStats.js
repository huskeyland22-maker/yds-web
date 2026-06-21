/**
 * 성과검증 — 잠금 수익률 집계 공통
 */

/** @param {number[]} returns */
export function summarizeLockedReturns(returns) {
  const vals = (returns ?? []).filter((v) => Number.isFinite(v))
  if (!vals.length) {
    return {
      count: 0,
      winRate: null,
      avgReturn: null,
      maxGain: null,
      maxLoss: null,
    }
  }
  const wins = vals.filter((v) => v > 0).length
  const sum = vals.reduce((s, v) => s + v, 0)
  const sorted = [...vals].sort((a, b) => b - a)
  return {
    count: vals.length,
    winRate: Math.round((wins / vals.length) * 1000) / 10,
    avgReturn: Math.round((sum / vals.length) * 10) / 10,
    maxGain: Math.round(sorted[0] * 10) / 10,
    maxLoss: Math.round(sorted[sorted.length - 1] * 10) / 10,
  }
}

/** @typedef {import("./ydsValidationStorage.js").ValidationPickRecord} ValidationPickRecord */

/**
 * @param {ValidationPickRecord[]} picks
 * @param {'d7'} horizonKey
 */
export function getLockedReturns(picks, horizonKey = "d7") {
  /** @type {number[]} */
  const out = []
  for (const p of picks ?? []) {
    const ret = p.horizons?.[horizonKey]
    if (ret != null && Number.isFinite(ret)) out.push(Number(ret))
  }
  return out
}

/**
 * @param {ValidationPickRecord[]} picks
 * @param {'d7'} horizonKey
 */
export function pickExtremesByReturn(picks, horizonKey = "d7") {
  const rows = (picks ?? [])
    .map((pick) => {
      const ret = pick.horizons?.[horizonKey]
      if (ret == null || !Number.isFinite(ret)) return null
      return { pick, returnPct: Number(ret) }
    })
    .filter(Boolean)

  if (!rows.length) return { best: null, worst: null }

  const sorted = [...rows].sort((a, b) => b.returnPct - a.returnPct)
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]

  return {
    best: {
      name: best.pick.name,
      ticker: best.pick.ticker,
      returnPct: best.returnPct,
    },
    worst: {
      name: worst.pick.name,
      ticker: worst.pick.ticker,
      returnPct: worst.returnPct,
    },
  }
}
