#!/usr/bin/env node
/**
 * Quality of an exact 3-of-4 open: which three conditions, and the prior decline.
 *   node scripts/yds-daily-bottom-buy-3of4-quality-research.mjs
 *
 * Does not change production code, UI, API, DB, thresholds, or strategy.
 * Bins are fixed in advance. No threshold search.
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
import { drawdownFromRollingHigh } from "./lib/daily-bottom-buy-correction-stage-validation.mjs"
import { DEPTH_WINDOW } from "./lib/daily-bottom-buy-individual-stock-train-test-validation.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const BAR_DIR = path.join(ROOT, "scripts", ".cache", "eq-ohlcv")
const OUT_JSON = path.join(ROOT, "scripts", ".cache", "yds-daily-bottom-buy-3of4-quality-result.json")

const HORIZON = 60
const NEED = 120
const MIN_TEST = 20
const MAE_PP = JUDGE_GATES.maeImprovePp
const TAIL_PP = JUDGE_GATES.tailWorsenPp
const COMBOS = ["rsi_stoch_bb", "rsi_stoch_ma", "rsi_bb_ma", "stoch_bb_ma"]
const SPEEDS = ["gt0", "m0_5", "m5_10", "le10"]

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
  const on = []
  if (bar.flagRsi) on.push("rsi")
  if (bar.flagStoch) on.push("stoch")
  if (bar.flagBb) on.push("bb")
  if (bar.flagMa) on.push("ma")
  return on.length === 3 ? on.join("_") : "other"
}

function speedBucket(ret5) {
  if (ret5 == null || !Number.isFinite(ret5)) return null
  if (ret5 > 0) return "gt0"
  if (ret5 > -5) return "m0_5"
  if (ret5 > -10) return "m5_10"
  return "le10"
}

function priorReturn(closes, i, n) {
  if (i < n || !(closes[i - n] > 0)) return null
  return ((closes[i] - closes[i - n]) / closes[i - n]) * 100
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
  const closesAll = bars.map((b) => b.close)
  for (const ep of built) {
    if (ep.openCount !== 3) {
      if (ep.openCount >= 4) openedAt4 += 1
      continue
    }
    if (ep.openIdx + NEED >= bars.length || ep.openIdx < 20) {
      short += 1
      continue
    }
    const bar = bars[ep.openIdx]
    const combo = comboId(bar)
    if (combo === "other" || bar.count !== 3) mismatch += 1
    const closes = []
    for (let i = ep.openIdx; i <= ep.openIdx + HORIZON; i++) closes.push(bars[i].close)
    const fwd = forwardFrom(closes, 0)
    const ret5 = bar.ret5
    const ret3 = bar.ret3
    const ret10 = priorReturn(closesAll, ep.openIdx, 10)
    const ret20 = priorReturn(closesAll, ep.openIdx, 20)
    const dd = drawdownFromRollingHigh(bars, ep.openIdx, DEPTH_WINDOW)
    episodes.push({
      symbol: meta.symbol,
      split: ep.openIdx < split.splitIdx ? "train" : "test",
      combo,
      ret3,
      ret5,
      ret10: round2(ret10),
      ret20: round2(ret20),
      speed5: ret5 == null ? null : ret5 / 5,
      speedBucket: speedBucket(ret5),
      mild: ret5 != null && ret5 > -5,
      crash: ret5 != null && ret5 <= -10,
      dd: round2(dd),
      deep: dd != null && dd <= -15,
      shallow: dd != null && dd > -15,
      fwd,
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
    insufficient: use.filter((r) => r.split === "test").length < MIN_TEST && list.some((r) => r.split === "test") ? use.filter((r) => r.split === "test").length < MIN_TEST : false,
    d20: num(use, (r) => r.fwd.d20),
    d60: num(use, (r) => r.fwd.d60),
    mae: num(use, (r) => r.fwd.mae),
    daysToLow: num(use, (r) => r.fwd.daysToLow),
    hitM5Pct: hits(use, "hitM5"),
    hitM10Pct: hits(use, "hitM10"),
    hitM15Pct: hits(use, "hitM15"),
    hit5Pct: hits(use, "hit5"),
    hit10Pct: hits(use, "hit10"),
    ret5: num(use, (r) => r.ret5),
    speed5: num(use, (r) => r.speed5),
  }
}

function bySplit(rows) {
  const testN = rows.filter((r) => r.split === "test").length
  return {
    n: rows.length,
    trainN: rows.filter((r) => r.split === "train").length,
    testN,
    insufficient: testN < MIN_TEST,
    all: metric(rows),
    train: metric(rows.filter((r) => r.split === "train")),
    test: metric(rows.filter((r) => r.split === "test")),
  }
}

function cellView(block) {
  const t = block.test
  return {
    n: block.n,
    trainN: block.trainN,
    testN: block.testN,
    insufficient: block.insufficient,
    sharePct: block.sharePct ?? null,
    test: {
      d20: t.d20?.median ?? null,
      d60: t.d60?.median ?? null,
      mae: t.mae?.median ?? null,
      hitM10Pct: t.hitM10Pct,
      hit10Pct: t.hit10Pct,
      daysToLow: t.daysToLow?.median ?? null,
    },
    train: {
      d20: block.train.d20?.median ?? null,
      d60: block.train.d60?.median ?? null,
      mae: block.train.mae?.median ?? null,
      hitM10Pct: block.train.hitM10Pct,
      hit10Pct: block.train.hit10Pct,
      daysToLow: block.train.daysToLow?.median ?? null,
    },
  }
}

function elevated(block, base) {
  if (block.testN < MIN_TEST) return { test: false, trainAgrees: false, skipped: true }
  const testMae = block.test.mae?.median
  const testM10 = block.test.hitM10Pct
  const baseMae = base.test.mae?.median
  const baseM10 = base.test.hitM10Pct
  const test = testMae >= baseMae + MAE_PP && testM10 >= baseM10 + TAIL_PP
  const trainReady = block.trainN >= MIN_TEST
  const train = trainReady && block.train.mae?.median > base.train.mae?.median && block.train.hitM10Pct > base.train.hitM10Pct
  return { test, trainAgrees: test && train, trainOpposite: test && trainReady && !train }
}

function judge(flags) {
  const confirmed = flags.filter((row) => row.trainAgrees)
  const testOnly = flags.filter((row) => row.test && row.trainOpposite)
  if (confirmed.length) {
    return { code: "A", cells: confirmed.map((row) => row.id), label: "3/4 조건 조합 또는 직전 하락속도에서 Test에서도 반복되는 품질 차이가 확인된다." }
  }
  if (testOnly.length) {
    return { code: "B", cells: testOnly.map((row) => row.id), label: "위험한 패턴은 보이지만 Train/Test 일관성이 부족하다." }
  }
  return { code: "C", cells: [], label: "3/4 내부의 조합/하락속도 차이가 충분히 크지 않아 후보 필터로 사용할 근거가 부족하다." }
}

function assertMath() {
  if (speedBucket(1) !== "gt0") throw new Error("gt0")
  if (speedBucket(0) !== "m0_5") throw new Error("zero")
  if (speedBucket(-4.9) !== "m0_5") throw new Error("mild")
  if (speedBucket(-5) !== "m5_10") throw new Error("minus5")
  if (speedBucket(-10) !== "le10") throw new Error("minus10")
  if (speedBucket(-9.9) !== "m5_10") throw new Error("mid")
  const bar = { flagRsi: true, flagStoch: true, flagBb: true, flagMa: false }
  if (comboId(bar) !== "rsi_stoch_bb") throw new Error("combo")
  if (Math.abs(-10 / 5 - -2) > 1e-9) throw new Error("speed")
}

function main() {
  assertMath()
  assertNoEtfInStudyUniverse()
  console.log("node scripts/yds-daily-bottom-buy-3of4-quality-research.mjs")
  const blocks = []
  for (const meta of EQUITY_CANDIDATES) {
    const row = analyzeSymbol(meta, loadCached(meta.yahoo))
    console.log(`  ${meta.symbol}: ${row.status} episodes=${row.episodes?.length ?? 0}`)
    blocks.push(row)
  }
  const ready = blocks.filter((b) => b.status === "ok")
  const rows = ready.flatMap((b) => b.episodes || [])
  const base = bySplit(rows)
  base.sharePct = 100
  const combos = {}
  for (const id of COMBOS) {
    const subset = rows.filter((r) => r.combo === id)
    combos[id] = bySplit(subset)
    combos[id].sharePct = rate(subset.length, rows.length)
  }
  const speeds = {}
  for (const id of SPEEDS) {
    const subset = rows.filter((r) => r.speedBucket === id)
    speeds[id] = bySplit(subset)
    speeds[id].sharePct = rate(subset.length, rows.length)
  }
  const mild = bySplit(rows.filter((r) => r.mild))
  const crash = bySplit(rows.filter((r) => r.crash))
  mild.sharePct = rate(mild.n, rows.length)
  crash.sharePct = rate(crash.n, rows.length)
  const cross = {}
  for (const combo of COMBOS) {
    cross[combo] = {}
    for (const speed of SPEEDS) {
      const subset = rows.filter((r) => r.combo === combo && r.speedBucket === speed)
      cross[combo][speed] = bySplit(subset)
      cross[combo][speed].sharePct = rate(subset.length, rows.length)
    }
  }
  const ddSpeed = {
    shallowMild: bySplit(rows.filter((r) => r.shallow && r.mild)),
    shallowCrash: bySplit(rows.filter((r) => r.shallow && r.crash)),
    deepMild: bySplit(rows.filter((r) => r.deep && r.mild)),
    deepCrash: bySplit(rows.filter((r) => r.deep && r.crash)),
  }
  for (const [id, block] of Object.entries(ddSpeed)) block.sharePct = rate(block.n, rows.length)
  const watch = []
  const push = (id, block) => {
    const flag = elevated(block, base)
    watch.push({ id, ...flag, testN: block.testN, trainN: block.trainN })
  }
  for (const id of COMBOS) push(`combo:${id}`, combos[id])
  for (const id of SPEEDS) push(`speed:${id}`, speeds[id])
  push("crash", crash)
  push("mild", mild)
  for (const id of Object.keys(ddSpeed)) push(`dd:${id}`, ddSpeed[id])
  for (const combo of COMBOS) {
    for (const speed of SPEEDS) push(`cross:${combo}:${speed}`, cross[combo][speed])
  }
  const verdict = judge(watch)
  const doc = {
    generatedAt: new Date().toISOString(),
    definition: {
      universe: "Existing 48 single names. ETF names are not included.",
      thresholds: FROZEN_THRESHOLDS,
      episodeDef: EPISODE_DEF,
      exactly3: "Day 0 is the episode open only when that open has exactly 3 of the 4 frozen conditions.",
      priorReturn: "ret3 and ret5 are the stored close-to-close changes into Day 0. ret10 and ret20 use the same formula on earlier closes. Nothing after Day 0 is used.",
      speed5: "ret5 divided by 5, in percent per session.",
      buckets: "5-day return: >0, <=0 and >-5, <=-5 and >-10, <=-10. These edges were fixed before the run.",
      mildCrash: "Mild is a 5-day return above -5%. Crash is a 5-day return of -10% or lower. The band between them is not part of that pair.",
      depth: "Close versus the highest high of the 120 sessions ending on Day 0. Shallow is above -15%. Deep is -15% or lower.",
      mae: "Worst later close within 60 sessions, in percent of the Day 0 close.",
      riskBar: `A cell is a risk candidate on Test only when Test n is at least ${MIN_TEST}, Test MAE median is at least ${MAE_PP} point above all 3/4, and the additional -10% rate is at least ${TAIL_PP} points above all 3/4. Train must also be higher on both metrics for the pattern to count as repeated. A lower D+60 alone is not a risk mark.`,
      notASignal: "No cell is a production filter.",
    },
    coverage: {
      symbols: EQUITY_CANDIDATES.length,
      withData: ready.length,
      episodesBuilt: ready.reduce((s, b) => s + b.built, 0),
      openedAt4Excluded: ready.reduce((s, b) => s + b.openedAt4, 0),
      shortHorizonExcluded: ready.reduce((s, b) => s + b.short, 0),
      flagMismatch: ready.reduce((s, b) => s + b.mismatch, 0),
      sample: rows.length,
      train: rows.filter((r) => r.split === "train").length,
      test: rows.filter((r) => r.split === "test").length,
      dataStart: ready.map((b) => b.split?.dataStart).filter(Boolean).sort()[0] ?? null,
      dataEnd: ready.map((b) => b.split?.dataEnd).filter(Boolean).sort().at(-1) ?? null,
    },
    overall: base,
    tableA: combos,
    tableB: speeds,
    mildCrash: { mild, crash },
    tableC: ddSpeed,
    tableD: cross,
    priorSummary: {
      ret3: {
        all: num(rows, (r) => r.ret3),
        train: num(rows.filter((r) => r.split === "train"), (r) => r.ret3),
        test: num(rows.filter((r) => r.split === "test"), (r) => r.ret3),
      },
      ret5: {
        all: num(rows, (r) => r.ret5),
        train: num(rows.filter((r) => r.split === "train"), (r) => r.ret5),
        test: num(rows.filter((r) => r.split === "test"), (r) => r.ret5),
      },
      ret10: {
        all: num(rows, (r) => r.ret10),
        test: num(rows.filter((r) => r.split === "test"), (r) => r.ret10),
      },
      ret20: {
        all: num(rows, (r) => r.ret20),
        test: num(rows.filter((r) => r.split === "test"), (r) => r.ret20),
      },
      speed5: {
        all: num(rows, (r) => r.speed5),
        test: num(rows.filter((r) => r.split === "test"), (r) => r.speed5),
      },
    },
    riskFlags: watch,
    conclusion: verdict,
    views: {
      overall: cellView(base),
      combos: Object.fromEntries(COMBOS.map((id) => [id, cellView(combos[id])])),
      speeds: Object.fromEntries(SPEEDS.map((id) => [id, cellView(speeds[id])])),
      mild: cellView(mild),
      crash: cellView(crash),
      ddSpeed: Object.fromEntries(Object.entries(ddSpeed).map(([id, block]) => [id, cellView(block)])),
    },
    interpretation: [],
  }
  doc.interpretation = interpret(doc)
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc))
  console.log(`wrote ${OUT_JSON}`)
  console.log(`n ${doc.coverage.sample} train ${doc.coverage.train} test ${doc.coverage.test}`)
  console.log(doc.conclusion.code)
  console.log(doc.conclusion.label)
  console.log(doc.interpretation.join("\n"))
  console.log("production 변경 없음")
}

function line(id, view) {
  const t = view.test
  const mark = view.insufficient ? " sample 부족" : ""
  return `${id}: n ${view.n} train ${view.trainN} test ${view.testN} share ${view.sharePct} | Test D+20 ${t.d20} D+60 ${t.d60} MAE ${t.mae} -10% ${t.hitM10Pct} +10% ${t.hit10Pct} days ${t.daysToLow}${mark}`
}

function interpret(doc) {
  const lines = []
  lines.push(line("all", doc.views.overall))
  for (const [id, view] of Object.entries(doc.views.combos)) lines.push(line(id, view))
  for (const [id, view] of Object.entries(doc.views.speeds)) lines.push(line(id, view))
  lines.push(line("mild", doc.views.mild))
  lines.push(line("crash", doc.views.crash))
  for (const [id, view] of Object.entries(doc.views.ddSpeed)) lines.push(line(id, view))
  const risks = doc.riskFlags.filter((row) => row.test)
  lines.push(`Test 위험 표시: ${risks.map((row) => row.id).join(", ") || "없음"}. 그중 Train도 같은 방향: ${risks.filter((row) => row.trainAgrees).map((row) => row.id).join(", ") || "없음"}.`)
  lines.push(`${doc.conclusion.code}. ${doc.conclusion.label}`)
  return lines
}

main()
