/**
 * Weekly trend sell test for the 31 US growth names.
 *
 * BUY events come from the existing episode function: frozen RSI<=36,
 * Stoch %K<=15.4, BB %B<=0.01, MA20 gap<=-4.2, rising edge of count>=3,
 * no overlapping episode. This file does not retune that entry.
 *
 * The only sell rules are completed-week transitions. A week counts only
 * after a later week has started, or when its last session is a Friday and
 * no later bar exists. W1 is close crossing below the 20-week average.
 * W2 is the 20-week average crossing below the 60-week average. W3 is the
 * first week both are true. A level that was already true at the buy is not
 * a sell. The fill is the next session's open. A signal without that session
 * is dropped and counted. No other moving-average pair is tried.
 *
 * A rule is a sell candidate only when all six bars hold: out-of-sample
 * CAGR beats buy-and-hold on at least two chronological splits, full-sample
 * CAGR is at least buy-and-hold, at least 16 names have total return at
 * least buy-and-hold, average drawdown is not deeper, above-average
 * compounders do not lose more than 5 CAGR points and NVDA/AMD/AVGO do not
 * lose more than 10, and mean sells per name are at most 15.
 *
 * selectedStrategy stays null. This is not a production sell rule.
 */

import {
  FROZEN_THRESHOLDS,
  SELECTED_STRATEGY as TECHNICAL_SELECTED_STRATEGY,
  TICKERS,
  existingBuyIndexes,
  weekKey,
} from "./equity-technical-sell-v1.mjs"

export const SELECTED_STRATEGY = null
export const WEEKLY_FAST = 20
export const WEEKLY_SLOW = 60
export const MAX_SELLS = 15
export const STRONG_CAGR_GAP = -0.05
export const FOCUS_CAGR_GAP = -0.1
export const FOCUS = ["NVDA", "AMD", "AVGO"]
export const OOS_SPLITS = [0.7, 0.6, 0.5]

export const WEEKLY_JUDGMENT = {
  meaningful: "주봉 추세 SELL이 의미 있음",
  partial: "주봉 추세 SELL은 일부 종목에서만 의미 있음",
  hold: "주봉 추세 SELL도 Buy & Hold를 넘지 못함",
  insufficient: "증거 부족",
}

const RULES = [
  { id: "W1", complexity: 1 },
  { id: "W2", complexity: 1 },
  { id: "W3", complexity: 2 },
]

function finite(value) {
  return Number.isFinite(value)
}

function round4(value) {
  return finite(value) ? Math.round(value * 10000) / 10000 : null
}

function mean(values) {
  const xs = values.filter(finite)
  if (!xs.length) return null
  return xs.reduce((sum, value) => sum + value, 0) / xs.length
}

function isFriday(date) {
  const [year, month, day] = date.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 5
}

export function aggregateWeeks(bars) {
  const weeks = []
  let current = null
  const push = (week, terminal) => {
    const exec = week.end + 1 < bars.length ? week.end + 1 : null
    weeks.push({ ...week, terminal, exec, execOpen: exec == null ? null : bars[exec].open })
  }
  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i]
    const key = weekKey(bar.date)
    if (!current || current.key !== key) {
      if (current) push(current, false)
      current = {
        key,
        start: i,
        end: i,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      }
    } else {
      current.end = i
      current.high = Math.max(current.high, bar.high)
      current.low = Math.min(current.low, bar.low)
      current.close = bar.close
    }
  }
  if (current && isFriday(bars[current.end].date)) push(current, true)
  let sumFast = 0
  let sumSlow = 0
  for (let i = 0; i < weeks.length; i += 1) {
    sumFast += weeks[i].close
    sumSlow += weeks[i].close
    if (i >= WEEKLY_FAST) sumFast -= weeks[i - WEEKLY_FAST].close
    if (i >= WEEKLY_SLOW) sumSlow -= weeks[i - WEEKLY_SLOW].close
    weeks[i].ma20 = i >= WEEKLY_FAST - 1 ? sumFast / WEEKLY_FAST : null
    weeks[i].ma60 = i >= WEEKLY_SLOW - 1 ? sumSlow / WEEKLY_SLOW : null
  }
  return weeks
}

