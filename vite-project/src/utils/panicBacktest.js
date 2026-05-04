/**
 * 패닉 점수 기반 단순 백테스트 (교육·감도 확인용).
 *
 * 합성 가격: 역발상 가정 — 공포(점수↑)일수록 자산은 싸게 표시
 *   price = max(5, 100 + (50 - score))
 * score >= 65 → 전량 매수, score <= 35 → 전량 매도. 초기 자금 1000.
 */

/** @typedef {{ date: string, score: number }} ScorePoint */

/**
 * @param {Array<{ date: string, score: number }>} fullHistory getHistory() 결과 등
 * @returns {ScorePoint[]}
 */
export function historyToScoreSeries(fullHistory) {
  if (!Array.isArray(fullHistory)) return []
  return fullHistory
    .map((e) => ({
      date: e.date,
      score: Number(e.score),
    }))
    .filter((e) => e.date && Number.isFinite(e.score))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

/** 히스토리 부족 시 시뮬레이션용 더미 시계열 */
export function generateDummyScoreHistory(n = 48) {
  const out = []
  let s = 46 + Math.random() * 8
  const start = Date.now() - n * 86400000
  for (let i = 0; i < n; i++) {
    s += (Math.random() - 0.46) * 14
    s = Math.max(22, Math.min(86, s))
    out.push({
      date: new Date(start + i * 86400000).toISOString(),
      score: Math.round(s * 10) / 10,
    })
  }
  return out
}

/**
 * @param {ScorePoint[]} series
 * @returns {{ series: ScorePoint[], usedDummy: boolean }}
 */
export function getBacktestInputSeries(series) {
  const s = historyToScoreSeries(series)
  if (s.length >= 3) return { series: s, usedDummy: false }
  return { series: generateDummyScoreHistory(48), usedDummy: true }
}

function syntheticPrice(score) {
  return Math.max(5, 100 + (50 - score))
}

/**
 * @param {ScorePoint[]} history — { date, score }[]
 * @returns {{
 *   totalReturn: number,
 *   winRate: number,
 *   trades: number,
 *   maxDrawdown: number,
 *   equityCurve: { date: string, equity: number }[],
 *   usedDummy: boolean
 * }}
 */
export function runBacktest(history) {
  const { series, usedDummy } = getBacktestInputSeries(history)

  const INITIAL = 1000
  let cash = INITIAL
  let shares = 0
  /** @type {number | null} */
  let entryPrice = null

  const equityCurve = []
  const roundTripPnlPct = []

  let peak = INITIAL
  let maxDrawdown = 0

  for (let i = 0; i < series.length; i++) {
    const { date, score } = series[i]
    const p = syntheticPrice(score)

    if (shares === 0 && score >= 65) {
      shares = cash / p
      cash = 0
      entryPrice = p
    } else if (shares > 0 && score <= 35) {
      cash = shares * p
      if (entryPrice != null && entryPrice > 0) {
        roundTripPnlPct.push(((p - entryPrice) / entryPrice) * 100)
      }
      shares = 0
      entryPrice = null
    }

    const equity = cash + shares * p
    equityCurve.push({ date, equity })

    peak = Math.max(peak, equity)
    if (peak > 0) {
      const dd = ((peak - equity) / peak) * 100
      maxDrawdown = Math.max(maxDrawdown, dd)
    }
  }

  const lastP = syntheticPrice(series[series.length - 1].score)
  const finalEquity = cash + shares * lastP
  const totalReturn = ((finalEquity / INITIAL) - 1) * 100

  const nTrades = roundTripPnlPct.length
  const wins = roundTripPnlPct.filter((x) => x > 0).length
  const winRate = nTrades > 0 ? (wins / nTrades) * 100 : 0

  return {
    totalReturn: Math.round(totalReturn * 10) / 10,
    winRate: Math.round(winRate * 10) / 10,
    trades: nTrades,
    maxDrawdown: Math.round(maxDrawdown * 10) / 10,
    equityCurve,
    usedDummy,
  }
}
