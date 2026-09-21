#!/usr/bin/env node
/**
 * YDS Daily Bottom Buy — Train/Test temporal validation (research only).
 *
 * Purpose: check whether V1 exploratory ceilings are in-sample overfit.
 * Train (~70%) proposes thresholds; Test (~30%) evaluates WITHOUT retuning.
 *
 *   node scripts/yds-daily-bottom-buy-train-test-study.mjs
 *   node scripts/yds-daily-bottom-buy-train-test-study.mjs --force-fetch
 *
 * Does NOT touch Panic Index / product UI / Daily Bottom Buy UI body.
 * Writes:
 *   scripts/.cache/yds-daily-bottom-buy-train-test-result.json
 *   docs/YDS_DAILY_BOTTOM_BUY_TRAIN_TEST.md
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  DAILY_BOTTOM_BUY_ETFS,
  DIP_DEF,
  TRAIN_RATIO,
  V1_REFERENCE_BANDS,
  analyzeEtfTrainTest,
  findDailyBottomEvents,
  freezeThresholdsFromTrainTroughs,
  partitionEventsBySplit,
  summarizeNumeric,
  timeSplitBars,
} from "./lib/daily-bottom-buy-validation-core.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const OUT_JSON = path.join(CACHE, "yds-daily-bottom-buy-train-test-result.json")
const OUT_MD = path.join(ROOT, "docs", "YDS_DAILY_BOTTOM_BUY_TRAIN_TEST.md")
const START = "2016-01-01"

const args = new Set(process.argv.slice(2))
const forceFetch = args.has("--force-fetch")

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
}

function ensureCacheDir() {
  fs.mkdirSync(CACHE, { recursive: true })
}

function cachePath(symbol) {
  return path.join(CACHE, `dbb-${symbol.toLowerCase()}-daily-ohlcv.json`)
}

async function fetchYahooOhlcv(symbol, start = START) {
  const period1 = Math.floor(new Date(`${start}T00:00:00Z`).getTime() / 1000)
  const period2 = Math.floor(Date.now() / 1000)
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${period1}&period2=${period2}&interval=1d&events=history`
  const res = await fetch(url, { headers: YAHOO_HEADERS })
  if (!res.ok) throw new Error(`Yahoo ${symbol} HTTP ${res.status}`)
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  const ts = result?.timestamp ?? []
  const q = result?.indicators?.quote?.[0] ?? {}
  const { open, high, low, close, volume } = q
  const bars = []
  for (let i = 0; i < ts.length; i++) {
    const c = close?.[i]
    if (c == null || !Number.isFinite(c) || c <= 0) continue
    const o = Number.isFinite(open?.[i]) ? open[i] : c
    const h = Number.isFinite(high?.[i]) ? high[i] : Math.max(o, c)
    const l = Number.isFinite(low?.[i]) ? low[i] : Math.min(o, c)
    bars.push({
      date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      open: o,
      high: Math.max(h, o, c),
      low: Math.min(l, o, c),
      close: c,
      volume: Number.isFinite(volume?.[i]) ? volume[i] : 0,
    })
  }
  return bars
}

async function loadBars(symbol) {
  ensureCacheDir()
  const cp = cachePath(symbol)
  const fresh =
    fs.existsSync(cp) &&
    Date.now() - fs.statSync(cp).mtimeMs < 86400_000 &&
    !forceFetch
  if (fresh) {
    return JSON.parse(fs.readFileSync(cp, "utf8")).bars
  }
  console.log(`Fetching ${symbol}…`)
  const bars = await fetchYahooOhlcv(symbol)
  fs.writeFileSync(
    cp,
    JSON.stringify({
      symbol,
      source: "Yahoo Finance chart API v8",
      requestedStart: START,
      fetchedAt: new Date().toISOString(),
      count: bars.length,
      first: bars[0]?.date ?? null,
      last: bars[bars.length - 1]?.date ?? null,
      bars,
    }),
    "utf8",
  )
  return bars
}

function fmt(v, digits = 1) {
  if (v == null || !Number.isFinite(v)) return "—"
  return Number(v).toFixed(digits)
}

function poolSeg(etfResults, segment, pathKeys) {
  const out = {}
  for (const pathKey of pathKeys) {
    const parts = pathKey.split(".")
    const outKey = parts[parts.length - 1]
    const chunks = []
    for (const e of etfResults) {
      let node = e[segment]
      for (const p of parts) node = node?.[p]
      if (node && typeof node.n === "number") chunks.push(node)
    }
    const n = chunks.reduce((s, c) => s + (c.n || 0), 0)
    const wavg = (getter) => {
      let num = 0
      let den = 0
      for (const c of chunks) {
        const v = getter(c)
        if (v != null && Number.isFinite(v) && c.n) {
          num += v * c.n
          den += c.n
        }
      }
      return den ? Math.round((num / den) * 100) / 100 : null
    }
    const spy = (() => {
      let num = 0
      let den = 0
      for (const e of etfResults) {
        let node = e[segment]
        for (const p of parts) node = node?.[p]
        const td = e[segment]?.tradingDays
        if (node?.n != null && td > 0) {
          num += node.n
          den += td
        }
      }
      return den ? Math.round((num / den) * 252 * 100) / 100 : null
    })()
    out[outKey] = {
      n,
      signalsPerYear: spy,
      nearTroughPct: wavg((c) => c.nearTroughPct),
      deeperDropPct5: wavg((c) => c.deeperDropPct5),
      d5: wavg((c) => c.forward?.d5?.median),
      d10: wavg((c) => c.forward?.d10?.median),
      d20: wavg((c) => c.forward?.d20?.median),
      mae20: wavg((c) => c.forward?.mae20?.median),
    }
  }
  return out
}

function metricRow(m) {
  if (!m) return "n=— near=— d5=— d10=— d20=— MAE≥5%=— freq=—"
  return `n=${m.n} near=${fmt(m.nearTroughPct)}% d5=${fmt(m.d5)}% d10=${fmt(m.d10)}% d20=${fmt(m.d20)}% MAE≥5%=${fmt(m.deeperDropPct5)}% ~${fmt(m.signalsPerYear)}/yr`
}

function buildAbcProposal(trainPooled, testPooled, frozenTh) {
  const t3 = testPooled.ge3
  const t4 = testPooled.eq4
  const t2 = testPooled.ge2

  const ge3OkEnough =
    t3 &&
    t3.n >= 30 &&
    (t3.nearTroughPct ?? 0) >= 30 &&
    (t3.d20 ?? -99) > 0 &&
    (t3.signalsPerYear ?? 0) >= 2

  const eq4TooRare = t4 && (t4.signalsPerYear ?? 0) < 1.5
  const eq4StillUseful =
    t4 &&
    t4.n >= 15 &&
    (t4.d20 ?? -99) >= (t3?.d20 ?? 0) - 0.5 &&
    (t4.nearTroughPct ?? 0) >= (t3?.nearTroughPct ?? 0) - 5

  const lines = []
  lines.push("### A. 관심 후보 (watch)")
  lines.push(
    `- **초안:** 조건 **2개 이상** 동시 충족 (탐색 천장: RSI≤${frozenTh.rsiMax}, Stoch%K≤${frozenTh.stochKMax}, BB%B≤${frozenTh.bbPctBMax}, MA20dev≤${frozenTh.ma20DevMax}%)`,
  )
  lines.push(
    `- Test: ${metricRow(t2)} — 빈도 확보용. 단독 지표보다 낫지만 저점 적중은 제한적.`,
  )
  lines.push("")
  lines.push("### B. 1차 매수 후보")
  lines.push(`- **초안:** 조건 **3개 이상** 동시 충족`)
  lines.push(
    `- Test: ${metricRow(t3)} — ${ge3OkEnough ? "일상 저점 *검토* 후보로 Test에서도 동작 흔적이 있음 (바닥 예측 아님)." : "Test에서 약하거나 표본이 부족 — 제품 규칙으로 확정하지 말 것."}`,
  )
  lines.push("")
  lines.push("### C. 강한 일상 저점 후보")
  lines.push(`- **초안:** 조건 **4개 모두** 충족`)
  lines.push(
    `- Test: ${metricRow(t4)} — ${eq4TooRare ? "빈도가 낮아 실용성이 떨어질 수 있음." : "빈도 관점에서 검토 가능."} ${eq4StillUseful ? "성과/적중은 3+ 대비 비슷하거나 소폭 우위." : "3+ 대비 뚜렷한 우위가 Test에서 불명확."}`,
  )
  lines.push("")
  lines.push("**비중/분할매수 스케줄은 이번 단계에서 정하지 않는다.**")
  lines.push(
    `Train 참고 — 2+: ${metricRow(trainPooled.ge2)}; 3+: ${metricRow(trainPooled.ge3)}; 4: ${metricRow(trainPooled.eq4)}`,
  )
  return {
    markdown: lines.join("\n"),
    summary: {
      A: "2+ conditions",
      B: "3+ conditions",
      C: "4 conditions",
      ge3OkEnough,
      eq4TooRare,
      eq4StillUseful,
    },
  }
}

function buildConclusions(doc) {
  const th = doc.frozenThresholds
  const tr = doc.pooled.train
  const te = doc.pooled.test
  const abc = buildAbcProposal(tr, te, th)

  const hard = []
  for (const e of doc.etfs) {
    const c = e.test.combo.ge3
    const reasons = []
    if ((c.n ?? 0) < 5) reasons.push(`few test 3+ (n=${c.n})`)
    if ((c.nearTroughPct ?? 100) < 30) reasons.push(`near ${fmt(c.nearTroughPct)}%`)
    if ((c.forward?.d20?.median ?? 0) < 1) reasons.push(`d20 med ${fmt(c.forward?.d20?.median)}%`)
    if ((c.deeperDropPct5 ?? 0) > 45) reasons.push(`MAE≥5% ${fmt(c.deeperDropPct5)}%`)
    if (reasons.length) hard.push(`- **${e.symbol}**: ${reasons.join("; ")}`)
  }

  const decayNotes = []
  for (const key of ["rsi", "stoch", "bb", "ma20", "ge2", "ge3", "eq4"]) {
    const a = tr[key]
    const b = te[key]
    if (!a || !b || !a.n || !b.n) continue
    const nearDrop = (a.nearTroughPct ?? 0) - (b.nearTroughPct ?? 0)
    const d20Drop = (a.d20 ?? 0) - (b.d20 ?? 0)
    if (nearDrop >= 10 || d20Drop >= 2) {
      decayNotes.push(
        `- **${key}**: Train near ${fmt(a.nearTroughPct)}% / d20 ${fmt(a.d20)}% → Test near ${fmt(b.nearTroughPct)}% / d20 ${fmt(b.d20)}%`,
      )
    }
  }

  return {
    abc,
    hardEtfs: hard.length ? hard.join("\n") : "- 특정 ETF만 두드러지게 나쁘다는 신호는 제한적. 개별 표 확인.",
    decayNotes: decayNotes.length
      ? decayNotes.join("\n")
      : "- Train→Test 급격한 붕괴(near -10pp 또는 d20 -2pp)는 pooled 기준으로 두드러지지 않음.",
    minimalProductRules: [
      "임계값 숫자 자체는 아직 제품 확정 금지. Train 동결값과 V1 참조 밴드 범위만 유지.",
      "관심=2+, 1차 검토=3+, 강한 후보=4 — 매수 비중 미정.",
      "신호는 분할매수 *검토 구간*이지 바닥 확정이 아님. MAE≥5%가 Test에서도 상당수.",
      "URA/BOTZ 등 변동성 테마는 공통 규칙 적용 시 별도 주의 라벨 후보.",
      "Panic Index와 결합하지 않음.",
    ].join("\n"),
  }
}

function buildMarkdown(doc) {
  const L = []
  L.push("# YDS Daily Bottom Buy — Train/Test Validation")
  L.push("")
  L.push(`Generated: ${doc.generatedAt}`)
  L.push("")
  L.push(
    "> Research only. Thresholds frozen from Train; Test never retuned. Not financial advice. Panic untouched.",
  )
  L.push("")
  L.push("## Method")
  L.push("")
  L.push(`- Split: chronological **${Math.round(TRAIN_RATIO * 100)}% Train / ${Math.round((1 - TRAIN_RATIO) * 100)}% Test** (no shuffle)`)
  L.push(`- Dip definition: ${DIP_DEF.description}`)
  L.push("- Train troughs must finish rebound confirmation before split (no leakage)")
  L.push("- Frozen ceilings = median of Train trough indicators (pooled across 10 ETFs)")
  L.push("- V1 reference bands (not locked): " + JSON.stringify(V1_REFERENCE_BANDS))
  L.push("")
  L.push("## Frozen thresholds (Train only)")
  L.push("")
  L.push(`| Indicator | Frozen ceiling | V1 ref band |`)
  L.push(`|-----------|----------------|-------------|`)
  L.push(
    `| RSI | ≤ ${doc.frozenThresholds.rsiMax} | ${V1_REFERENCE_BANDS.rsi.lo}–${V1_REFERENCE_BANDS.rsi.hi} |`,
  )
  L.push(
    `| Stoch %K | ≤ ${doc.frozenThresholds.stochKMax} | ${V1_REFERENCE_BANDS.stochK.lo}–${V1_REFERENCE_BANDS.stochK.hi} |`,
  )
  L.push(
    `| BB %B | ≤ ${doc.frozenThresholds.bbPctBMax} | ${V1_REFERENCE_BANDS.bbPctB.lo}–${V1_REFERENCE_BANDS.bbPctB.hi} |`,
  )
  L.push(
    `| MA20 dev % | ≤ ${doc.frozenThresholds.ma20DevMax} | ${V1_REFERENCE_BANDS.ma20DevPct.lo}–${V1_REFERENCE_BANDS.ma20DevPct.hi} |`,
  )
  L.push("")
  L.push(`Source: ${doc.frozenThresholds.source}`)
  L.push("")
  L.push("## Train pooled trough distribution")
  L.push("")
  const p = doc.trainTroughDist
  L.push(`- RSI p25/med/p75: ${fmt(p.rsi14.p25)} / ${fmt(p.rsi14.median)} / ${fmt(p.rsi14.p75)} (n=${p.rsi14.n})`)
  L.push(`- Stoch p25/med/p75: ${fmt(p.stochK.p25)} / ${fmt(p.stochK.median)} / ${fmt(p.stochK.p75)}`)
  L.push(`- BB%B p25/med/p75: ${fmt(p.bbPctB.p25, 2)} / ${fmt(p.bbPctB.median, 2)} / ${fmt(p.bbPctB.p75, 2)}`)
  L.push(`- MA20dev p25/med/p75: ${fmt(p.ma20DevPct.p25)} / ${fmt(p.ma20DevPct.median)} / ${fmt(p.ma20DevPct.p75)}`)
  L.push("")
  L.push("## 1. Train results (pooled)")
  L.push("")
  for (const [k, label] of [
    ["rsi", "RSI"],
    ["stoch", "Stoch"],
    ["bb", "BB"],
    ["ma20", "MA20"],
    ["ge2", "2+"],
    ["ge3", "3+"],
    ["eq4", "4"],
  ]) {
    L.push(`- **${label}**: ${metricRow(doc.pooled.train[k])}`)
  }
  L.push("")
  L.push("## 2. Test results (pooled, frozen thresholds)")
  L.push("")
  for (const [k, label] of [
    ["rsi", "RSI"],
    ["stoch", "Stoch"],
    ["bb", "BB"],
    ["ma20", "MA20"],
    ["ge2", "2+"],
    ["ge3", "3+"],
    ["eq4", "4"],
  ]) {
    L.push(`- **${label}**: ${metricRow(doc.pooled.test[k])}`)
  }
  L.push("")
  L.push("## 3. 3+ vs 4 conditions (Test focus)")
  L.push("")
  L.push(`| Metric | 3+ | 4 |`)
  L.push(`|--------|----|---|`)
  L.push(
    `| n | ${doc.pooled.test.ge3.n} | ${doc.pooled.test.eq4.n} |`,
  )
  L.push(
    `| near±5d | ${fmt(doc.pooled.test.ge3.nearTroughPct)}% | ${fmt(doc.pooled.test.eq4.nearTroughPct)}% |`,
  )
  L.push(
    `| d5 / d10 / d20 med | ${fmt(doc.pooled.test.ge3.d5)} / ${fmt(doc.pooled.test.ge3.d10)} / ${fmt(doc.pooled.test.ge3.d20)} | ${fmt(doc.pooled.test.eq4.d5)} / ${fmt(doc.pooled.test.eq4.d10)} / ${fmt(doc.pooled.test.eq4.d20)} |`,
  )
  L.push(
    `| MAE≥5% | ${fmt(doc.pooled.test.ge3.deeperDropPct5)}% | ${fmt(doc.pooled.test.eq4.deeperDropPct5)}% |`,
  )
  L.push(
    `| signals/yr | ${fmt(doc.pooled.test.ge3.signalsPerYear)} | ${fmt(doc.pooled.test.eq4.signalsPerYear)} |`,
  )
  L.push("")
  L.push(doc.conclusions.abc.markdown)
  L.push("")
  L.push("## 4. ETF differences (Test, 3+)")
  L.push("")
  L.push("| ETF | Split date | Train/Test events | 3+ n | near% | d20 med | MAE≥5% | /yr |")
  L.push("|-----|------------|-------------------|------|-------|---------|--------|-----|")
  for (const e of doc.etfs) {
    const c = e.test.combo.ge3
    L.push(
      `| ${e.symbol} | ${e.split.splitDate} | ${e.trainEventCount}/${e.testEventCount} | ${c.n} | ${fmt(c.nearTroughPct)} | ${fmt(c.forward?.d20?.median)} | ${fmt(c.deeperDropPct5)} | ${fmt(c.signalsPerYear)} |`,
    )
  }
  L.push("")
  L.push("### Weaker Test names")
  L.push("")
  L.push(doc.conclusions.hardEtfs)
  L.push("")
  L.push("## Train→Test decay flags")
  L.push("")
  L.push(doc.conclusions.decayNotes)
  L.push("")
  L.push("## 5. Minimal rules worth carrying forward (not finalized)")
  L.push("")
  L.push(doc.conclusions.minimalProductRules)
  L.push("")
  L.push("## What NOT to finalize")
  L.push("")
  L.push("- Exact numeric cutoffs as shipped product constants")
  L.push("- Position sizing / DCA schedule")
  L.push("- Daily Bottom Buy UI body")
  L.push("- Any claim that 3+/4 = the bottom")
  L.push("")
  return L.join("\n")
}

async function main() {
  ensureCacheDir()
  console.log("Daily Bottom Buy Train/Test — loading ETFs…")

  const barsBySymbol = new Map()
  for (const meta of DAILY_BOTTOM_BUY_ETFS) {
    const bars = await loadBars(meta.symbol)
    if (!bars?.length) throw new Error(`No bars for ${meta.symbol}`)
    barsBySymbol.set(meta.symbol, bars)
    const split = timeSplitBars(bars, TRAIN_RATIO)
    console.log(
      `  ${meta.symbol}: ${split.dataStart}→${split.dataEnd} split@${split.splitDate} (train ${split.trainBarCount} / test ${split.testBarCount})`,
    )
  }

  // Collect TRAIN troughs only (fully confirmed before each ETF's split)
  const trainTroughs = []
  for (const meta of DAILY_BOTTOM_BUY_ETFS) {
    const bars = barsBySymbol.get(meta.symbol)
    const { events } = findDailyBottomEvents(bars)
    const split = timeSplitBars(bars, TRAIN_RATIO)
    const { train } = partitionEventsBySplit(events, split.splitIdx)
    for (const e of train) {
      trainTroughs.push({
        symbol: meta.symbol,
        date: e.date,
        rsi14: e.rsi14,
        stochK: e.stochK,
        bbPctB: e.bbPctB,
        ma20DevPct: e.ma20DevPct,
      })
    }
  }

  const frozenThresholds = freezeThresholdsFromTrainTroughs(trainTroughs)
  console.log("Frozen from Train:", frozenThresholds)

  const etfs = []
  for (const meta of DAILY_BOTTOM_BUY_ETFS) {
    const r = analyzeEtfTrainTest(
      meta,
      barsBySymbol.get(meta.symbol),
      frozenThresholds,
      TRAIN_RATIO,
    )
    etfs.push(r)
    console.log(
      `  ${meta.symbol} test 3+: n=${r.test.combo.ge3.n} near=${r.test.combo.ge3.nearTroughPct}% d20=${r.test.combo.ge3.forward?.d20?.median}`,
    )
  }

  const pathKeys = [
    "perIndicator.rsi",
    "perIndicator.stoch",
    "perIndicator.bb",
    "perIndicator.ma20",
    "combo.ge2",
    "combo.ge3",
    "combo.eq4",
  ]

  const trainTroughDist = {
    rsi14: summarizeNumeric(trainTroughs.map((t) => t.rsi14)),
    stochK: summarizeNumeric(trainTroughs.map((t) => t.stochK)),
    bbPctB: summarizeNumeric(trainTroughs.map((t) => t.bbPctB)),
    ma20DevPct: summarizeNumeric(trainTroughs.map((t) => t.ma20DevPct)),
  }

  const doc = {
    generatedAt: new Date().toISOString(),
    method: {
      trainRatio: TRAIN_RATIO,
      dipDefinition: DIP_DEF,
      v1ReferenceBands: V1_REFERENCE_BANDS,
      note: "Thresholds from Train trough medians only; Test never retuned.",
    },
    frozenThresholds,
    trainTroughCount: trainTroughs.length,
    trainTroughDist,
    pooled: {
      train: poolSeg(etfs, "train", pathKeys),
      test: poolSeg(etfs, "test", pathKeys),
    },
    etfs: etfs.map((e) => ({
      symbol: e.symbol,
      theme: e.theme,
      group: e.group,
      split: e.split,
      trainEventCount: e.trainEventCount,
      testEventCount: e.testEventCount,
      localTrainThresholds: e.localTrainThresholds,
      train: {
        tradingDays: e.train.tradingDays,
        troughDist: e.train.troughDist,
        perIndicator: slimEval(e.train.perIndicator),
        combo: slimEval(e.train.combo),
      },
      test: {
        tradingDays: e.test.tradingDays,
        troughDist: e.test.troughDist,
        perIndicator: slimEval(e.test.perIndicator),
        combo: slimEval(e.test.combo),
      },
    })),
    conclusions: {},
  }
  doc.conclusions = buildConclusions(doc)

  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2), "utf8")
  fs.writeFileSync(OUT_MD, buildMarkdown(doc), "utf8")
  console.log(`Wrote ${OUT_JSON}`)
  console.log(`Wrote ${OUT_MD}`)
}

function slimEval(obj) {
  /** @type {Record<string, any>} */
  const out = {}
  for (const [k, v] of Object.entries(obj || {})) {
    out[k] = {
      label: v.label,
      n: v.n,
      signalsPerYear: v.signalsPerYear,
      nearTroughPct: v.nearTroughPct,
      deeperDropPct5: v.deeperDropPct5,
      deeperDropPct8: v.deeperDropPct8,
      forward: {
        d5: { median: v.forward?.d5?.median, mean: v.forward?.d5?.mean },
        d10: { median: v.forward?.d10?.median, mean: v.forward?.d10?.mean },
        d20: { median: v.forward?.d20?.median, mean: v.forward?.d20?.mean },
        mae20: { median: v.forward?.mae20?.median, mean: v.forward?.mae20?.mean },
      },
    }
  }
  return out
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
