/**
 * v37 weekly trend STATE research. Research only.
 * Not a sell rule. selectedStrategy stays null.
 *
 * On day t the weekly series is every completed prior week, using that
 * week's last known close, plus day t's close as the current week close.
 * Later sessions in the same week are not used. SMA periods are 20 and 60.
 * A state exists only after 60 weekly points are available.
 *
 * Display gates were locked before the first full run:
 * - A direction: RISK mean, median, and win rate are all below HOLD at T+60 and T+120, n>=10.
 * - A magnitude for display: those gaps are at least 3%p, 3%p, and 5%p.
 * - B: CAUTION mean exceeds RISK by at least 2%p at T+60 and T+120, and RISK T+120
 *   -10% hit rate is higher than CAUTION.
 * - Breadth: at least 10 tickers have both HOLD and RISK T+120 n>=10, and at least
 *   70% of them have a lower RISK mean than HOLD.
 * - T+60 and T+120 mean signs that disagree are discarded.
 * - Anything short of the full display gate, but with a consistent worse direction, is reference only.
 * - Mixed, missing, or n<10 evidence is discarded.
 * Passing the display gate still does not adopt a sell rule.
 */

import {
  EQUITY_SELL_RESEARCH_SELECTED_STRATEGY,
  EQUITY_SELL_RESEARCH_UNIVERSE,
} from "./equity-sell-research-universe.mjs"
import {
  FROZEN_THRESHOLDS,
  SELECTED_STRATEGY as TECHNICAL_SELECTED_STRATEGY,
  existingBuyIndexes,
  weekKey,
} from "./equity-technical-sell-v1.mjs"

if (EQUITY_SELL_RESEARCH_SELECTED_STRATEGY !== null || TECHNICAL_SELECTED_STRATEGY !== null) {
  throw new Error("selectedStrategy must stay null")
}

export const SELECTED_STRATEGY = null
export const TICKERS = EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol)
export const FOCUS_TICKERS = ["NVDA", "AMD", "AVGO", "CRWD", "PLTR", "TSLA"]
export const HORIZONS = [20, 60, 120]
export const ADOPT_MEAN_GAP = 0.03
export const ADOPT_WIN_GAP = 0.05
export const CAUTION_MEAN_GAP = 0.02
export const BREADTH_MIN = 0.7
export const BREADTH_TICKERS = 10
export const SELL_RULE = "채택하지 않음"
export const PRODUCTION_CHANGE = "변경 없음"

const NAMED_TRANSITIONS = [
  "HOLD->CAUTION",
  "CAUTION->HOLD",
  "CAUTION->RISK",
  "RISK->CAUTION",
  "RISK->HOLD",
  "HOLD->RISK",
]

export function sampleJudgment(n) {
  if (n < 5) return "결론 금지"
  if (n < 10) return "결론 보류"
  return "제한적 해석"
}

export function trailingSma(values, period) {
  if (values.length < period) return null
  let sum = 0
  for (let i = values.length - period; i < values.length; i += 1) sum += values[i]
  return sum / period
}

export function classifyState(weekClose, ma20, ma60) {
  if (weekClose == null || ma20 == null || ma60 == null) return null
  if (!(weekClose > 0) || !(ma20 > 0) || !(ma60 > 0)) return null
  if (ma20 < ma60) return "RISK"
  if (weekClose >= ma20) return "HOLD"
  return "CAUTION"
}

export function dailyTrendStates(bars) {
  const details = []
  const done = []
  let week = null
  let weekClose = null
  for (let i = 0; i < bars.length; i += 1) {
    const key = weekKey(bars[i].date)
    if (week == null) week = key
    if (key !== week) {
      done.push(weekClose)
      week = key
    }
    weekClose = bars[i].close
    const series = done.concat([weekClose])
    const ma20 = trailingSma(series, 20)
    const ma60 = trailingSma(series, 60)
    details.push({
      index: i,
      date: bars[i].date,
      close: bars[i].close,
      weekClose,
      ma20,
      ma60,
      state: classifyState(weekClose, ma20, ma60),
    })
  }
  return details
}

