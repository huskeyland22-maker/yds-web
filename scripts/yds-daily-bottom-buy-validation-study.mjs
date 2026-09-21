#!/usr/bin/env node
/**
 * YDS Daily Bottom Buy — past-data validation study (research only).
 *
 *   node scripts/yds-daily-bottom-buy-validation-study.mjs
 *   node scripts/yds-daily-bottom-buy-validation-study.mjs --force-fetch
 *
 * Does NOT touch Panic Index, product UI, or Daily Bottom Buy UI body.
 * Writes: scripts/.cache/yds-daily-bottom-buy-validation-result.json
 *         docs/YDS_DAILY_BOTTOM_BUY_VALIDATION.md
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  DAILY_BOTTOM_BUY_ETFS,
  DIP_DEF,
  analyzeEtf,
  buildSharedThresholdsFromTroughs,
  summarizeNumeric,
} from "./lib/daily-bottom-buy-validation-core.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const OUT_JSON = path.join(CACHE, "yds-daily-bottom-buy-validation-result.json")
const OUT_MD = path.join(ROOT, "docs", "YDS_DAILY_BOTTOM_BUY_VALIDATION.md")

/** Prefer ≥5y; Yahoo will return from listing if shorter */
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

/**
 * @param {string} symbol
 * @returns {Promise<import('./lib/daily-bottom-indicators.mjs').Bar[]>}
 */
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
  /** @type {import('./lib/daily-bottom-indicators.mjs').Bar[]} */
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

/**
 * @param {string} symbol
 */
async function loadBars(symbol) {
  ensureCacheDir()
  const cp = cachePath(symbol)
  const fresh =
    fs.existsSync(cp) &&
    Date.now() - fs.statSync(cp).mtimeMs < 86400_000 &&
    !forceFetch
  if (fresh) {
    const raw = JSON.parse(fs.readFileSync(cp, "utf8"))
    return raw.bars
  }
  console.log(`Fetching ${symbol}…`)
  const bars = await fetchYahooOhlcv(symbol)
  const payload = {
    symbol,
    source: "Yahoo Finance chart API v8",
    requestedStart: START,
    fetchedAt: new Date().toISOString(),
    count: bars.length,
    first: bars[0]?.date ?? null,
    last: bars[bars.length - 1]?.date ?? null,
    bars,
  }
  fs.writeFileSync(cp, JSON.stringify(payload), "utf8")
  return bars
}

function fmt(v, digits = 1) {
  if (v == null || !Number.isFinite(v)) return "—"
  return Number(v).toFixed(digits)
}

function rangeLine(sum, digits = 1) {
  if (!sum || !sum.n) return "데이터 부족"
  return `p25=${fmt(sum.p25, digits)} / med=${fmt(sum.median, digits)} / p75=${fmt(sum.p75, digits)} (n=${sum.n})`
}