function bothBroken(week) {
  return finite(week.ma20) && finite(week.ma60) && week.close < week.ma20 && week.ma20 < week.ma60
}

export function weeklyTransitions(weeks) {
  const signals = { W1: [], W2: [], W3: [] }
  let excluded = 0
  for (let i = 1; i < weeks.length; i += 1) {
    const prev = weeks[i - 1]
    const curr = weeks[i]
    const events = []
    if (finite(prev.ma20) && finite(curr.ma20) && prev.close >= prev.ma20 && curr.close < curr.ma20) events.push("W1")
    if (finite(prev.ma20) && finite(prev.ma60) && finite(curr.ma20) && finite(curr.ma60) && prev.ma20 >= prev.ma60 && curr.ma20 < curr.ma60) {
      events.push("W2")
    }
    if (finite(prev.ma20) && finite(curr.ma20) && finite(prev.ma60) && finite(curr.ma60) && !bothBroken(prev) && bothBroken(curr)) {
      events.push("W3")
    }
    for (const id of events) {
      if (curr.exec == null || !(curr.execOpen > 0)) {
        excluded += 1
        continue
      }
      signals[id].push({ weekEnd: curr.end, exec: curr.exec, id })
    }
  }
  return { signals, excluded }
}

function yearsBetween(start, end) {
  const a = Date.parse(`${start}T00:00:00Z`)
  const b = Date.parse(`${end}T00:00:00Z`)
  if (!finite(a) || !finite(b) || b <= a) return null
  return (b - a) / 86400000 / 365.25
}

function markDrawdown(equity, peak) {
  const nextPeak = Math.max(peak, equity)
  const dd = equity / nextPeak - 1
  return { peak: nextPeak, dd }
}