export function forwardPath(closes, index, horizon) {
  const end = index + horizon
  if (end >= closes.length) return null
  let mdd = 0
  for (let k = index; k <= end; k += 1) {
    const change = closes[k] / closes[index] - 1
    if (change < mdd) mdd = change
  }
  return {
    ret: closes[end] / closes[index] - 1,
    mdd,
    hit5: mdd <= -0.05,
    hit10: mdd <= -0.1,
    hit20: mdd <= -0.2,
  }
}

export function stateSpells(details) {
  const spells = []
  const transitions = []
  let current = null
  const closeSpell = (end, exit, open) => {
    current.end = end
    current.days = current.end - current.start + 1
    current.exit = exit
    current.open = open
    spells.push(current)
  }
  for (let i = 0; i < details.length; i += 1) {
    const state = details[i].state
    if (state == null) {
      if (current) {
        closeSpell(i - 1, null, false)
        current = null
      }
      continue
    }
    if (!current) {
      current = { state, start: i, date: details[i].date }
      transitions.push({ from: null, to: state, index: i, date: details[i].date, kind: "START" })
      continue
    }
    if (state !== current.state) {
      const from = current.state
      closeSpell(i - 1, state, false)
      transitions.push({ from, to: state, index: i, date: details[i].date, kind: `${from}->${state}` })
      current = { state, start: i, date: details[i].date }
    }
  }
  if (current) closeSpell(details.length - 1, null, true)
  return { spells, transitions }
}

function mean(values) {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2) return sorted[mid]
  return (sorted[mid - 1] + sorted[mid]) / 2
}

function rate(flags) {
  if (!flags.length) return null
  return flags.filter(Boolean).length / flags.length
}

export function summarizeEntries(closes, indexes) {
  const out = {}
  for (const horizon of HORIZONS) {
    const paths = []
    for (const index of indexes) {
      const path = forwardPath(closes, index, horizon)
      if (path) paths.push(path)
    }
    out[horizon] = {
      n: paths.length,
      missing: indexes.length - paths.length,
      mean: mean(paths.map((path) => path.ret)),
      median: median(paths.map((path) => path.ret)),
      winRate: rate(paths.map((path) => path.ret > 0)),
      mdd: mean(paths.map((path) => path.mdd)),
      hit5: rate(paths.map((path) => path.hit5)),
      hit10: rate(paths.map((path) => path.hit10)),
      hit20: rate(paths.map((path) => path.hit20)),
      sample: sampleJudgment(paths.length),
      filledWithWindowEnd: false,
    }
  }
  return out
}

function durationStats(days) {
  return {
    n: days.length,
    mean: mean(days),
    median: median(days),
    min: days.length ? Math.min(...days) : null,
    max: days.length ? Math.max(...days) : null,
  }
}

function emptyTransitionCounts() {
  return Object.fromEntries(NAMED_TRANSITIONS.map((kind) => [kind, 0]))
}

function cellDiff(left, right) {
  if (!left || !right || left.mean == null || right.mean == null) return null
  return {
    mean: left.mean - right.mean,
    median: left.median - right.median,
    winRate: left.winRate - right.winRate,
    leftN: left.n,
    rightN: right.n,
  }
}

function ready(cell) {
  return Boolean(cell && cell.n >= 10 && cell.mean != null && cell.median != null && cell.winRate != null)
}

function signWorse(risk, hold) {
  return ready(risk) && ready(hold) && risk.mean < hold.mean && risk.median < hold.median && risk.winRate < hold.winRate
}

function gapWorse(risk, hold) {
  return signWorse(risk, hold)
    && hold.mean - risk.mean >= ADOPT_MEAN_GAP
    && hold.median - risk.median >= ADOPT_MEAN_GAP
    && hold.winRate - risk.winRate >= ADOPT_WIN_GAP
}

