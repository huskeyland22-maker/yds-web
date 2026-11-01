#!/usr/bin/env node
/**
 * Order and depth of an exact 3-of-4 open.
 *   node scripts/yds-daily-bottom-buy-3of4-order-research.mjs
 *
 * Does not change production code, UI, API, DB, thresholds, or strategy.
 * No new cutoff search.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { enrichBarsWithIndicators } from "./lib/daily-bottom-indicators.mjs"
import {
  summarizeNumeric,
  timeSplitBars,
  TRAIN_RATIO,
} from "./lib/daily-bottom-buy-validation-core.mjs"
import {
  EPISODE_DEF,
  FROZEN_THRESHOLDS,
  buildSplitBuyEpisodes,
} from "./lib/daily-bottom-split-buy-sim.mjs"
import {
  EQUITY_CANDIDATES,
  MIN_BARS,
  WARMUP_IDX,
  attachObservationFeatures,
  assertNoEtfInStudyUniverse,
} from "./lib/daily-bottom-buy-cross-asset-validation.mjs"
import { JUDGE_GATES } from "./lib/daily-bottom-buy-individual-stock-train-test-validation.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")
const OUT_JSON = path.join(ROOT, "scripts", ".cache", "yds-daily-bottom-buy-3of4-order-result.json")

const HORIZON = 60
const NEED = 120
const LOOKBACK = 20
const MIN_TEST = 20
const MAE_PP = JUDGE_GATES.maeImprovePp
const TAIL_PP = JUDGE_GATES.tailWorsenPp
const KEYS = [
  { id: "rsi", flag: "flagRsi" },
  { id: "stoch", flag: "flagStoch" },
  { id: "bb", flag: "flagBb" },
  { id: "ma", flag: "flagMa" },
]
const COMBOS = ["rsi_stoch_bb", "rsi_stoch_ma", "rsi_bb_ma", "stoch_bb_ma"]

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

function num(rows, pick) {
  return summarizeNumeric(rows.map(pick))
}

function comboId(bar) {
  const on = KEYS.filter((k) => bar[k.flag]).map((k) => k.id)
  return on.length === 3 ? on.join("_") : "other"
}

function slackOf(bar) {
  const th = FROZEN_THRESHOLDS
  return {
    rsi: bar.rsi14 == null ? null : th.rsiMax - bar.rsi14,
    stoch: bar.stochK == null ? null : th.stochKMax - bar.stochK,
    bb: bar.bbPctB == null ? null : th.bbPctBMax - bar.bbPctB,
    ma: bar.ma20DevPct == null ? null : th.ma20DevMax - bar.ma20DevPct,
  }
}

function lastEntry(bars, openIdx, flag) {
  if (!bars[openIdx][flag]) return { status: "off" }
  const oldest = openIdx - LOOKBACK
  let start = openIdx
  while (start > oldest && bars[start - 1][flag]) start -= 1
  if (start > oldest) return { status: "known", idx: start, daysBefore: openIdx - start }
  if (oldest > 0 && !bars[oldest - 1][flag]) return { status: "known", idx: oldest, daysBefore: LOOKBACK }
  return { status: "before" }
}

function formationOf(bars, openIdx) {
  const on = KEYS.filter((k) => bars[openIdx][k.flag])
  const off = KEYS.filter((k) => !bars[openIdx][k.flag])
  const entries = on.map((k) => ({ id: k.id, ...lastEntry(bars, openIdx, k.flag) }))
  const allKnown = entries.every((e) => e.status === "known")
  const unique = allKnown && new Set(entries.map((e) => e.idx)).size === entries.length
  const ordered = unique ? entries.slice().sort((a, b) => a.idx - b.idx) : null
  const rank = (e) => (e.status === "before" ? -1 : e.status === "known" ? e.idx : null)
  const ranks = entries.map(rank)
  let last = "other"
  if (ranks.every((v) => v != null)) {
    const max = Math.max(...ranks)
    const tops = entries.filter((e, i) => ranks[i] === max && e.status === "known")
    if (tops.length === 1 && max >= 0) last = tops[0].id
  }
  let reason = "ordered"
  if (!unique) {
    if (entries.some((e) => e.status === "before")) reason = entries.some((e) => e.status === "known") ? "partial" : "before_window"
    else reason = "tie"
  }
  return {
    missing: off.length === 1 ? off[0].id : "other",
    order: unique ? ordered.map((e) => e.id).join(">") : "other",
    reason,
    last,
    arrivalsOnDay0: entries.filter((e) => e.status === "known" && e.daysBefore === 0).length,
    daysBefore: Object.fromEntries(entries.map((e) => [e.id, e.status === "known" ? e.daysBefore : null])),
  }
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
  return {
    full: end - entry === HORIZON,
    d20: pctChange(closes[entry + 20], px),
    d60: pctChange(closes[entry + 60], px),
    mae: ((px - minPx) / px) * 100,
    daysToLow: minAt - entry,
    hit5: maxPx >= px * 1.05 - 1e-8,
    hit10: maxPx >= px * 1.1 - 1e-8,
    hitM5: minPx <= px * 0.95 + 1e-8,
    hitM10: minPx <= px * 0.9 + 1e-8,
    hitM15: minPx <= px * 0.85 + 1e-8,
  }
}

function loadCached(yahoo) {
  const cp = path.join(BAR_DIR, `${yahoo.replace(/[^A-Za-z0-9.-]/g, "_")}.json`)
  if (!fs.existsSync(cp)) return null
  const raw = JSON.parse(fs.readFileSync(cp, "utf8"))
  return Array.isArray(raw.bars) ? raw.bars : null
}

function analyzeSymbol(meta, rawBars) {
  if (!rawBars?.length || rawBars.length < MIN_BARS) {
    return { symbol: meta.symbol, status: rawBars?.length ? "insufficient history" : "data unavailable" }
  }
  const bars = attachObservationFeatures(enrichBarsWithIndicators(rawBars))
  const split = timeSplitBars(bars, TRAIN_RATIO)
  const fromIdx = Math.min(WARMUP_IDX, Math.max(0, bars.length - 1))
  const built = buildSplitBuyEpisodes(bars, FROZEN_THRESHOLDS, { fromIdx, toIdx: bars.length }, EPISODE_DEF)
  const episodes = []
  let short = 0
  let openedAt4 = 0
  let mismatch = 0
  for (const ep of built) {
    if (ep.openCount !== 3) {
      if (ep.openCount >= 4) openedAt4 += 1
      continue
    }
    if (ep.openIdx + NEED >= bars.length || ep.openIdx < LOOKBACK) {
      short += 1
      continue
    }
    const bar = bars[ep.openIdx]
    const combo = comboId(bar)
    if (combo === "other" || bar.count !== 3) mismatch += 1
    const closes = []
    for (let i = ep.openIdx; i <= ep.openIdx + HORIZON; i++) closes.push(bars[i].close)
    const formed = formationOf(bars, ep.openIdx)
    episodes.push({
      symbol: meta.symbol,
      split: ep.openIdx < split.splitIdx ? "train" : "test",
      combo,
      missing: formed.missing,
      order: formed.order,
      reason: formed.reason,
      last: combo === "rsi_stoch_bb" ? formed.last : null,
      arrivalsOnDay0: formed.arrivalsOnDay0,
      daysBefore: formed.daysBefore,
      slack: slackOf(bar),
      fwd: forwardFrom(closes, 0),
    })
  }
  return { symbol: meta.symbol, status: "ok", split, built: built.length, short, openedAt4, mismatch, episodes }
}

function hits(list, key) {
  return rate(list.filter((r) => r.fwd?.[key]).length, list.length)
}

function metric(list) {
  const use = list.filter((r) => r.fwd?.full)
  return {
    n: use.length,
    d20: num(use, (r) => r.fwd.d20),
    d60: num(use, (r) => r.fwd.d60),
    mae: num(use, (r) => r.fwd.mae),
    daysToLow: num(use, (r) => r.fwd.daysToLow),
    hitM5Pct: hits(use, "hitM5"),
    hitM10Pct: hits(use, "hitM10"),
    hitM15Pct: hits(use, "hitM15"),
    hit5Pct: hits(use, "hit5"),
    hit10Pct: hits(use, "hit10"),
  }
}

function slackMetric(list) {
  return {
    rsi: num(list, (r) => r.slack.rsi),
    stoch: num(list, (r) => r.slack.stoch),
    bb: num(list, (r) => r.slack.bb),
    ma: num(list, (r) => r.slack.ma),
  }
}

function bySplit(rows, total) {
  const trainRows = rows.filter((r) => r.split === "train")
  const testRows = rows.filter((r) => r.split === "test")
  return {
    n: rows.length,
    trainN: trainRows.length,
    testN: testRows.length,
    insufficient: testRows.length < MIN_TEST,
    sharePct: rate(rows.length, total),
    shareOfTrainPct: rate(trainRows.length, null),
    shareOfTestPct: rate(testRows.length, null),
    all: metric(rows),
    train: metric(trainRows),
    test: metric(testRows),
    slack: {
      all: slackMetric(rows),
      train: slackMetric(trainRows),
      test: slackMetric(testRows),
    },
  }
}

function withShares(block, trainTotal, testTotal) {
  block.shareOfTrainPct = rate(block.trainN, trainTotal)
  block.shareOfTestPct = rate(block.testN, testTotal)
  return block
}

function med(summary) {
  return summary?.median ?? null
}

function view(block) {
  const pick = (side) => ({
    n: block[side].n,
    d20: med(block[side].d20),
    d60: med(block[side].d60),
    mae: med(block[side].mae),
    hitM5Pct: block[side].hitM5Pct,
    hitM10Pct: block[side].hitM10Pct,
    hitM15Pct: block[side].hitM15Pct,
    hit5Pct: block[side].hit5Pct,
    hit10Pct: block[side].hit10Pct,
    daysToLow: med(block[side].daysToLow),
  })
  return {
    n: block.n,
    trainN: block.trainN,
    testN: block.testN,
    insufficient: block.insufficient,
    sharePct: block.sharePct,
    shareOfTrainPct: block.shareOfTrainPct,
    shareOfTestPct: block.shareOfTestPct,
    train: pick("train"),
    test: pick("test"),
  }
}

function lowerRisk(a, b) {
  return a.n >= MIN_TEST && b.n >= MIN_TEST && a.mae.median <= b.mae.median - MAE_PP && a.hitM10Pct <= b.hitM10Pct - TAIL_PP
}

function higherRisk(a, b) {
  return a.n >= MIN_TEST && b.n >= MIN_TEST && a.mae.median > b.mae.median && a.hitM10Pct > b.hitM10Pct
}

function judge(gapRepeats, ma20Consistent) {
  if (!gapRepeats) {
    return { code: "C", label: "RSI+Stoch+BB의 성과 차이는 표본 효과 가능성이 커서 전략 변경 근거가 부족하다." }
  }
  if (ma20Consistent) {
    return { code: "A", label: "RSI+Stoch+BB의 낮은 위험 특성이 Train/Test에서 반복되고, MA20 포함 여부와도 일관된 차이를 보인다." }
  }
  return { code: "B", label: "RSI+Stoch+BB 차이는 존재하지만 조건 완성 순서나 강도에서 일관된 설명이 부족하다." }
}

function assertMath() {
  const blank = () => ({ flagRsi: false, flagStoch: false, flagBb: false, flagMa: false })
  const bars = Array.from({ length: 30 }, blank)
  for (let i = 22; i <= 25; i++) bars[i].flagRsi = true
  for (let i = 24; i <= 25; i++) bars[i].flagStoch = true
  bars[25].flagBb = true
  const formed = formationOf(bars, 25)
  if (formed.order !== "rsi>stoch>bb" || formed.last !== "bb" || formed.missing !== "ma") throw new Error("order")
  const flicker = Array.from({ length: 30 }, blank)
  flicker[10].flagRsi = true
  for (let i = 21; i <= 25; i++) flicker[i].flagRsi = true
  for (let i = 23; i <= 25; i++) flicker[i].flagStoch = true
  for (let i = 25; i <= 25; i++) flicker[i].flagBb = true
  if (formationOf(flicker, 25).daysBefore.rsi !== 4) throw new Error("flicker")
  const stuck = Array.from({ length: 30 }, blank)
  for (let i = 0; i <= 25; i++) stuck[i].flagRsi = true
  stuck[25].flagStoch = true
  stuck[25].flagBb = true
  const early = Array.from({ length: 30 }, blank)
  for (let i = 0; i <= 25; i++) early[i].flagRsi = true
  for (let i = 24; i <= 25; i++) early[i].flagStoch = true
  early[25].flagBb = true
  const earlyFormed = formationOf(early, 25)
  if (earlyFormed.order !== "other" || earlyFormed.last !== "bb" || earlyFormed.reason !== "partial") throw new Error("partial last")
  if (formationOf(stuck, 25).order !== "other" || formationOf(stuck, 25).last !== "other") throw new Error("unknown")
  const edge = Array.from({ length: 30 }, blank)
  for (let i = 5; i <= 25; i++) edge[i].flagRsi = true
  edge[24].flagStoch = true
  edge[25].flagStoch = true
  edge[25].flagBb = true
  if (lastEntry(edge, 25, "flagRsi").daysBefore !== 20) throw new Error("edge")
  const tie = Array.from({ length: 30 }, blank)
  for (let i = 23; i <= 25; i++) {
    tie[i].flagRsi = true
    tie[i].flagStoch = true
  }
  tie[25].flagBb = true
  const tied = formationOf(tie, 25)
  if (tied.order !== "other" || tied.last !== "bb" || tied.reason !== "tie") throw new Error("tie")
  const slack = slackOf({ rsi14: 30, stochK: 10.4, bbPctB: -0.01, ma20DevPct: -6 })
  if (slack.rsi !== 6) throw new Error("rsi slack")
  if (Math.abs(slack.stoch - 5) > 1e-9) throw new Error("stoch slack")
  if (Math.abs(slack.bb - 0.02) > 1e-9) throw new Error("bb slack")
  if (Math.abs(slack.ma - 1.8) > 1e-9) throw new Error("ma slack")
}

function line(id, block) {
  const t = view(block).test
  const tr = view(block).train
  const mark = block.insufficient ? " sample 부족" : ""
  return `${id}: n ${block.n} train ${block.trainN} (${block.shareOfTrainPct}%) test ${block.testN} (${block.shareOfTestPct}%) | Test D+20 ${t.d20} D+60 ${t.d60} MAE ${t.mae} -5 ${t.hitM5Pct} -10 ${t.hitM10Pct} -15 ${t.hitM15Pct} +5 ${t.hit5Pct} +10 ${t.hit10Pct} days ${t.daysToLow} | Train D+20 ${tr.d20} D+60 ${tr.d60} MAE ${tr.mae} -10 ${tr.hitM10Pct} +10 ${tr.hit10Pct} days ${tr.daysToLow}${mark}`
}

function main() {
  assertMath()
  assertNoEtfInStudyUniverse()
  console.log("node scripts/yds-daily-bottom-buy-3of4-order-research.mjs")
  const blocks = []
  for (const meta of EQUITY_CANDIDATES) {
    const row = analyzeSymbol(meta, loadCached(meta.yahoo))
    console.log(`  ${meta.symbol}: ${row.status} episodes=${row.episodes?.length ?? 0}`)
    blocks.push(row)
  }
  const ready = blocks.filter((b) => b.status === "ok")
  const rows = ready.flatMap((b) => b.episodes || [])
  const trainTotal = rows.filter((r) => r.split === "train").length
  const testTotal = rows.filter((r) => r.split === "test").length
  const pack = (list) => withShares(bySplit(list, rows.length), trainTotal, testTotal)
  const byCombo = Object.fromEntries(COMBOS.map((id) => [id, pack(rows.filter((r) => r.combo === id))]))
  const rsb = byCombo.rsi_stoch_bb
  const rest = pack(rows.filter((r) => r.combo !== "rsi_stoch_bb"))
  const maOn = rest
  const orders = {}
  for (const row of rows) orders[row.order] = orders[row.order] || []
  for (const row of rows) orders[row.order].push(row)
  const byOrder = {}
  for (const [id, list] of Object.entries(orders)) {
    byOrder[id] = pack(list)
    byOrder[id].comboCounts = Object.fromEntries(COMBOS.map((combo) => [combo, list.filter((r) => r.combo === combo).length]))
  }
  const rsbRows = rows.filter((r) => r.combo === "rsi_stoch_bb")
  const lastIds = ["rsi", "stoch", "bb", "other"]
  const byLast = Object.fromEntries(lastIds.map((id) => [id, pack(rsbRows.filter((r) => r.last === id))]))
  const gapRepeats = lowerRisk(rsb.test, rest.test) && lowerRisk(rsb.train, rest.train)
  const ma20Parts = ["rsi_stoch_ma", "rsi_bb_ma", "stoch_bb_ma"].map((id) => ({
    id,
    test: higherRisk(byCombo[id].test, rsb.test),
    train: higherRisk(byCombo[id].train, rsb.train),
  }))
  const ma20Consistent = ma20Parts.every((part) => part.test && part.train)
  const distinctLast = lastIds.filter((id) => id !== "other").filter((id) => {
    const others = pack(rsbRows.filter((r) => r.last !== id && r.last !== "other"))
    return lowerRisk(byLast[id].test, others.test) && lowerRisk(byLast[id].train, others.train)
      || (higherRisk(byLast[id].test, others.test) && higherRisk(byLast[id].train, others.train) && byLast[id].testN >= MIN_TEST)
  })
  const rsbOrders = Object.entries(byOrder).filter(([id]) => id !== "other" && byOrder[id].comboCounts.rsi_stoch_bb >= MIN_TEST)
  const arrivals = { all: {}, train: {}, test: {}, rsbTest: {}, rsbTrain: {} }
  for (const row of rows) {
    const key = String(row.arrivalsOnDay0)
    arrivals.all[key] = (arrivals.all[key] || 0) + 1
    arrivals[row.split][key] = (arrivals[row.split][key] || 0) + 1
    if (row.combo === "rsi_stoch_bb") arrivals[row.split === "test" ? "rsbTest" : "rsbTrain"][key] = (arrivals[row.split === "test" ? "rsbTest" : "rsbTrain"][key] || 0) + 1
  }
  const reasonCounts = { all: {}, train: {}, test: {}, rsb: {} }
  for (const row of rows) {
    reasonCounts.all[row.reason] = (reasonCounts.all[row.reason] || 0) + 1
    reasonCounts[row.split][row.reason] = (reasonCounts[row.split][row.reason] || 0) + 1
    if (row.combo === "rsi_stoch_bb") reasonCounts.rsb[row.reason] = (reasonCounts.rsb[row.reason] || 0) + 1
  }
  const slackOn = (list, key) => num(list.filter((r) => r.daysBefore[key] != null || r.combo.split("_").includes(key) || true).filter((r) => {
    const on = r.combo.split("_")
    return on.includes(key)
  }), (r) => r.slack[key])
  const depth = {}
  for (const key of ["rsi", "stoch", "bb"]) {
    const rsbOn = rsbRows
    const otherOn = rows.filter((r) => r.combo !== "rsi_stoch_bb" && r.combo.split("_").includes(key))
    depth[key] = {
      rsb: { train: slackOn(rsbOn.filter((r) => r.split === "train"), key), test: slackOn(rsbOn.filter((r) => r.split === "test"), key) },
      otherOn: { train: slackOn(otherOn.filter((r) => r.split === "train"), key), test: slackOn(otherOn.filter((r) => r.split === "test"), key) },
    }
    depth[key].deeperBoth = depth[key].rsb.train.median > depth[key].otherOn.train.median && depth[key].rsb.test.median > depth[key].otherOn.test.median
  }
  const verdict = judge(gapRepeats, ma20Consistent)
  const doc = {
    generatedAt: new Date().toISOString(),
    definition: {
      universe: "Existing 48 single names. ETF names are not included.",
      thresholds: FROZEN_THRESHOLDS,
      episodeDef: EPISODE_DEF,
      exactly3: "Day 0 is the episode open only when that open has exactly 3 of the 4 frozen conditions.",
      missing: "The unmet condition on Day 0. RSI unmet is Stoch+BB+MA20. Stoch unmet is RSI+BB+MA20. BB unmet is RSI+Stoch+MA20. MA20 unmet is RSI+Stoch+BB.",
      order: "For each condition that is on at Day 0, the entry is the start of the uninterrupted true run that ends on Day 0. An earlier true run that later turned false is ignored. A full order is recorded only when all three entry dates fall inside the prior 20 sessions and are different days. Otherwise the order is 기타/불명. The last condition can still be named when exactly one condition enters inside that window and the others were already true across the whole window, because those others entered earlier. Two conditions entering on the same day, or all three already true across the window, stay 기타/불명.",
      slack: "Threshold minus the Day 0 value. Positive means the reading is deeper than the frozen threshold. No new cutoff is applied.",
      comparison: "RSI+Stoch+BB and the other exact-3 episodes are separate groups. They are not paired on the same episode.",
      mae: "Worst later close within 60 sessions, in percent of the Day 0 close. Same close-only window as the prior 3/4 quality study.",
      riskBar: `A lower-risk gap requires MAE at least ${MAE_PP} point lower and the additional -10% rate at least ${TAIL_PP} points lower, with n at least ${MIN_TEST} on that side. Cells with Test n under ${MIN_TEST} are reference only.`,
      notASignal: "No result is a production filter.",
    },
    coverage: {
      symbols: EQUITY_CANDIDATES.length,
      withData: ready.length,
      episodesBuilt: ready.reduce((s, b) => s + b.built, 0),
      openedAt4Excluded: ready.reduce((s, b) => s + b.openedAt4, 0),
      shortHorizonExcluded: ready.reduce((s, b) => s + b.short, 0),
      flagMismatch: ready.reduce((s, b) => s + b.mismatch, 0),
      sample: rows.length,
      train: trainTotal,
      test: testTotal,
    },
    byCombo,
    rsbVsRest: { rsb, rest, independentGroups: true },
    ma20Included: { withoutMa: rsb, withMa: maOn, parts: ma20Parts },
    byOrder,
    reasonCounts,
    arrivals,
    byLastWithinRsb: byLast,
    depth,
    distinctLast,
    rsbOrdersNoted: rsbOrders.map(([id]) => id),
    conclusion: verdict,
    checks: {
      gapRepeats,
      ma20Consistent,
      ma20Parts,
      deeper: Object.fromEntries(Object.entries(depth).map(([key, row]) => [key, row.deeperBoth])),
      distinctLast,
    },
  }
  doc.interpretation = interpret(doc)
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc))
  if (doc.coverage.sample !== 1447 || doc.coverage.train !== 1001 || doc.coverage.test !== 446) {
    throw new Error(`sample ${doc.coverage.sample} train ${doc.coverage.train} test ${doc.coverage.test}`)
  }
  console.log(`wrote ${OUT_JSON}`)
  console.log(doc.interpretation.join("\n"))
  console.log(`${doc.conclusion.code}. ${doc.conclusion.label}`)
  console.log("production 변경 없음")
}

function interpret(doc) {
  const lines = []
  lines.push(`n ${doc.coverage.sample} train ${doc.coverage.train} test ${doc.coverage.test}`)
  for (const id of COMBOS) lines.push(line(id, doc.byCombo[id]))
  lines.push(line("rest", doc.rsbVsRest.rest))
  for (const [id, block] of Object.entries(doc.byLastWithinRsb)) lines.push(line(`last:${id}`, block))
  lines.push(`order reasons all ${JSON.stringify(doc.reasonCounts.all)} rsb ${JSON.stringify(doc.reasonCounts.rsb)} arrivals ${JSON.stringify(doc.arrivals)}`)
  const usableOrders = Object.entries(doc.byOrder).filter(([, block]) => block.n >= MIN_TEST)
  for (const [id, block] of usableOrders) lines.push(line(`order:${id}`, block))
  const depthBits = Object.entries(doc.depth).map(([key, row]) => {
    return `${key} RSB train ${row.rsb.train.median} test ${row.rsb.test.median} / other-on train ${row.otherOn.train.median} test ${row.otherOn.test.median} deeperBoth ${row.deeperBoth}`
  })
  lines.push(depthBits.join(" | "))
  lines.push(`gapRepeats ${doc.checks.gapRepeats} ma20Consistent ${doc.checks.ma20Consistent} distinctLast ${doc.checks.distinctLast.join(",") || "none"}`)
  return lines
}

main()