export function simulatePath(bars, buyIndexes, sells, fromIdx = 0) {
  const n = bars.length
  const buys = new Set(buyIndexes.filter((index) => index >= fromIdx && index < n))
  const sellAt = new Map()
  for (const sell of sells) {
    if (sell.exec == null || sell.exec <= fromIdx || sell.exec >= n) continue
    if (!sellAt.has(sell.exec)) sellAt.set(sell.exec, sell)
  }
  let holding = false
  let entry = null
  let first = null
  let equity = 1
  let peak = 1
  let mdd = 0
  let span = 0
  let longDays = 0
  const tails = { d20: 0, d30: 0, d40: 0 }
  const trades = []
  const cashSpells = []
  const missed = []
  let flatFrom = null
  let reentries = 0
  const noteDay = () => {
    if (first == null) return
    span += 1
    if (holding) longDays += 1
    const marked = markDrawdown(equity, peak)
    peak = marked.peak
    mdd = Math.min(mdd, marked.dd)
    if (marked.dd <= -0.2) tails.d20 += 1
    if (marked.dd <= -0.3) tails.d30 += 1
    if (marked.dd <= -0.4) tails.d40 += 1
  }
  for (let i = fromIdx; i < n; i += 1) {
    const wasHolding = holding
    const entryBefore = entry
    const sell = sellAt.get(i)
    if (wasHolding && i > entryBefore && bars[i - 1].close > 0) {
      if (sell && sell.weekEnd > entryBefore && bars[i].open > 0) {
        equity *= bars[i].open / bars[i - 1].close
        trades.push({
          entry: entryBefore,
          exit: i,
          entryDate: bars[entryBefore].date,
          exitDate: bars[i].date,
          hold: i - entryBefore,
          ret: round4(bars[i].open / bars[entryBefore].close - 1),
          closed: true,
        })
        holding = false
        flatFrom = i
        entry = null
      } else {
        equity *= bars[i].close / bars[i - 1].close
      }
    }
    if (!holding && buys.has(i) && bars[i].close > 0) {
      if (first != null) reentries += 1
      if (flatFrom != null) {
        cashSpells.push(i - flatFrom)
        let maxClose = bars[flatFrom].open
        for (let k = flatFrom; k < i; k += 1) maxClose = Math.max(maxClose, bars[k].close)
        if (bars[flatFrom].open > 0) missed.push(maxClose / bars[flatFrom].open - 1)
        flatFrom = null
      }
      holding = true
      entry = i
      if (first == null) {
        first = i
        equity = 1
        peak = 1
        mdd = 0
      }
    }
    noteDay()
  }
  if (holding && entry != null) {
    trades.push({
      entry,
      exit: n - 1,
      entryDate: bars[entry].date,
      exitDate: bars[n - 1].date,
      hold: n - 1 - entry,
      ret: round4(bars[n - 1].close / bars[entry].close - 1),
      closed: false,
    })
  } else if (flatFrom != null && first != null) {
    cashSpells.push(n - flatFrom)
    let maxClose = bars[flatFrom].open
    for (let k = flatFrom; k < n; k += 1) maxClose = Math.max(maxClose, bars[k].close)
    if (bars[flatFrom].open > 0) missed.push(maxClose / bars[flatFrom].open - 1)
  }
  if (first == null) return null
  let bh = 1
  let bhPeak = 1
  let bhMdd = 0
  const bhTails = { d20: 0, d30: 0, d40: 0 }
  let bhSpan = 0
  for (let i = first; i < n; i += 1) {
    if (i > first && bars[i - 1].close > 0) bh *= bars[i].close / bars[i - 1].close
    bhSpan += 1
    const marked = markDrawdown(bh, bhPeak)
    bhPeak = marked.peak
    bhMdd = Math.min(bhMdd, marked.dd)
    if (marked.dd <= -0.2) bhTails.d20 += 1
    if (marked.dd <= -0.3) bhTails.d30 += 1
    if (marked.dd <= -0.4) bhTails.d40 += 1
  }
  const years = yearsBetween(bars[first].date, bars[n - 1].date)
  const totalReturn = equity - 1
  const bhReturn = bh - 1
  const cagr = years != null && years >= 0.25 && equity > 0 ? equity ** (1 / years) - 1 : null
  const bhCagr = years != null && years >= 0.25 && bh > 0 ? bh ** (1 / years) - 1 : null
  const closed = trades.filter((trade) => trade.closed)
  const overlap = closed.some((trade, index) => index > 0 && trade.entry < closed[index - 1].exit)
  return {
    trades: closed.length,
    reentries,
    open: trades.some((trade) => !trade.closed),
    overlap,
    avgHold: round4(mean(closed.map((trade) => trade.hold))),
    avgCash: round4(mean(cashSpells)),
    missedUpside: round4(mean(missed)),
    cagr: round4(cagr),
    bhCagr: round4(bhCagr),
    totalReturn: round4(totalReturn),
    bhTotalReturn: round4(bhReturn),
    mdd: round4(mdd),
    bhMdd: round4(bhMdd),
    excessCagr: finite(cagr) && finite(bhCagr) ? round4(cagr - bhCagr) : null,
    excessReturn: round4(totalReturn - bhReturn),
    beat: totalReturn >= bhReturn,
    timeInMarket: span > 0 ? round4(longDays / span) : null,
    upsideCapture: bhReturn !== 0 ? round4(totalReturn / bhReturn) : null,
    tails: {
      d20: span > 0 ? round4(tails.d20 / span) : null,
      d30: span > 0 ? round4(tails.d30 / span) : null,
      d40: span > 0 ? round4(tails.d40 / span) : null,
    },
    bhTails: {
      d20: bhSpan > 0 ? round4(bhTails.d20 / bhSpan) : null,
      d30: bhSpan > 0 ? round4(bhTails.d30 / bhSpan) : null,
      d40: bhSpan > 0 ? round4(bhTails.d40 / bhSpan) : null,
    },
    touched40: tails.d40 > 0,
    bhTouched40: bhTails.d40 > 0,
  }
}