export function judgeStateValue(pool, breadth) {
  const hold60 = pool.HOLD?.[60]
  const caution60 = pool.CAUTION?.[60]
  const risk60 = pool.RISK?.[60]
  const hold120 = pool.HOLD?.[120]
  const caution120 = pool.CAUTION?.[120]
  const risk120 = pool.RISK?.[120]
  const distinct = ready(caution60) && ready(risk60) && ready(caution120) && ready(risk120)
    && caution60.mean - risk60.mean >= CAUTION_MEAN_GAP
    && caution120.mean - risk120.mean >= CAUTION_MEAN_GAP
    && risk120.hit10 > caution120.hit10
  const broad = Boolean(
    breadth
    && breadth.qualified >= BREADTH_TICKERS
    && breadth.worse / breadth.qualified >= BREADTH_MIN,
  )
  const disagree = ready(risk60) && ready(hold60) && ready(risk120) && ready(hold120)
    && risk60.mean !== hold60.mean
    && risk120.mean !== hold120.mean
    && Math.sign(risk60.mean - hold60.mean) !== Math.sign(risk120.mean - hold120.mean)
  const direction = !disagree && signWorse(risk60, hold60) && signWorse(risk120, hold120)
  const display = direction && gapWorse(risk60, hold60) && gapWorse(risk120, hold120) && distinct && broad

  let label = "3. 의미 부족 → 폐기"
  let A = "RISK 상태가 이후 수익률 악화와 일관되게 연결되지 않는다."
  let B = "CAUTION과 RISK가 미리 정한 차이 기준을 충족하지 않는다."
  let C = "웹사이트에 표시할 정보 가치가 확인되지 않았다."
  if (direction) {
    A = "RISK 진입 후 T+60과 T+120에서 평균, 중앙값, 승률이 모두 HOLD보다 낮다."
    label = "2. 참고용으로만 가치 있음"
    B = distinct
      ? "CAUTION 평균이 RISK보다 T+60과 T+120에서 2%p 이상 높고, T+120의 -10% 도달 비율도 RISK가 더 높다."
      : "방향은 있으나 CAUTION과 RISK의 구분이 표시 기준에 못 미친다."
    C = broad
      ? "차이의 크기나 구분력이 화면 표시 기준에 못 미친다."
      : "종목별 방향이 충분히 고르지 않아 화면 표시로 채택하지 않는다."
    if (display) {
      label = "1. 채택 가능"
      C = "상태 표시의 정보 가치는 확인된다. 이것은 매도 규칙이 아니다."
    }
  } else if (disagree) {
    A = "T+60과 T+120에서 RISK-HOLD 평균의 부호가 다르다."
  }

  return {
    label,
    A,
    B,
    C,
    sellRule: SELL_RULE,
    production: PRODUCTION_CHANGE,
    selectedStrategy: null,
    flags: {
      sign60: signWorse(risk60, hold60),
      sign120: signWorse(risk120, hold120),
      gap60: gapWorse(risk60, hold60),
      gap120: gapWorse(risk120, hold120),
      distinct,
      broad,
      disagree,
      direction,
      display,
    },
  }
}

function assertThresholds() {
  if (
    FROZEN_THRESHOLDS.rsiMax !== 36
    || FROZEN_THRESHOLDS.stochKMax !== 15.4
    || FROZEN_THRESHOLDS.bbPctBMax !== 0.01
    || FROZEN_THRESHOLDS.ma20DevMax !== -4.2
  ) {
    throw new Error("BUY thresholds changed")
  }
}