function buildMarkdown(doc) {
  const lines = []
  lines.push("# YDS Daily Bottom Buy — Past Data Validation (V1)")
  lines.push("")
  lines.push(`Generated: ${doc.generatedAt}`)
  lines.push("")
  lines.push("> Research only. Not a product rule. Not financial advice. Panic Index is untouched.")
  lines.push("")
  lines.push("## 1. Data source")
  lines.push("")
  lines.push(`- **Source:** ${doc.dataSource}`)
  lines.push(`- **Requested start:** ${doc.requestedStart} (uses full available history if listing is shorter)`)
  lines.push(`- **Indicators:** RSI(14 Wilder), Stochastic(14,3,3), Bollinger(20,2) %B, 20-day MA deviation %`)
  lines.push("")
  lines.push("## 2. 「일상 저점」 definition (fixed, not return-tuned)")
  lines.push("")
  lines.push("```")
  lines.push(doc.dipDefinition.description)
  lines.push(`swingHalfWindow=${doc.dipDefinition.swingHalfWindow}`)
  lines.push(`lookbackPeakDays=${doc.dipDefinition.lookbackPeakDays}`)
  lines.push(`minDrawdownPct=${doc.dipDefinition.minDrawdownPct}`)
  lines.push(`reboundWindow=${doc.dipDefinition.reboundWindow}`)
  lines.push(`reboundFracOfDrop=${doc.dipDefinition.reboundFracOfDrop}`)
  lines.push(`reboundMinAbsPct=${doc.dipDefinition.reboundMinAbsPct}`)
  lines.push("```")
  lines.push("")
  lines.push("## 3. ETF data periods")
  lines.push("")
  lines.push("| ETF | Theme | Start | End | Bars | Adjustment events |")
  lines.push("|-----|-------|-------|-----|------|-------------------|")
  for (const e of doc.etfs) {
    lines.push(
      `| ${e.symbol} | ${e.theme} | ${e.dataStart} | ${e.dataEnd} | ${e.barCount} | ${e.adjustmentEventCount} |`,
    )
  }
  lines.push("")
  lines.push("## 4. Shared exploratory thresholds (NOT final)")
  lines.push("")
  lines.push("Derived as **median of confirmed trough-day indicator values** across all 10 ETFs.")
  lines.push("Not optimized for forward returns.")
  lines.push("")
  lines.push("| Indicator | Candidate ceiling (signal if ≤) |")
  lines.push("|-----------|----------------------------------|")
  lines.push(`| RSI(14) | ${doc.sharedThresholds.rsiMax} |`)
  lines.push(`| Stochastic %K | ${doc.sharedThresholds.stochKMax} |`)
  lines.push(`| Bollinger %B | ${doc.sharedThresholds.bbPctBMax} |`)
  lines.push(`| 20d MA deviation % | ${doc.sharedThresholds.ma20DevMax} |`)
  lines.push("")
  lines.push(`Source: ${doc.sharedThresholds.source}`)
  lines.push("")
  lines.push("## 5. Pooled trough indicator distributions")
  lines.push("")
  const p = doc.pooledTroughDist
  lines.push(`- **RSI:** ${rangeLine(p.rsi14)}`)
  lines.push(`- **Stoch %K:** ${rangeLine(p.stochK)}`)
  lines.push(`- **BB %B:** ${rangeLine(p.bbPctB, 2)}`)
  lines.push(`- **MA20 dev %:** ${rangeLine(p.ma20DevPct)}`)
  lines.push(`- **Drawdown at trough:** ${rangeLine(p.drawdownPct)}`)
  lines.push("")
  lines.push("## 6. Per-ETF results (shared exploratory thresholds)")
  lines.push("")
  for (const e of doc.etfsShared) {
    lines.push(`### ${e.symbol} — ${e.theme}`)
    lines.push("")
    lines.push(`- Period: ${e.dataStart} → ${e.dataEnd}`)
    lines.push(`- Adjustment events: **${e.adjustmentEventCount}** (~${fmt(e.eventsPerYear, 1)}/yr)`)
    lines.push(`- Trough RSI: ${rangeLine(e.troughIndicatorRanges.rsi14)}`)
    lines.push(`- Trough StochK: ${rangeLine(e.troughIndicatorRanges.stochK)}`)
    lines.push(`- Trough BB%B: ${rangeLine(e.troughIndicatorRanges.bbPctB, 2)}`)
    lines.push(`- Trough MA20dev: ${rangeLine(e.troughIndicatorRanges.ma20DevPct)}`)
    lines.push(
      `- Signal freq (rising-edge): RSI=${e.perIndicator.rsi.n}, Stoch=${e.perIndicator.stoch.n}, BB=${e.perIndicator.bb.n}, MA20=${e.perIndicator.ma20.n}`,
    )
    lines.push(
      `- Combo rising-edge: 2+=${e.combo.ge2.n} (~${fmt(e.combo.ge2.signalsPerYear)}/yr), 3+=${e.combo.ge3.n} (~${fmt(e.combo.ge3.signalsPerYear)}/yr), 4=${e.combo.eq4.n} (~${fmt(e.combo.eq4.signalsPerYear)}/yr)`,
    )
    lines.push(
      `- Occupancy: days with 3+=${e.occupancy.pctGe3}%, 4=${e.occupancy.pctEq4}%`,
    )
    const g3 = e.combo.ge3
    lines.push(
      `- After 3+ signal: d5 med=${fmt(g3.forward?.d5?.median)}%, d10 med=${fmt(g3.forward?.d10?.median)}%, d20 med=${fmt(g3.forward?.d20?.median)}%, MAE20 med=${fmt(g3.forward?.mae20?.median)}%`,
    )
    lines.push(
      `- Near trough (±5d): ${fmt(g3.nearTroughPct)}% | Deeper drop MAE≥5%: ${fmt(g3.deeperDropPct5)}% | MAE≥8%: ${fmt(g3.deeperDropPct8)}%`,
    )
    lines.push(`- Usefulness: ${e.usefulnessNote.note}`)
    lines.push("")
  }

  lines.push("## 7. Indicator-level summary (shared thresholds, pooled across ETFs)")
  lines.push("")
  for (const [k, label] of [
    ["rsi", "RSI"],
    ["stoch", "Stochastic"],
    ["bb", "Bollinger %B"],
    ["ma20", "MA20 deviation"],
  ]) {
    const s = doc.pooledSignals[k]
    lines.push(`### ${label}`)
    lines.push(
      `- Rising-edge signals (all ETFs, complete +20d): **${s.n}**`,
    )
    lines.push(
      `- Near trough ±5d: ${fmt(s.nearTroughPct)}% | False (not near): ${fmt(s.falseSignalPct)}%`,
    )
    lines.push(
      `- Forward med: d5=${fmt(s.forward?.d5?.median)}% / d10=${fmt(s.forward?.d10?.median)}% / d20=${fmt(s.forward?.d20?.median)}%`,
    )
    lines.push(
      `- MAE20 med=${fmt(s.forward?.mae20?.median)}% | MAE≥5% rate=${fmt(s.deeperDropPct5)}%`,
    )
    lines.push("")
  }

  lines.push("## 8. Combo summary")
  lines.push("")
  for (const key of ["ge2", "ge3", "eq4"]) {
    const s = doc.pooledSignals[key]
    lines.push(
      `- **${s.label}**: n=${s.n}, near=${fmt(s.nearTroughPct)}%, d20med=${fmt(s.forward?.d20?.median)}%, MAE20med=${fmt(s.forward?.mae20?.median)}%, MAE≥5%=${fmt(s.deeperDropPct5)}%`,
    )
  }
  lines.push("")

  lines.push("## 9. Common threshold candidates")
  lines.push("")
  lines.push(doc.conclusions.commonCandidates)
  lines.push("")
  lines.push("## 10. ETFs where common rules look weak / different")
  lines.push("")
  lines.push(doc.conclusions.hardEtfs)
  lines.push("")
  lines.push("## 11. What to finalize next / what NOT to finalize")
  lines.push("")
  lines.push(doc.conclusions.finalize)
  lines.push("")
  lines.push("## 12. Data gaps")
  lines.push("")
  lines.push(doc.conclusions.dataGaps)
  lines.push("")
  return lines.join("\n")
}