function summarize(id, rows, excluded) {
  const present = rows.filter(Boolean)
  const wins = present.filter((row) => row.beat).length
  const summary = {
    id,
    tickers: present.length,
    tickerWins: wins,
    tickerWinRate: present.length ? round4(wins / present.length) : null,
    meanCagr: round4(mean(present.map((row) => row.cagr))),
    meanBhCagr: round4(mean(present.map((row) => row.bhCagr))),
    meanExcessCagr: round4(mean(present.map((row) => row.excessCagr))),
    meanTotalReturn: round4(mean(present.map((row) => row.totalReturn))),
    meanBhTotalReturn: round4(mean(present.map((row) => row.bhTotalReturn))),
    meanExcessReturn: round4(mean(present.map((row) => row.excessReturn))),
    meanMdd: round4(mean(present.map((row) => row.mdd))),
    meanBhMdd: round4(mean(present.map((row) => row.bhMdd))),
    meanTrades: round4(mean(present.map((row) => row.trades))),
    meanReentries: round4(mean(present.map((row) => row.reentries))),
    meanHold: round4(mean(present.map((row) => row.avgHold))),
    meanCash: round4(mean(present.map((row) => row.avgCash))),
    meanTimeInMarket: round4(mean(present.map((row) => row.timeInMarket))),
    meanUpsideCapture: round4(mean(present.map((row) => row.upsideCapture))),
    meanMissedUpside: round4(mean(present.map((row) => row.missedUpside))),
    tail20: round4(mean(present.map((row) => row.tails.d20))),
    tail30: round4(mean(present.map((row) => row.tails.d30))),
    tail40: round4(mean(present.map((row) => row.tails.d40))),
    bhTail20: round4(mean(present.map((row) => row.bhTails.d20))),
    bhTail30: round4(mean(present.map((row) => row.bhTails.d30))),
    bhTail40: round4(mean(present.map((row) => row.bhTails.d40))),
    namesTouching40: present.filter((row) => row.touched40).length,
    bhNamesTouching40: present.filter((row) => row.bhTouched40).length,
    excluded,
    overlap: present.some((row) => row.overlap),
  }
  summary.mddDiff = finite(summary.meanMdd) && finite(summary.meanBhMdd) ? round4(summary.meanMdd - summary.meanBhMdd) : null
  summary.cagrOverMdd = finite(summary.meanCagr) && summary.meanMdd < 0 ? round4(summary.meanCagr / Math.abs(summary.meanMdd)) : null
  summary.bhCagrOverMdd = finite(summary.meanBhCagr) && summary.meanBhMdd < 0 ? round4(summary.meanBhCagr / Math.abs(summary.meanBhMdd)) : null
  return summary
}

function strongCheck(byTicker, summary) {
  const rows = Object.entries(byTicker).filter(([, row]) => row && finite(row.bhCagr) && finite(row.cagr))
  const above = rows.filter(([, row]) => row.bhCagr > summary.meanBhCagr)
  const aboveGap = mean(above.map(([, row]) => row.excessCagr))
  const focus = {}
  let focusOk = true
  for (const symbol of FOCUS) {
    const row = byTicker[symbol]
    focus[symbol] = row ? row.excessCagr : null
    if (!row || !finite(row.excessCagr) || row.excessCagr < FOCUS_CAGR_GAP) focusOk = false
  }
  return {
    above: above.map(([symbol]) => symbol),
    aboveGap: round4(aboveGap),
    aboveOk: finite(aboveGap) && aboveGap >= STRONG_CAGR_GAP,
    focus,
    focusOk,
  }
}