function buyLinks(details, buyIndexes) {
  const states = details.map((row) => row.state)
  const nextEntry = (from, target) => {
    if (states[from] === target) return { index: from, days: 0, already: true }
    for (let i = from + 1; i < states.length; i += 1) {
      if (states[i] === target && states[i - 1] !== target) {
        return { index: i, days: i - from, already: false, date: details[i].date }
      }
    }
    return null
  }
  return buyIndexes.map((index) => {
    const risk = nextEntry(index, "RISK")
    const caution = nextEntry(index, "CAUTION")
    const hold = nextEntry(index, "HOLD")
    const buyClose = details[index].close
    return {
      index,
      date: details[index].date,
      stateAtBuy: states[index],
      hold,
      caution,
      risk,
      riskEntered: risk != null,
      returnAtRisk: risk ? details[risk.index].close / buyClose - 1 : null,
    }
  })
}

function drawdownInto(details, index, lookback) {
  const start = Math.max(0, index - lookback)
  let peak = details[index].close
  for (let i = start; i <= index; i += 1) peak = Math.max(peak, details[i].close)
  return details[index].close / peak - 1
}

function summarizePaths(paths, missing) {
  return {
    n: paths.length,
    missing,
    mean: mean(paths.map((path) => path.ret)),
    median: median(paths.map((path) => path.ret)),
    winRate: rate(paths.map((path) => path.ret > 0)),
    mdd: mean(paths.map((path) => path.mdd)),
    hit5: rate(paths.map((path) => path.hit5)),
    hit10: rate(paths.map((path) => path.hit10)),
    hit20: rate(paths.map((path) => path.hit20)),
    sample: sampleJudgment(paths.length),
    filledWithWindowEnd: false,
  }
}

function eventPool(perTicker) {
  const forward = {}
  for (const state of ["HOLD", "CAUTION", "RISK"]) {
    forward[state] = {}
    for (const horizon of HORIZONS) {
      const paths = []
      let missing = 0
      for (const ticker of perTicker) {
        for (const index of ticker.entryIndexes[state]) {
          const path = forwardPath(ticker.closes, index, horizon)
          if (path) paths.push(path)
          else missing += 1
        }
      }
      forward[state][horizon] = summarizePaths(paths, missing)
    }
  }
  return forward
}

export function auditLookAhead(bars) {
  const full = dailyTrendStates(bars)
  const violations = []
  const cuts = new Set()
  for (let i = 70; i < bars.length; i += 15) cuts.add(i)
  for (let i = Math.max(1, bars.length - 5); i <= bars.length; i += 1) cuts.add(i)
  const same = (left, right) => {
    if (left == null || right == null) return left == null && right == null
    return Math.abs(left - right) < 1e-9
  }
  for (const cut of cuts) {
    const prefix = dailyTrendStates(bars.slice(0, cut))
    for (let i = 0; i < prefix.length; i += 1) {
      const row = prefix[i]
      const base = full[i]
      if (
        row.state !== base.state
        || !same(row.weekClose, base.weekClose)
        || !same(row.ma20, base.ma20)
        || !same(row.ma60, base.ma60)
      ) {
        violations.push({
          index: i,
          date: base.date,
          cut,
          reason: "prefix state used a later close",
          prefix: row.state,
          full: base.state,
        })
        return violations
      }
    }
  }
  if (bars.length > 80) {
    const mutated = bars.map((bar) => ({ ...bar }))
    const at = bars.length - 1
    mutated[at] = { ...mutated[at], close: mutated[at].close * 10 + 1000 }
    const again = dailyTrendStates(mutated)
    for (let i = 0; i < at; i += 1) {
      if (again[i].state !== full[i].state || !same(again[i].ma20, full[i].ma20) || !same(again[i].weekClose, full[i].weekClose)) {
        violations.push({
          index: i,
          date: full[i].date,
          reason: "a future close changed an earlier state",
        })
        return violations
      }
    }
  }
  return violations
}

