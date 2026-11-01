#!/usr/bin/env node
/**
 * Compare exact-3 type A, exact-3 type B, and exact 4/4 as separate episodes.
 *   node scripts/yds-daily-bottom-buy-3of4-typeABC-research.mjs
 *
 * Does not change production code, UI, API, DB, or strategy.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { enrichBarsWithIndicators } from "./lib/daily-bottom-indicators.mjs"
import {
  conditionFlags,
  summarizeNumeric,
  timeSplitBars,
  TRAIN_RATIO,
} from "./lib/daily-bottom-buy-validation-core.mjs"
import {
  EPISODE_DEF,
  FROZEN_THRESHOLDS,
} from "./lib/daily-bottom-split-buy-sim.mjs"
import {
  EQUITY_CANDIDATES,
  WARMUP_IDX,
  attachObservationFeatures,
  assertNoEtfInStudyUniverse,
} from "./lib/daily-bottom-buy-cross-asset-validation.mjs"
import { drawdownFromRollingHigh } from "./lib/daily-bottom-buy-correction-stage-validation.mjs"
import { JUDGE_GATES } from "./lib/daily-bottom-buy-individual-stock-train-test-validation.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")
const OUT_JSON = path.join(ROOT, "scripts", ".cache", "yds-daily-bottom-buy-3of4-typeABC-result.json")

const HORIZON = 60
const DEPTH = 120
const MIN_N = 20
const MIN_SYMBOL = 5
const MAE_PP = JUDGE_GATES.maeImprovePp
const TAIL_PP = JUDGE_GATES.tailWorsenPp
const GROUPS = ["A", "B", "C"]
const CASES = ["MA", "JPM", "PLD", "RTX", "NEE", "HD", "AMT"]
const PERIODS = [
  { id: "p1", label: "2016-2021", start: "2016-01-01", end: "2021-12-31" },
  { id: "p2", label: "2022-2023", start: "2022-01-01", end: "2023-12-31" },
  { id: "p3", label: "2024-2026", start: "2024-01-01", end: "2026-12-31" },
]

function round2(v) {
  if (v == null || !Number.isFinite(v)) return null
  return Math.round(v * 100) / 100
}

function rate(n, d) {
  if (!d) return null
  return round2((n / d) * 100)
}

function pctChange(next, base) {
  if (!(base > 0) || !Number.isFinite(next)) return null
  return (next / base - 1) * 100
}

function loadCached(yahoo) {
  const cp = path.join(BAR_DIR, `${yahoo.replace(/[^A-Za-z0-9.-]/g, "_")}.json`)
  if (!fs.existsSync(cp)) return null
  const raw = JSON.parse(fs.readFileSync(cp, "utf8"))
  return Array.isArray(raw.bars) ? raw.bars : null
}

function groupOf(flags) {
  if (flags.count >= 4) return "C"
  if (flags.count === 3 && flags.rsi && flags.stoch && flags.bb && !flags.ma) return "A"
  if (flags.count === 3 && flags.ma) return "B"
  return null
}

function collectOpens(length, typeAt, countAt, target) {
  const opens = []
  let i = 0
  while (i < length) {
    const now = typeAt(i)
    const before = i > 0 ? typeAt(i - 1) : null
    if (now !== target || before === target) {
      i += 1
      continue
    }
    let end = i
    const limit = Math.min(length - 1, i + EPISODE_DEF.maxWindow)
    for (let j = i; j <= limit; j++) {
      end = j
      if (j > i && countAt(j) < EPISODE_DEF.coolBelow) break
    }
    opens.push(i)
    i = end + 1
  }
  return opens
}

function forwardFrom(closes, entry) {
  const px = closes[entry]
  const end = Math.min(entry + HORIZON, closes.length - 1)
  if (!(px > 0) || end <= entry) return null
  let minPx = px
  let minAt = entry
  let maxPx = px
  for (let i = entry + 1; i <= end; i++) {
    if (closes[i] < minPx) {
      minPx = closes[i]
      minAt = i
    }
    if (closes[i] > maxPx) maxPx = closes[i]
  }
  const at = (k) => (entry + k <= end ? pctChange(closes[entry + k], px) : null)
  return {
    full: end - entry === HORIZON,
    d5: at(5),
    d10: at(10),
    d20: at(20),
    d40: at(40),
    d60: at(60),
    mae: ((px - minPx) / px) * 100,
    lowVs: ((minPx - px) / px) * 100,
    daysToLow: minAt - entry,
    hitM3: minPx <= px * 0.97 + 1e-8,
    hitM5: minPx <= px * 0.95 + 1e-8,
    hitM10: minPx <= px * 0.9 + 1e-8,
    hitM15: minPx <= px * 0.85 + 1e-8,
    hitM20: minPx <= px * 0.8 + 1e-8,
    hit5: maxPx >= px * 1.05 - 1e-8,
    hit10: maxPx >= px * 1.1 - 1e-8,
    hit15: maxPx >= px * 1.15 - 1e-8,
  }
}

function firstHit(types, start, end, target) {
  for (let j = start; j <= end; j++) if (types[j] === target) return j
  return null
}

function afterTransition(closes, at, end, basePx) {
  if (!(basePx > 0) || at >= end) return { room: false, hitM5: null, hitM10: null }
  let minPx = basePx
  for (let j = at + 1; j <= end; j++) if (closes[j] < minPx) minPx = closes[j]
  return {
    room: true,
    hitM5: minPx <= basePx * 0.95 + 1e-8,
    hitM10: minPx <= basePx * 0.9 + 1e-8,
  }
}

function analyzeSymbol(meta, rawBars) {
  if (!rawBars?.length) return { symbol: meta.symbol, status: "data unavailable", episodes: [] }
  const bars = attachObservationFeatures(enrichBarsWithIndicators(rawBars))
  const split = timeSplitBars(bars, TRAIN_RATIO)
  const types = bars.map((bar) => groupOf(conditionFlags(bar, FROZEN_THRESHOLDS)))
  const counts = bars.map((bar) => conditionFlags(bar, FROZEN_THRESHOLDS).count)
  const from = Math.min(WARMUP_IDX, Math.max(0, bars.length - 1))
  const episodes = []
  for (const group of GROUPS) {
    const opens = collectOpens(bars.length, (i) => types[i], (i) => counts[i], group).filter((i) => i >= from)
    for (const openIdx of opens) {
      const end = Math.min(bars.length - 1, openIdx + HORIZON)
      const full = end - openIdx === HORIZON
      const bar = bars[openIdx]
      const flags = conditionFlags(bar, FROZEN_THRESHOLDS)
      let transition = null
      if (full && group !== "C") {
        const bAt = group === "A" ? firstHit(types, openIdx + 1, end, "B") : null
        const cAt = firstHit(types, openIdx + 1, end, "C")
        const cAfterB = bAt == null ? null : firstHit(types, bAt + 1, end, "C")
        const pack = (at) => {
          if (at == null) return null
          const later = afterTransition(bars.map((b) => b.close), at, end, bars[at].close)
          return {
            day: at - openIdx,
            vsDay0: round2(pctChange(bars[at].close, bar.close)),
            hitM5: later.hitM5,
            hitM10: later.hitM10,
            room: later.room,
          }
        }
        transition = {
          toB: pack(bAt),
          toC: pack(cAt),
          chain: cAfterB == null ? null : { ...pack(cAfterB), bDay: bAt - openIdx },
        }
      }
      const closes = []
      for (let i = openIdx; i <= openIdx + HORIZON && i < bars.length; i++) closes.push(bars[i].close)
      episodes.push({
        symbol: meta.symbol,
        date: bar.date,
        split: openIdx < split.splitIdx ? "train" : "test",
        group,
        full,
        rsi: bar.rsi14,
        stoch: bar.stochK,
        bb: bar.bbPctB,
        ma: bar.ma20DevPct,
        atr: bar.atrPct,
        dd120: drawdownFromRollingHigh(bars, openIdx, DEPTH),
        maPass: flags.ma,
        fwd: forwardFrom(closes, 0),
        transition,
      })
    }
  }
  return { symbol: meta.symbol, status: "ok", episodes }
}

function num(rows, pick) {
  return summarizeNumeric(rows.map(pick))
}

function hits(rows, key) {
  return rate(rows.filter((r) => r.fwd?.[key]).length, rows.length)
}

function metric(rows) {
  const use = rows.filter((r) => r.full && r.fwd?.full)
  return {
    n: use.length,
    d5: num(use, (r) => r.fwd.d5),
    d10: num(use, (r) => r.fwd.d10),
    d20: num(use, (r) => r.fwd.d20),
    d40: num(use, (r) => r.fwd.d40),
    d60: num(use, (r) => r.fwd.d60),
    mae: num(use, (r) => r.fwd.mae),
    lowVs: num(use, (r) => r.fwd.lowVs),
    daysToLow: num(use, (r) => r.fwd.daysToLow),
    hitM3Pct: hits(use, "hitM3"),
    hitM5Pct: hits(use, "hitM5"),
    hitM10Pct: hits(use, "hitM10"),
    hitM15Pct: hits(use, "hitM15"),
    hitM20Pct: hits(use, "hitM20"),
    hit5Pct: hits(use, "hit5"),
    hit10Pct: hits(use, "hit10"),
    hit15Pct: hits(use, "hit15"),
    dd120: num(use, (r) => r.dd120),
    atr: num(use, (r) => r.atr),
    rsi: num(use, (r) => r.rsi),
    stoch: num(use, (r) => r.stoch),
    bb: num(use, (r) => r.bb),
    ma: num(use, (r) => r.ma),
  }
}

function bySplit(rows) {
  return {
    n: rows.filter((r) => r.full).length,
    trainN: rows.filter((r) => r.full && r.split === "train").length,
    testN: rows.filter((r) => r.full && r.split === "test").length,
    all: metric(rows),
    train: metric(rows.filter((r) => r.split === "train")),
    test: metric(rows.filter((r) => r.split === "test")),
  }
}

function med(summary) {
  return summary?.median ?? null
}

function transitionBlock(rows, pick) {
  const found = rows.filter((r) => pick(r))
  const steps = found.map(pick)
  const withRoom = steps.filter((step) => step.room)
  return {
    n: found.length,
    sharePct: rate(found.length, rows.length),
    day: num(found, () => null) && summarizeNumeric(steps.map((step) => step.day)),
    vsDay0: summarizeNumeric(steps.map((step) => step.vsDay0)),
    hitM5Pct: rate(withRoom.filter((step) => step.hitM5).length, withRoom.length),
    hitM10Pct: rate(withRoom.filter((step) => step.hitM10).length, withRoom.length),
    lowVs: summarizeNumeric(found.map((r) => r.fwd.lowVs)),
    bDay: steps[0]?.bDay != null ? summarizeNumeric(steps.filter((step) => step.bDay != null).map((step) => step.bDay)) : null,
  }
}

function transitionsFor(rows) {
  const use = rows.filter((r) => r.full)
  const out = {}
  for (const split of ["all", "train", "test"]) {
    const list = split === "all" ? use : use.filter((r) => r.split === split)
    const a = list.filter((r) => r.group === "A")
    const b = list.filter((r) => r.group === "B")
    out[split] = {
      aToB: transitionBlock(a, (r) => r.transition?.toB),
      aToC: transitionBlock(a, (r) => r.transition?.toC),
      aToBToC: transitionBlock(a, (r) => r.transition?.chain),
      bToC: transitionBlock(b, (r) => r.transition?.toC),
    }
  }
  return out
}

function symbolsOf(rows, group) {
  return new Set(rows.filter((r) => r.full && r.group === group).map((r) => r.symbol))
}

function overlap(rows) {
  const a = symbolsOf(rows, "A")
  const b = symbolsOf(rows, "B")
  const c = symbolsOf(rows, "C")
  const inter = (x, y) => [...x].filter((symbol) => y.has(symbol)).length
  const all3 = [...a].filter((symbol) => b.has(symbol) && c.has(symbol))
  return {
    a: a.size,
    b: b.size,
    c: c.size,
    ab: inter(a, b),
    ac: inter(a, c),
    bc: inter(b, c),
    abc: all3.length,
  }
}

function withinSymbol(rows) {
  const by = new Map()
  for (const row of rows.filter((r) => r.full)) {
    if (!by.has(row.symbol)) by.set(row.symbol, [])
    by.get(row.symbol).push(row)
  }
  const compared = []
  for (const [symbol, list] of by) {
    const a = list.filter((r) => r.group === "A")
    const b = list.filter((r) => r.group === "B")
    if (a.length < MIN_SYMBOL || b.length < MIN_SYMBOL) continue
    const am = metric(a)
    const bm = metric(b)
    compared.push({
      symbol,
      aN: a.length,
      bN: b.length,
      aMae: med(am.mae),
      bMae: med(bm.mae),
      aM10: am.hitM10Pct,
      bM10: bm.hitM10Pct,
      aLowerMae: med(am.mae) < med(bm.mae),
      aLowerM10: am.hitM10Pct < bm.hitM10Pct,
    })
  }
  return {
    n: compared.length,
    lowerMae: compared.filter((row) => row.aLowerMae).length,
    lowerBoth: compared.filter((row) => row.aLowerMae && row.aLowerM10).length,
    rows: compared,
  }
}

function caseStudy(rows) {
  return CASES.map((symbol) => {
    const list = rows.filter((r) => r.symbol === symbol).sort((x, y) => x.date.localeCompare(y.date))
    const compressed = []
    for (const row of list) {
      const last = compressed[compressed.length - 1]
      if (!last || last.group !== row.group) compressed.push({ group: row.group, date: row.date, n: 1 })
      else last.n += 1
    }
    return {
      symbol,
      n: list.length,
      fullN: list.filter((r) => r.full).length,
      counts: Object.fromEntries(GROUPS.map((group) => [group, list.filter((r) => r.group === group).length])),
      sequence: compressed.map((row) => row.group).join(" → ") || "none",
      recent: list.slice(-6).map((row) => ({
        date: row.date,
        group: row.group,
        full: row.full,
        toB: row.transition?.toB?.day ?? null,
        toC: row.transition?.toC?.day ?? null,
        chain: row.transition?.chain?.day ?? null,
      })),
    }
  })
}

function lowerRisk(a, b) {
  return a.n >= MIN_N && b.n >= MIN_N && a.mae.median <= b.mae.median - MAE_PP && a.hitM10Pct <= b.hitM10Pct - TAIL_PP
}

function shallower(a, b) {
  return a.n >= MIN_N && b.n >= MIN_N && a.dd120.median >= b.dd120.median + MAE_PP
}

function deeper(a, b) {
  return a.n >= MIN_N && b.n >= MIN_N && a.dd120.median <= b.dd120.median - MAE_PP
}

function distinctRisk(a, b) {
  const maeGap = Math.abs(a.mae.median - b.mae.median)
  const tailGap = Math.abs(a.hitM10Pct - b.hitM10Pct)
  const maeDir = Math.sign(a.mae.median - b.mae.median)
  const tailDir = Math.sign(a.hitM10Pct - b.hitM10Pct)
  return a.n >= MIN_N && b.n >= MIN_N && maeDir !== 0 && maeDir === tailDir && maeGap >= MAE_PP && tailGap >= TAIL_PP
}

function conclude(groups, overlapInfo, within, transitions) {
  const a = groups.A
  const b = groups.B
  const c = groups.C
  const abRisk = lowerRisk(a.train, b.train) && lowerRisk(a.test, b.test)
  const abShallow = shallower(a.train, b.train) && shallower(a.test, b.test)
  const cDeep = deeper(c.train, b.train) && deeper(c.test, b.test)
  const cPath = distinctRisk(c.train, b.train) && distinctRisk(c.test, b.test)
  const broad = overlapInfo.abc >= 24
  const withinOk = within.n < 10 || within.lowerBoth / within.n >= 0.5
  const chainTest = transitions.test.aToBToC.sharePct
  const chainTrain = transitions.train.aToBToC.sharePct
  const checks = { abRisk, abShallow, cDeep, cPath, broad, withinOk, chainTest, chainTrain }
  if (abRisk && abShallow && cDeep && cPath && broad && withinOk) {
    return { ...checks, code: "A", label: "A/B/C가 서로 다른 조정 상태와 가격 경로를 보여 후보 유형을 구분해서 볼 근거가 충분하다." }
  }
  if (abRisk && withinOk && broad && !(cDeep && cPath)) {
    return { ...checks, code: "B", label: "A와 B의 위험 차이는 확인되지만 4/4와의 단계적 관계가 불명확하다." }
  }
  return { ...checks, code: "C", label: "그룹 차이가 종목 구성이나 표본 차이로 설명될 가능성이 있어 현재 로직을 바꿀 근거가 부족하다." }
}

function assertMath() {
  const types = [null, "A", "A", "B", "C", null, "A"]
  const counts = [1, 3, 3, 3, 4, 1, 3]
  const aOpens = collectOpens(types.length, (i) => types[i], (i) => counts[i], "A")
  const cOpens = collectOpens(types.length, (i) => types[i], (i) => counts[i], "C")
  if (aOpens.join() !== "1,6") throw new Error(`A opens ${aOpens}`)
  if (cOpens.join() !== "4") throw new Error(`C opens ${cOpens}`)
  const flagsA = groupOf({ count: 3, rsi: true, stoch: true, bb: true, ma: false })
  const flagsB = groupOf({ count: 3, rsi: false, stoch: true, bb: true, ma: true })
  const flagsC = groupOf({ count: 4, rsi: true, stoch: true, bb: true, ma: true })
  if (flagsA !== "A" || flagsB !== "B" || flagsC !== "C") throw new Error("group")
}

function view(block) {
  return {
    n: block.n,
    dd120: med(block.dd120),
    atr: med(block.atr),
    rsi: med(block.rsi),
    stoch: med(block.stoch),
    bb: med(block.bb),
    ma: med(block.ma),
    d5: med(block.d5),
    d10: med(block.d10),
    d20: med(block.d20),
    d40: med(block.d40),
    d60: med(block.d60),
    lowVs: med(block.lowVs),
    daysToLow: med(block.daysToLow),
    mae: med(block.mae),
    hitM3Pct: block.hitM3Pct,
    hitM5Pct: block.hitM5Pct,
    hitM10Pct: block.hitM10Pct,
    hitM15Pct: block.hitM15Pct,
    hitM20Pct: block.hitM20Pct,
    hit5Pct: block.hit5Pct,
    hit10Pct: block.hit10Pct,
    hit15Pct: block.hit15Pct,
  }
}

function main() {
  assertMath()
  assertNoEtfInStudyUniverse()
  console.log("node scripts/yds-daily-bottom-buy-3of4-typeABC-research.mjs")
  const rows = []
  for (const meta of EQUITY_CANDIDATES) {
    const row = analyzeSymbol(meta, loadCached(meta.yahoo))
    console.log(`  ${meta.symbol}: ${row.status} episodes=${row.episodes.length}`)
    rows.push(...row.episodes)
  }
  if (rows.some((r) => r.group === "A" && r.maPass)) throw new Error("A includes MA20")
  const ready = rows.filter((r) => r.full)
  const groups = Object.fromEntries(GROUPS.map((group) => [group, bySplit(rows.filter((r) => r.group === group))]))
  const periods = PERIODS.map((period) => {
    const subset = ready.filter((r) => r.date >= period.start && r.date <= period.end)
    return {
      ...period,
      groups: Object.fromEntries(GROUPS.map((group) => [group, metric(subset.filter((r) => r.group === group))])),
    }
  })
  const trans = transitionsFor(rows)
  const names = overlap(rows)
  const within = withinSymbol(rows)
  const cases = caseStudy(rows)
  const verdict = conclude(groups, names, within, trans)
  const doc = {
    generatedAt: new Date().toISOString(),
    definition: {
      thresholds: FROZEN_THRESHOLDS,
      episodeDef: EPISODE_DEF,
      groups: "A, B, and C are separate episode walks. A day belongs to only one group. A new episode of that group opens when the group appears after a day that was not that group, then the walk skips the same 20-session or count-below-2 episode end. One group does not block another group.",
      horizon: "Performance uses the next 60 closes. MAE is the worst later close versus the group Day 0 close.",
      split: "Train/Test is the existing per-symbol 70/30 bar split. Calendar periods are descriptive only.",
      transition: "Inside 60 sessions after an A or B Day 0. A missing transition is not a failed episode. Additional decline after a transition uses only closes through that same 60th session.",
      cases: "Historical cache episodes only. The live candidate classification is not mixed into these returns.",
      gates: `Lower risk means MAE at least ${MAE_PP} point lower and additional -10% at least ${TAIL_PP} points lower. Shallower drawdown means the 120-day drawdown median is at least ${MAE_PP} point less negative.`,
      notASignal: "No result is a production change.",
    },
    coverage: {
      symbols: EQUITY_CANDIDATES.length,
      opens: rows.length,
      full: ready.length,
      byGroup: Object.fromEntries(GROUPS.map((group) => [group, groups[group].n])),
      train: Object.fromEntries(GROUPS.map((group) => [group, groups[group].trainN])),
      test: Object.fromEntries(GROUPS.map((group) => [group, groups[group].testN])),
    },
    groups,
    periods,
    overlap: names,
    within,
    transitions: trans,
    cases,
    conclusion: verdict,
  }
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc))
  console.log(`wrote ${OUT_JSON}`)
  console.log(interpret(doc).join("\n"))
  console.log(`${doc.conclusion.code}. ${doc.conclusion.label}`)
  console.log("production 변경 없음")
}

function sideLine(label, block) {
  const v = view(block)
  return `${label} n ${v.n} DD ${v.dd120} ATR ${v.atr} RSI ${v.rsi} Stoch ${v.stoch} BB ${v.bb} MA ${v.ma} | D5 ${v.d5} D10 ${v.d10} D20 ${v.d20} D40 ${v.d40} D60 ${v.d60} low ${v.lowVs} day ${v.daysToLow} MAE ${v.mae} | -3 ${v.hitM3Pct} -5 ${v.hitM5Pct} -10 ${v.hitM10Pct} -15 ${v.hitM15Pct} -20 ${v.hitM20Pct} +5 ${v.hit5Pct} +10 ${v.hit10Pct} +15 ${v.hit15Pct}`
}

function stepLine(name, block) {
  return `${name} n ${block.n} share ${block.sharePct} day ${med(block.day)} vs0 ${med(block.vsDay0)} after-5 ${block.hitM5Pct} after-10 ${block.hitM10Pct} low ${med(block.lowVs)}`
}

function interpret(doc) {
  const lines = []
  lines.push(`full A ${doc.coverage.byGroup.A} B ${doc.coverage.byGroup.B} C ${doc.coverage.byGroup.C}`)
  lines.push(`train A ${doc.coverage.train.A} B ${doc.coverage.train.B} C ${doc.coverage.train.C}`)
  lines.push(`test A ${doc.coverage.test.A} B ${doc.coverage.test.B} C ${doc.coverage.test.C}`)
  for (const group of GROUPS) {
    lines.push(sideLine(`${group} train`, doc.groups[group].train))
    lines.push(sideLine(`${group} test`, doc.groups[group].test))
  }
  lines.push(`symbols A ${doc.overlap.a} B ${doc.overlap.b} C ${doc.overlap.c} AB ${doc.overlap.ab} AC ${doc.overlap.ac} BC ${doc.overlap.bc} ABC ${doc.overlap.abc}`)
  lines.push(`within ${doc.within.n} A-lower-MAE ${doc.within.lowerMae} A-lower-both ${doc.within.lowerBoth}`)
  for (const split of ["train", "test"]) {
    const t = doc.transitions[split]
    lines.push(`${split} ${stepLine("A→B", t.aToB)}`)
    lines.push(`${split} ${stepLine("A→C", t.aToC)}`)
    lines.push(`${split} ${stepLine("A→B→C", t.aToBToC)}`)
    lines.push(`${split} ${stepLine("B→C", t.bToC)}`)
  }
  for (const row of doc.cases) lines.push(`${row.symbol} ${row.sequence} counts ${JSON.stringify(row.counts)} recent ${row.recent.map((item) => `${item.date}:${item.group}${item.full ? "" : "*"}`).join(", ")}`)
  for (const period of doc.periods) {
    const bits = GROUPS.map((group) => {
      const block = period.groups[group]
      return `${group} n ${block.n} MAE ${med(block.mae)} -10 ${block.hitM10Pct}`
    })
    lines.push(`${period.label} ${bits.join(" | ")}`)
  }
  return lines
}

main()