function passes(summary, oos, strong) {
  const positive = oos.filter((row) => row.tickers >= 10 && finite(row.meanExcessCagr) && row.meanExcessCagr > 0).length
  return {
    oos: positive >= 2,
    cagr: finite(summary.meanExcessCagr) && summary.meanExcessCagr >= 0,
    breadth: summary.tickerWins >= 16,
    mdd: finite(summary.mddDiff) && summary.mddDiff >= 0,
    compounders: Boolean(strong.aboveOk && strong.focusOk),
    trades: finite(summary.meanTrades) && summary.meanTrades <= MAX_SELLS,
  }
}

function partial(summary, oos) {
  const positive = oos.filter((row) => row.tickers >= 10 && finite(row.meanExcessCagr) && row.meanExcessCagr > 0).length
  return positive >= 2 && summary.tickerWins >= 8 && summary.tickerWins < 16 && finite(summary.mddDiff) && summary.mddDiff >= 0
}

export function judgeWeekly(strategies) {
  const covered = Math.max(0, ...strategies.map((row) => row.summary.tickers))
  if (covered < 20) return { sell: WEEKLY_JUDGMENT.insufficient, buy: "C", adopted: false, winner: null, researchClosed: false }
  const adopted = strategies.filter((row) => Object.values(row.gates).every(Boolean))
  if (adopted.length) {
    adopted.sort((a, b) => a.complexity - b.complexity || (b.summary.meanExcessCagr ?? -Infinity) - (a.summary.meanExcessCagr ?? -Infinity))
    return { sell: WEEKLY_JUDGMENT.meaningful, buy: "A", adopted: true, winner: adopted[0].summary.id, researchClosed: false }
  }
  const some = strategies.filter((row) => partial(row.summary, row.oos))
  if (some.length) return { sell: WEEKLY_JUDGMENT.partial, buy: "B", adopted: false, winner: null, researchClosed: true }
  return { sell: WEEKLY_JUDGMENT.hold, buy: "B", adopted: false, winner: null, researchClosed: true }
}

export function prepareTicker(bars) {
  const buyIndexes = existingBuyIndexes(bars)
  const weeks = aggregateWeeks(bars)
  const { signals, excluded } = weeklyTransitions(weeks)
  return { buyIndexes, weeks, signals, excluded }
}

export function auditLookAhead(bars) {
  if (bars.length < 80) return 0
  const full = prepareTicker(bars)
  const cut = bars.length - 15
  const part = prepareTicker(bars.slice(0, cut))
  let violations = 0
  for (const week of part.weeks) {
    const other = full.weeks.find((item) => item.end === week.end)
    if (!other || other.close !== week.close || other.ma20 !== week.ma20 || other.ma60 !== week.ma60) violations += 1
    for (const id of ["W1", "W2", "W3"]) {
      const left = part.signals[id].some((signal) => signal.weekEnd === week.end)
      const right = full.signals[id].some((signal) => signal.weekEnd === week.end)
      if (left !== right) violations += 1
    }
  }
  const laterBuys = new Set(full.buyIndexes.filter((index) => index < cut))
  if (part.buyIndexes.length !== laterBuys.size) violations += 1
  for (const index of part.buyIndexes) if (!laterBuys.has(index)) violations += 1
  return violations
}

function runRule(prepared, id, fromIdx = 0) {
  const out = {}
  for (const [symbol, item] of prepared) {
    out[symbol] = simulatePath(item.bars, item.buyIndexes, item.signals[id], fromIdx)
  }
  return out
}