function analyzeTicker(symbol, bars) {
  const details = dailyTrendStates(bars)
  const { spells, transitions } = stateSpells(details)
  const closes = details.map((row) => row.close)
  const entryIndexes = { HOLD: [], CAUTION: [], RISK: [] }
  for (const spell of spells) entryIndexes[spell.state].push(spell.start)
  const forward = {
    HOLD: summarizeEntries(closes, entryIndexes.HOLD),
    CAUTION: summarizeEntries(closes, entryIndexes.CAUTION),
    RISK: summarizeEntries(closes, entryIndexes.RISK),
  }
  const dayCounts = { HOLD: 0, CAUTION: 0, RISK: 0, none: 0 }
  for (const row of details) dayCounts[row.state ?? "none"] += 1
  const defined = dayCounts.HOLD + dayCounts.CAUTION + dayCounts.RISK
  const transitionsNamed = emptyTransitionCounts()
  let starts = 0
  for (const transition of transitions) {
    if (transition.kind === "START") starts += 1
    else transitionsNamed[transition.kind] += 1
  }
  const duration = {}
  const durationCompleted = {}
  for (const state of ["HOLD", "CAUTION", "RISK"]) {
    const rows = spells.filter((spell) => spell.state === state)
    duration[state] = durationStats(rows.map((spell) => spell.days))
    durationCompleted[state] = durationStats(rows.filter((spell) => !spell.open).map((spell) => spell.days))
  }
  const cautionSpells = spells.filter((spell) => spell.state === "CAUTION")
  const cautionExits = {
    hold: cautionSpells.filter((spell) => spell.exit === "HOLD").length,
    risk: cautionSpells.filter((spell) => spell.exit === "RISK").length,
    open: cautionSpells.filter((spell) => spell.open).length,
  }
  const riskSpells = spells.filter((spell) => spell.state === "RISK")
  const recoveries = riskSpells.map((spell) => {
    let maDay = null
    let closeDay = null
    for (let i = spell.start + 1; i < details.length; i += 1) {
      const row = details[i]
      if (row.ma20 == null || row.ma60 == null) continue
      if (maDay == null && row.ma20 > row.ma60) maDay = i
      if (closeDay == null && row.weekClose > row.ma20) closeDay = i
      if (maDay != null && closeDay != null) break
    }
    return {
      maRecovered: maDay != null,
      daysToMa: maDay == null ? null : maDay - spell.start,
      closeRecovered: closeDay != null,
      daysToClose: closeDay == null ? null : closeDay - spell.start,
      alreadyAbove: details[spell.start].weekClose > details[spell.start].ma20,
      drawdown120: drawdownInto(details, spell.start, 120),
    }
  })
  const buys = buyLinks(details, existingBuyIndexes(bars))
  const laterRisk = buys.filter((buy) => buy.risk && !buy.risk.already)
  const spellDays = { HOLD: [], CAUTION: [], RISK: [] }
  const spellDaysCompleted = { HOLD: [], CAUTION: [], RISK: [] }
  for (const spell of spells) {
    spellDays[spell.state].push(spell.days)
    if (!spell.open) spellDaysCompleted[spell.state].push(spell.days)
  }
  return {
    symbol,
    from: details[0]?.date ?? null,
    to: details[details.length - 1]?.date ?? null,
    bars: details.length,
    dayCounts,
    dayShare: {
      HOLD: defined ? dayCounts.HOLD / defined : null,
      CAUTION: defined ? dayCounts.CAUTION / defined : null,
      RISK: defined ? dayCounts.RISK / defined : null,
    },
    entries: {
      HOLD: entryIndexes.HOLD.length,
      CAUTION: entryIndexes.CAUTION.length,
      RISK: entryIndexes.RISK.length,
    },
    entryIndexes,
    closes,
    forward,
    transitions: transitionsNamed,
    starts,
    duration,
    durationCompleted,
    cautionExits,
    recovery: {
      spells: riskSpells.length,
      open: riskSpells.filter((spell) => spell.open).length,
      maRate: rate(recoveries.map((row) => row.maRecovered)),
      closeRate: rate(recoveries.map((row) => row.closeRecovered)),
      alreadyAboveRate: rate(recoveries.map((row) => row.alreadyAbove)),
      daysToMa: {
        mean: mean(recoveries.filter((row) => row.daysToMa != null).map((row) => row.daysToMa)),
        median: median(recoveries.filter((row) => row.daysToMa != null).map((row) => row.daysToMa)),
      },
      daysToClose: {
        mean: mean(recoveries.filter((row) => row.daysToClose != null).map((row) => row.daysToClose)),
        median: median(recoveries.filter((row) => row.daysToClose != null).map((row) => row.daysToClose)),
      },
      medianDrawdown120: median(recoveries.map((row) => row.drawdown120)),
    },
    spellDays,
    spellDaysCompleted,
    maDays: recoveries.filter((row) => row.daysToMa != null).map((row) => row.daysToMa),
    closeDays: recoveries.filter((row) => row.daysToClose != null).map((row) => row.daysToClose),
    buys: {
      n: buys.length,
      byState: {
        HOLD: buys.filter((buy) => buy.stateAtBuy === "HOLD").length,
        CAUTION: buys.filter((buy) => buy.stateAtBuy === "CAUTION").length,
        RISK: buys.filter((buy) => buy.stateAtBuy === "RISK").length,
        none: buys.filter((buy) => buy.stateAtBuy == null).length,
      },
      laterCaution: {
        n: buys.filter((buy) => buy.caution && !buy.caution.already).length,
        medianDays: median(buys.filter((buy) => buy.caution && !buy.caution.already).map((buy) => buy.caution.days)),
      },
      laterRisk: {
        n: laterRisk.length,
        medianDays: median(laterRisk.map((buy) => buy.risk.days)),
        medianReturn: median(laterRisk.map((buy) => buy.returnAtRisk)),
      },
      riskEnteredShare: buys.length ? buys.filter((buy) => buy.riskEntered).length / buys.length : null,
    },
    laterCautionDays: buys.filter((buy) => buy.caution && !buy.caution.already).map((buy) => buy.caution.days),
    laterRiskDays: laterRisk.map((buy) => buy.risk.days),
    laterRiskReturns: laterRisk.map((buy) => buy.returnAtRisk),
  }
}