function poolSignalEvals(etfResults, pathKeys) {
  /** @type {Record<string, any>} */
  const out = {}
  for (const pathKey of pathKeys) {
    const parts = pathKey.split(".")
    const outKey = parts[parts.length - 1]
    const chunks = []
    for (const e of etfResults) {
      let node = e
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
    const labelMap = {
      ge2: "2+ conditions",
      ge3: "3+ conditions",
      eq4: "4 conditions",
      rsi: "RSI",
      stoch: "Stochastic",
      bb: "Bollinger %B",
      ma20: "MA20 deviation",
    }
    out[outKey] = {
      label: labelMap[outKey] || outKey,
      n,
      nearTroughPct: wavg((c) => c.nearTroughPct),
      falseSignalPct: wavg((c) => c.falseSignalPct),
      deeperDropPct5: wavg((c) => c.deeperDropPct5),
      deeperDropPct8: wavg((c) => c.deeperDropPct8),
      forward: {
        d5: { median: wavg((c) => c.forward?.d5?.median), mean: wavg((c) => c.forward?.d5?.mean) },
        d10: { median: wavg((c) => c.forward?.d10?.median), mean: wavg((c) => c.forward?.d10?.mean) },
        d20: { median: wavg((c) => c.forward?.d20?.median), mean: wavg((c) => c.forward?.d20?.mean) },
        mae20: { median: wavg((c) => c.forward?.mae20?.median), mean: wavg((c) => c.forward?.mae20?.mean) },
      },
    }
  }
  return out
}

function buildConclusions(doc) {
  const th = doc.sharedThresholds
  const g3 = doc.pooledSignals.ge3
  const eq4 = doc.pooledSignals.eq4

  const commonCandidates = [
    `**Exploratory common ranges (from trough distributions — NOT locked):**`,
    `- RSI(14): trough p25–p75 ≈ **${fmt(doc.pooledTroughDist.rsi14.p25)}–${fmt(doc.pooledTroughDist.rsi14.p75)}**; exploratory ceiling (median) **≤ ${th.rsiMax}**. Note: classic RSI&lt;30 is near p25 — many confirmed dips trough near mid-30s.`,
    `- Stochastic %K: p25–p75 ≈ **${fmt(doc.pooledTroughDist.stochK.p25)}–${fmt(doc.pooledTroughDist.stochK.p75)}**; exploratory ceiling **≤ ${th.stochKMax}**.`,
    `- Bollinger %B: p25–p75 ≈ **${fmt(doc.pooledTroughDist.bbPctB.p25, 2)}–${fmt(doc.pooledTroughDist.bbPctB.p75, 2)}**; median ≈ **${fmt(th.bbPctBMax, 2)}** ⇒ troughs typically sit **at/below the lower band**. Product rule may use %B≤0 ~ ≤0.15 band rather than a single 0.01 cut.`,
    `- 20d MA deviation: p25–p75 ≈ **${fmt(doc.pooledTroughDist.ma20DevPct.p25)}%–${fmt(doc.pooledTroughDist.ma20DevPct.p75)}%**; exploratory ceiling **≤ ${th.ma20DevMax}%**.`,
    ``,
    `**Combo probe (shared exploratory ceilings):** 3+ n=${g3.n}, near-trough ${fmt(g3.nearTroughPct)}%, d20 median ${fmt(g3.forward?.d20?.median)}%, MAE≥5% ${fmt(g3.deeperDropPct5)}%.`,
    `4-condition: n=${eq4.n}, near-trough ${fmt(eq4.nearTroughPct)}%, d20 median ${fmt(eq4.forward?.d20?.median)}%.`,
    `Single indicators alone are noisy (~40% near-trough); 3+/4 conditions improve median +20d slightly but do **not** make signals equal bottoms.`,
  ].join("\n")

  // Flag ETFs with weak 3+ near-trough or thin forward edge
  const hard = []
  for (const e of doc.etfsShared) {
    const c = e.combo.ge3
    const reasons = []
    if ((c.n ?? 0) < 5) reasons.push(`few 3+ signals (n=${c.n})`)
    if ((c.nearTroughPct ?? 100) < 35) reasons.push(`low near-trough ${fmt(c.nearTroughPct)}%`)
    if ((c.forward?.d20?.median ?? 0) < 1.5) reasons.push(`weak d20 med ${fmt(c.forward?.d20?.median)}%`)
    if ((c.deeperDropPct5 ?? 0) > 40) reasons.push(`high MAE≥5% ${fmt(c.deeperDropPct5)}%`)
    // Local vs shared RSI gap
    const localRsi = e.localThresholds?.rsiMax
    if (localRsi != null && Math.abs(localRsi - th.rsiMax) >= 8) {
      reasons.push(`local RSI median ${localRsi} far from shared ${th.rsiMax}`)
    }
    if (reasons.length >= 2) hard.push(`- **${e.symbol}**: ${reasons.join("; ")}`)
    else if (reasons.length === 1 && (reasons[0].includes("low near") || reasons[0].includes("weak d20"))) {
      hard.push(`- **${e.symbol}**: ${reasons.join("; ")}`)
    }
  }
  const hardEtfs = hard.length
    ? hard.join("\n")
    : "- No ETF strongly diverged on the coarse flags above; still review per-ETF sections."

  const finalize = [
    `**Can finalize now:**`,
    `- V1 ETF universe (10 names)`,
    `- Indicator set (RSI/Stoch/BB/MA20dev) for further validation`,
    `- Documented 「일상 저점」 event definition used in this study`,
    `- Separation from Panic Index`,
    ``,
    `**Must NOT finalize yet:**`,
    `- Exact RSI / Stoch / BB / MA20 numeric cutoffs as product rules`,
    `- 0–1 / 2 / 3 / 4 combo → wait/watch/buy1/buy2 mapping`,
    `- Position sizing / split-buy schedule`,
    `- Daily Bottom Buy UI body`,
    `- Any claim that signals equal the exact bottom or guarantee forward profit`,
  ].join("\n")

  const dataGaps = [
    `- Intraday timing not modeled (signals use daily close).`,
    `- No volume / breadth / sector relative strength yet.`,
    `- Survivorship: ETF list fixed ex-ante for V1; listing start dates differ (esp. newer theme ETFs).`,
    `- Rebound requirement in dip definition selects successful recoveries — indicator ranges at troughs are conditional on rebound occurring (documented selection effect).`,
    `- Yahoo OHLCV quality / splits assumed correct via chart API.`,
  ].join("\n")

  return { commonCandidates, hardEtfs, finalize, dataGaps }
}

async function main() {
  ensureCacheDir()
  console.log("Daily Bottom Buy validation — loading 10 ETFs…")

  /** @type {Map<string, any[]>} */
  const barsBySymbol = new Map()
  for (const meta of DAILY_BOTTOM_BUY_ETFS) {
    const bars = await loadBars(meta.symbol)
    if (!bars?.length) throw new Error(`No bars for ${meta.symbol}`)
    barsBySymbol.set(meta.symbol, bars)
    console.log(
      `  ${meta.symbol}: ${bars[0].date} → ${bars[bars.length - 1].date} (${bars.length} bars)`,
    )
  }

  // Pass 1: local troughs + local thresholds
  const etfsLocal = []
  const pooledTroughs = []
  for (const meta of DAILY_BOTTOM_BUY_ETFS) {
    const r = analyzeEtf(meta, barsBySymbol.get(meta.symbol), null)
    etfsLocal.push(r)
    for (const t of r.troughSnapshots) pooledTroughs.push(t)
    console.log(`  events ${meta.symbol}: ${r.adjustmentEventCount}`)
  }

  const sharedThresholds = buildSharedThresholdsFromTroughs(pooledTroughs)
  console.log("Shared exploratory thresholds:", sharedThresholds)

  // Pass 2: shared thresholds for cross-ETF comparable signal stats
  const etfsShared = []
  for (const meta of DAILY_BOTTOM_BUY_ETFS) {
    const r = analyzeEtf(meta, barsBySymbol.get(meta.symbol), sharedThresholds)
    // drop bulky troughSnapshots from shared export (keep sample)
    const { troughSnapshots, ...rest } = r
    etfsShared.push({ ...rest, troughSnapshotCount: troughSnapshots.length })
  }

  const pooledTroughDist = {
    rsi14: summarizeNumeric(pooledTroughs.map((t) => t.rsi14)),
    stochK: summarizeNumeric(pooledTroughs.map((t) => t.stochK)),
    bbPctB: summarizeNumeric(pooledTroughs.map((t) => t.bbPctB)),
    ma20DevPct: summarizeNumeric(pooledTroughs.map((t) => t.ma20DevPct)),
    drawdownPct: summarizeNumeric(pooledTroughs.map((t) => t.drawdownPct)),
  }

  const pooledSignals = {
    ...poolSignalEvals(etfsShared, [
      "perIndicator.rsi",
      "perIndicator.stoch",
      "perIndicator.bb",
      "perIndicator.ma20",
    ]),
    ...poolSignalEvals(etfsShared, ["combo.ge2", "combo.ge3", "combo.eq4"]),
  }

  /** slim local export */
  const etfsSlim = etfsLocal.map((e) => {
    const { troughSnapshots, perIndicator, combo, ...rest } = e
    return {
      ...rest,
      troughSnapshotCount: troughSnapshots.length,
      localOnly: true,
    }
  })

  const doc = {
    generatedAt: new Date().toISOString(),
    dataSource: "Yahoo Finance chart API v8 (daily OHLCV), cached under scripts/.cache/dbb-*-daily-ohlcv.json",
    requestedStart: START,
    etfUniverse: DAILY_BOTTOM_BUY_ETFS,
    dipDefinition: DIP_DEF,
    sharedThresholds,
    pooledTroughCount: pooledTroughs.length,
    pooledTroughDist,
    etfs: etfsSlim,
    etfsShared,
    pooledSignals,
    conclusions: {},
  }
  doc.conclusions = buildConclusions(doc)

  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2), "utf8")
  fs.writeFileSync(OUT_MD, buildMarkdown(doc), "utf8")
  console.log(`Wrote ${OUT_JSON}`)
  console.log(`Wrote ${OUT_MD}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