function compact(row) {
  if (!row) return null
  return {
    cagr: row.cagr,
    bhCagr: row.bhCagr,
    excessCagr: row.excessCagr,
    totalReturn: row.totalReturn,
    bhTotalReturn: row.bhTotalReturn,
    excessReturn: row.excessReturn,
    mdd: row.mdd,
    bhMdd: row.bhMdd,
    beat: row.beat,
    trades: row.trades,
    reentries: row.reentries,
    avgHold: row.avgHold,
    avgCash: row.avgCash,
    missedUpside: row.missedUpside,
    timeInMarket: row.timeInMarket,
    upsideCapture: row.upsideCapture,
    tails: row.tails,
    bhTails: row.bhTails,
  }
}

export function study(series) {
  if (SELECTED_STRATEGY !== null || TECHNICAL_SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  if (series.map((item) => item.symbol).join() !== TICKERS.join()) throw new Error("ticker order drifted")
  const prepared = new Map()
  let lookAhead = 0
  const buyCounts = {}
  for (const item of series) {
    const built = prepareTicker(item.bars)
    prepared.set(item.symbol, { bars: item.bars, ...built })
    buyCounts[item.symbol] = built.buyIndexes.length
    lookAhead += auditLookAhead(item.bars)
  }
  const focusNames = ["NVDA", "AMD", "AVGO", "TSLA", "ASML", "ANET", "PLTR", "VRT", "MU", "MSFT", "AAPL", "AMZN"]
  const strategies = RULES.map((rule) => {
    const byTicker = runRule(prepared, rule.id)
    const summary = summarize(rule.id, TICKERS.map((symbol) => byTicker[symbol]), [...prepared.values()].reduce((sum, item) => sum + item.excluded, 0))
    const oos = OOS_SPLITS.map((ratio) => {
      const rows = TICKERS.map((symbol) => {
        const item = prepared.get(symbol)
        return simulatePath(item.bars, item.buyIndexes, item.signals[rule.id], Math.floor(item.bars.length * ratio))
      })
      const card = summarize(rule.id, rows, 0)
      return {
        split: ratio,
        tickers: card.tickers,
        meanExcessCagr: card.meanExcessCagr,
        meanCagr: card.meanCagr,
        meanBhCagr: card.meanBhCagr,
        meanMdd: card.meanMdd,
        meanBhMdd: card.meanBhMdd,
        mddDiff: card.mddDiff,
        tickerWins: card.tickerWins,
        meanTrades: card.meanTrades,
        meanTimeInMarket: card.meanTimeInMarket,
        meanUpsideCapture: card.meanUpsideCapture,
      }
    })
    const tickerMap = Object.fromEntries(TICKERS.map((symbol) => [symbol, compact(byTicker[symbol])]))
    const strong = strongCheck(tickerMap, summary)
    const gates = passes(summary, oos, strong)
    return {
      complexity: rule.complexity,
      summary,
      oos,
      gates,
      strong,
      byTicker: tickerMap,
      focus: Object.fromEntries(focusNames.map((symbol) => [symbol, tickerMap[symbol]])),
    }
  })
  const judgment = judgeWeekly(strategies)
  const inferior = strategies.every((row) => finite(row.summary.meanExcessCagr) && row.summary.meanExcessCagr < 0)
  return {
    selectedStrategy: SELECTED_STRATEGY,
    buyChanged: false,
    production: { buy: false, sell: false, ui: false, api: false, db: false },
    buy: { source: "existingBuyIndexes", thresholds: FROZEN_THRESHOLDS, counts: buyCounts },
    rules: { fast: WEEKLY_FAST, slow: WEEKLY_SLOW, execution: "next session open", maxSells: MAX_SELLS },
    lookAhead: { violations: lookAhead },
    universe: TICKERS,
    strategies: strategies.map((row) => ({
      ...row.summary,
      complexity: row.complexity,
      gates: row.gates,
      oos: row.oos,
      strong: row.strong,
      byTicker: row.byTicker,
      focus: row.focus,
    })),
    judgment: { ...judgment, allInferiorToHold: inferior, miningStopped: !judgment.adopted },
  }
}

export { FROZEN_THRESHOLDS, TICKERS }