function addCounts(target, source) {
  for (const key of Object.keys(target)) target[key] += source[key] || 0
}

export function runStudy(seriesByTicker, expectedBuyCounts = null) {
  assertThresholds()
  if (TICKERS.length !== 31) throw new Error("universe size changed")
  if (SELECTED_STRATEGY !== null) throw new Error("selectedStrategy must stay null")
  const missing = TICKERS.filter((symbol) => !seriesByTicker[symbol]?.length)
  if (missing.length) throw new Error(`missing bars: ${missing.join(",")}`)

  const violations = []
  const perTicker = []
  for (const symbol of TICKERS) {
    const bars = seriesByTicker[symbol]
    const found = auditLookAhead(bars)
    if (found.length) {
      violations.push(...found.map((row) => ({ symbol, ...row })))
      const error = new Error("lookaheadViolations")
      error.violations = violations
      throw error
    }
    perTicker.push(analyzeTicker(symbol, bars))
  }

  const buyCounts = Object.fromEntries(perTicker.map((ticker) => [ticker.symbol, ticker.buys.n]))
  if (expectedBuyCounts) {
    const mismatch = TICKERS.filter((symbol) => buyCounts[symbol] !== expectedBuyCounts[symbol])
    if (mismatch.length) {
      throw new Error(`BUY count mismatch: ${mismatch.map((symbol) => `${symbol} ${buyCounts[symbol]}!=${expectedBuyCounts[symbol]}`).join(", ")}`)
    }
  }

  const forward = eventPool(perTicker)
  const dayCounts = { HOLD: 0, CAUTION: 0, RISK: 0, none: 0 }
  const entries = { HOLD: 0, CAUTION: 0, RISK: 0 }
  const transitions = emptyTransitionCounts()
  const cautionExits = { hold: 0, risk: 0, open: 0 }
  for (const ticker of perTicker) {
    addCounts(dayCounts, ticker.dayCounts)
    addCounts(entries, ticker.entries)
    addCounts(transitions, ticker.transitions)
    addCounts(cautionExits, ticker.cautionExits)
  }
  const defined = dayCounts.HOLD + dayCounts.CAUTION + dayCounts.RISK
  const diffs = { "CAUTION-HOLD": {}, "RISK-HOLD": {} }
  for (const horizon of HORIZONS) {
    diffs["CAUTION-HOLD"][horizon] = cellDiff(forward.CAUTION[horizon], forward.HOLD[horizon])
    diffs["RISK-HOLD"][horizon] = cellDiff(forward.RISK[horizon], forward.HOLD[horizon])
  }

  const breadthRows = perTicker.filter((ticker) => ticker.forward.HOLD[120].n >= 10 && ticker.forward.RISK[120].n >= 10)
  const breadth = {
    qualified: breadthRows.length,
    worse: breadthRows.filter((ticker) => ticker.forward.RISK[120].mean < ticker.forward.HOLD[120].mean).length,
  }
  const judgment = judgeStateValue(forward, breadth)
  const dates = perTicker.flatMap((ticker) => [ticker.from, ticker.to]).filter(Boolean).sort()

  return {
    version: "v37",
    selectedStrategy: null,
    sellRule: SELL_RULE,
    productionChanged: false,
    buyChanged: false,
    filledWithWindowEnd: false,
    universe: TICKERS,
    focus: FOCUS_TICKERS,
    thresholds: {
      rsiMax: FROZEN_THRESHOLDS.rsiMax,
      stochKMax: FROZEN_THRESHOLDS.stochKMax,
      bbPctBMax: FROZEN_THRESHOLDS.bbPctBMax,
      ma20DevMax: FROZEN_THRESHOLDS.ma20DevMax,
    },
    lookAhead: { violations: violations.length },
    integrity: {
      tickers: perTicker.length,
      from: dates[0] ?? null,
      to: dates[dates.length - 1] ?? null,
      bars: perTicker.reduce((sum, ticker) => sum + ticker.bars, 0),
      definedDays: defined,
      dayCounts,
      entries,
      transitions,
      transitionTotal: Object.values(transitions).reduce((sum, value) => sum + value, 0),
      episodes: perTicker.reduce((sum, ticker) => sum + ticker.buys.n, 0),
      buyCounts,
      buyState: {
        HOLD: perTicker.reduce((sum, ticker) => sum + ticker.buys.byState.HOLD, 0),
        CAUTION: perTicker.reduce((sum, ticker) => sum + ticker.buys.byState.CAUTION, 0),
        RISK: perTicker.reduce((sum, ticker) => sum + ticker.buys.byState.RISK, 0),
        none: perTicker.reduce((sum, ticker) => sum + ticker.buys.byState.none, 0),
      },
      laterCaution: {
        n: perTicker.reduce((sum, ticker) => sum + ticker.buys.laterCaution.n, 0),
        medianDays: median(perTicker.flatMap((ticker) => ticker.laterCautionDays)),
      },
      laterRisk: {
        n: perTicker.reduce((sum, ticker) => sum + ticker.buys.laterRisk.n, 0),
        medianDays: median(perTicker.flatMap((ticker) => ticker.laterRiskDays)),
        medianReturn: median(perTicker.flatMap((ticker) => ticker.laterRiskReturns)),
      },
    },
    distribution: {
      HOLD: defined ? dayCounts.HOLD / defined : null,
      CAUTION: defined ? dayCounts.CAUTION / defined : null,
      RISK: defined ? dayCounts.RISK / defined : null,
    },
    forward,
    diffs,
    duration: {
      HOLD: {
        all: durationStats(perTicker.flatMap((ticker) => ticker.spellDays.HOLD)),
        completed: durationStats(perTicker.flatMap((ticker) => ticker.spellDaysCompleted.HOLD)),
      },
      CAUTION: {
        all: durationStats(perTicker.flatMap((ticker) => ticker.spellDays.CAUTION)),
        completed: durationStats(perTicker.flatMap((ticker) => ticker.spellDaysCompleted.CAUTION)),
      },
      RISK: {
        all: durationStats(perTicker.flatMap((ticker) => ticker.spellDays.RISK)),
        completed: durationStats(perTicker.flatMap((ticker) => ticker.spellDaysCompleted.RISK)),
      },
    },
    cautionExits,
    recovery: poolRecovery(perTicker),
    breadth,
    judgment,
    tickers: perTicker.map(publicTicker),
    focusResults: FOCUS_TICKERS.map((symbol) => focusView(perTicker.find((ticker) => ticker.symbol === symbol))),
  }
}

function poolRecovery(perTicker) {
  const spells = perTicker.reduce((sum, ticker) => sum + ticker.recovery.spells, 0)
  const weighted = (key) => {
    if (!spells) return null
    return perTicker.reduce((sum, ticker) => sum + (ticker.recovery[key] ?? 0) * ticker.recovery.spells, 0) / spells
  }
  const maDays = perTicker.flatMap((ticker) => ticker.maDays)
  const closeDays = perTicker.flatMap((ticker) => ticker.closeDays)
  return {
    spells,
    open: perTicker.reduce((sum, ticker) => sum + ticker.recovery.open, 0),
    maRate: weighted("maRate"),
    closeRate: weighted("closeRate"),
    alreadyAboveRate: weighted("alreadyAboveRate"),
    daysToMa: { mean: mean(maDays), median: median(maDays) },
    daysToClose: { mean: mean(closeDays), median: median(closeDays) },
  }
}

function publicTicker(ticker) {
  return {
    symbol: ticker.symbol,
    from: ticker.from,
    to: ticker.to,
    bars: ticker.bars,
    dayCounts: ticker.dayCounts,
    dayShare: ticker.dayShare,
    entries: ticker.entries,
    forward: ticker.forward,
    transitions: ticker.transitions,
    duration: ticker.duration,
    durationCompleted: ticker.durationCompleted,
    cautionExits: ticker.cautionExits,
    recovery: ticker.recovery,
    buys: ticker.buys,
    sample: {
      HOLD: sampleJudgment(ticker.forward.HOLD[120].n),
      CAUTION: sampleJudgment(ticker.forward.CAUTION[120].n),
      RISK: sampleJudgment(ticker.forward.RISK[120].n),
    },
  }
}

function focusView(ticker) {
  if (!ticker) return null
  const cautionSample = sampleJudgment(ticker.forward.CAUTION[120].n)
  const riskSample = sampleJudgment(ticker.forward.RISK[120].n)
  const rank = { "결론 금지": 0, "결론 보류": 1, "제한적 해석": 2 }
  return {
    symbol: ticker.symbol,
    entries: ticker.entries,
    cautionT60: ticker.forward.CAUTION[60],
    cautionT120: ticker.forward.CAUTION[120],
    riskT60: ticker.forward.RISK[60],
    riskT120: ticker.forward.RISK[120],
    recovery: {
      spells: ticker.recovery.spells,
      maRate: ticker.recovery.maRate,
      closeRate: ticker.recovery.closeRate,
      daysToMa: ticker.recovery.daysToMa,
      medianDrawdown120: ticker.recovery.medianDrawdown120,
    },
    laterRisk: ticker.buys.laterRisk,
    buyState: ticker.buys.byState,
    sample: { caution: cautionSample, risk: riskSample },
    conclusion: rank[cautionSample] <= rank[riskSample] ? cautionSample : riskSample,
  }
}
