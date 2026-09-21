#!/usr/bin/env node
/**
 * YDS Daily Bottom Buy — split-buy simulation on Test (research only).
 *
 *   node scripts/yds-daily-bottom-buy-split-sim-study.mjs
 *
 * Frozen Train thresholds; Test never retuned. No Panic / UI changes.
 * Writes:
 *   scripts/.cache/yds-daily-bottom-buy-split-sim-result.json
 *   docs/YDS_DAILY_BOTTOM_BUY_SPLIT_SIM.md
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { DAILY_BOTTOM_BUY_ETFS } from "./lib/daily-bottom-buy-validation-core.mjs"
import {
  FROZEN_THRESHOLDS,
  SPLIT_SCHEMES,
  BASELINE_SCHEMES,
  EPISODE_DEF,
  analyzeEtfSplitBuy,
} from "./lib/daily-bottom-split-buy-sim.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scripts", ".cache")
const OUT_JSON = path.join(CACHE, "yds-daily-bottom-buy-split-sim-result.json")
const OUT_MD = path.join(ROOT, "docs", "YDS_DAILY_BOTTOM_BUY_SPLIT_SIM.md")

const FOCUS = new Set(["SMH", "GRID", "URA", "BOTZ", "XLV"])

function cachePath(symbol) {
  return path.join(CACHE, `dbb-${symbol.toLowerCase()}-daily-ohlcv.json`)
}

function loadBars(symbol) {
  const cp = cachePath(symbol)
  if (!fs.existsSync(cp)) {
    throw new Error(`Missing cache ${cp} — run yds-daily-bottom-buy-validation-study.mjs first`)
  }
  return JSON.parse(fs.readFileSync(cp, "utf8")).bars
}

function fmt(v, d = 1) {
  if (v == null || !Number.isFinite(v)) return "—"
  return Number(v).toFixed(d)
}

function poolSchemes(etfResults) {
  /** @type {Record<string, any>} */
  const out = {}
  const allSchemes = [...SPLIT_SCHEMES, ...BASELINE_SCHEMES]
  for (const s of allSchemes) {
    const chunks = etfResults.map((e) => e.schemes[s.id])
    const episodeCount = chunks.reduce((a, c) => a + (c.episodeCount || 0), 0)
    const reached4Count = chunks.reduce((a, c) => a + (c.reached4Count || 0), 0)
    const no4 = chunks.reduce((a, c) => a + (c.no4ReboundCount || 0), 0)
    const wavg = (getter) => {
      let num = 0
      let den = 0
      for (const c of chunks) {
        const n = c.nPerf || 0
        const v = getter(c)
        if (n && v != null && Number.isFinite(v)) {
          num += v * n
          den += n
        }
      }
      return den ? Math.round((num / den) * 100) / 100 : null
    }
    const nPerf = chunks.reduce((a, c) => a + (c.nPerf || 0), 0)
    out[s.id] = {
      id: s.id,
      label: s.label,
      w3: s.w3,
      w4: s.w4,
      episodeCount,
      reached4Count,
      no4ReboundCount: no4,
      reached4Pct: episodeCount ? round2((reached4Count / episodeCount) * 100) : null,
      no4ReboundPct: episodeCount ? round2((no4 / episodeCount) * 100) : null,
      nPerf,
      wait4SkippedCount: chunks.reduce((a, c) => a + (c.wait4SkippedCount || 0), 0),
      d5: wavg((c) => c.forward?.d5?.median),
      d10: wavg((c) => c.forward?.d10?.median),
      d20: wavg((c) => c.forward?.d20?.median),
      d20Mean: wavg((c) => c.forward?.d20?.mean),
      mae20: wavg((c) => c.forward?.mae20?.median),
      maeAfter4: wavg((c) => c.maeAfter4?.median),
      deeperAfter4Pct5: wavg((c) => c.deeperAfter4Pct5),
      threeOnlyN: chunks.reduce((a, c) => a + (c.threeOnlyForward?.n || 0), 0),
      threeOnlyD20: wavg((c) => c.threeOnlyForward?.d20?.median),
      split34N: chunks.reduce((a, c) => a + (c.split34Forward?.n || 0), 0),
      split34D20: wavg((c) => c.split34Forward?.d20?.median),
    }
  }
  return out
}

function round2(v) {
  return Math.round(v * 100) / 100
}

function buildMarkdown(doc) {
  const L = []
  L.push("# YDS Daily Bottom Buy — Split-Buy Simulation (Test)")
  L.push("")
  L.push(`Generated: ${doc.generatedAt}`)
  L.push("")
  L.push(
    "> Research only. Frozen Train thresholds. Schemes compared as-is (not optimized). Not financial advice. Panic untouched.",
  )
  L.push("")
  L.push("## Method")
  L.push("")
  L.push(`- Thresholds: ${doc.thresholds.source}`)
  L.push(`- Episode: ${EPISODE_DEF.description}`)
  L.push("- Evaluation window: Test segment only (~30% chronological)")
  L.push("- NAV return from episode open (cash + shares); WAIT4 measured from 4-fill")
  L.push("")
  L.push("## Episode totals (Test, all ETFs)")
  L.push("")
  L.push(`- Entry episodes: **${doc.totals.episodeCount}**`)
  L.push(
    `- Reached 4 (add-on): **${doc.totals.reached4Count}** (${fmt(doc.totals.reached4Pct)}%)`,
  )
  L.push(
    `- 3-only / no 4 before cool-down: **${doc.totals.no4ReboundCount}** (${fmt(doc.totals.no4ReboundPct)}%)`,
  )
  L.push("")
  L.push("## Scheme comparison (pooled Test)")
  L.push("")
  L.push(
    "| Scheme | nPerf | d5 med | d10 med | d20 med | d20 mean | MAE20 med | deeper≥5% after 4 |",
  )
  L.push("|--------|-------|--------|---------|---------|----------|-----------|-------------------|")
  for (const id of ["A", "B", "C", "ALL3", "WAIT4"]) {
    const s = doc.pooled[id]
    L.push(
      `| ${s.label} | ${s.nPerf} | ${fmt(s.d5)} | ${fmt(s.d10)} | ${fmt(s.d20)} | ${fmt(s.d20Mean)} | ${fmt(s.mae20)} | ${fmt(s.deeperAfter4Pct5)}% |`,
    )
  }
  L.push("")
  L.push("### Path splits (scheme A, illustrative)")
  L.push("")
  L.push(
    `- 3-only path n≈${doc.pooled.A.threeOnlyN}, d20 med≈${fmt(doc.pooled.A.threeOnlyD20)}%`,
  )
  L.push(
    `- 3→4 path n≈${doc.pooled.A.split34N}, d20 med≈${fmt(doc.pooled.A.split34D20)}%`,
  )
  L.push(
    `- WAIT4 skipped (never reached 4): **${doc.pooled.WAIT4.wait4SkippedCount}** episodes`,
  )
  L.push("")
  L.push("## ETF detail (scheme A 50/50)")
  L.push("")
  L.push(
    "| ETF | Episodes | →4 | no4 | d20 A | MAE20 A | d20 ALL3 | d20 WAIT4 |",
  )
  L.push("|-----|----------|----|----|-------|---------|----------|-----------|")
  for (const e of doc.etfs) {
    const mark = FOCUS.has(e.symbol) ? " *" : ""
    L.push(
      `| ${e.symbol}${mark} | ${e.episodeCount} | ${e.reached4Count} | ${e.no4ReboundCount} | ${fmt(e.schemes.A.forward?.d20?.median)} | ${fmt(e.schemes.A.forward?.mae20?.median)} | ${fmt(e.schemes.ALL3.forward?.d20?.median)} | ${fmt(e.schemes.WAIT4.forward?.d20?.median)} |`,
    )
  }
  L.push("")
  L.push("\\* focus names from prior weak common-rule set")
  L.push("")
  L.push("## Focus ETF notes")
  L.push("")
  for (const e of doc.etfs.filter((x) => FOCUS.has(x.symbol))) {
    L.push(`### ${e.symbol}`)
    L.push(
      `- Episodes ${e.episodeCount}: reached4 ${e.reached4Count}, no4 ${e.no4ReboundCount} (${fmt((e.no4ReboundCount / Math.max(e.episodeCount, 1)) * 100)}%)`,
    )
    L.push(
      `- A d20 med ${fmt(e.schemes.A.forward?.d20?.median)}% / MAE ${fmt(e.schemes.A.forward?.mae20?.median)}% vs ALL3 ${fmt(e.schemes.ALL3.forward?.d20?.median)}% / WAIT4 ${fmt(e.schemes.WAIT4.forward?.d20?.median)}%`,
    )
    L.push(
      `- After-4 MAE≥5%: ${fmt(e.schemes.A.deeperAfter4Pct5)}% of 4-fills`,
    )
    L.push("")
  }
  L.push("## Conclusions")
  L.push("")
  L.push(doc.conclusions.markdown)
  L.push("")
  return L.join("\n")
}

function buildConclusions(doc) {
  const A = doc.pooled.A
  const B = doc.pooled.B
  const C = doc.pooled.C
  const all3 = doc.pooled.ALL3
  const w4 = doc.pooled.WAIT4
  const lines = []

  lines.push("### 1. 3→4 분할매수 구조의 장점 / 한계")
  lines.push("")
  lines.push("**장점**")
  lines.push(
    `- 동일 조정 에피소드로 묶어 일별 중복 매수를 막음 (Test 에피소드 ${doc.totals.episodeCount}건).`,
  )
  lines.push(
    `- 4까지 가는 경우(${fmt(doc.totals.reached4Pct)}%)와 3에서 끝나는 경우(${fmt(doc.totals.no4ReboundPct)}%)를 분리 기록 가능.`,
  )
  lines.push(
    `- WAIT4는 4 미도달 ${w4.wait4SkippedCount}건을 통째로 건너뛰므로, 3에서 시작하는 구조가 “기회를 아예 놓치지 않는” 실용 축이 됨.`,
  )
  lines.push(
    `- A/B/C의 Test d20 중앙값은 ALL3(${fmt(all3.d20)}%) 대비 ${fmt(A.d20)} / ${fmt(B.d20)} / ${fmt(C.d20)}% — 최고수익 추적이 아니라 조기 올인 완화 관점의 비교.`,
  )
  lines.push("")
  lines.push("**한계**")
  lines.push(
    `- 4 이후에도 추가 하락(MAE≥5%)이 pooled 약 ${fmt(A.deeperAfter4Pct5)}% — “4 = 바닥”이 아님.`,
  )
  lines.push(
    `- 3-only 경로도 상당수(${doc.totals.no4ReboundCount}건). 잔여 현금을 안 쓰면 기회비용, 억지로 쓰면 규칙이 달라짐(이번 시뮬은 잔여 현금 유지).`,
  )
  lines.push(`- ETF별 편차 큼 (특히 focus 세트). 공통 비중을 만능으로 보기 어려움.`)
  lines.push("")

  lines.push("### 2. 각 비중안 결과 (Test pooled, 최적화 금지·비교만)")
  lines.push("")
  lines.push(
    `| 안 | 비중 | d20 med | d20 mean | MAE20 med |`,
  )
  lines.push(`|----|------|---------|----------|-----------|`)
  lines.push(`| A | 50/50 | ${fmt(A.d20)} | ${fmt(A.d20Mean)} | ${fmt(A.mae20)} |`)
  lines.push(`| B | 40/60 | ${fmt(B.d20)} | ${fmt(B.d20Mean)} | ${fmt(B.mae20)} |`)
  lines.push(`| C | 30/70 | ${fmt(C.d20)} | ${fmt(C.d20Mean)} | ${fmt(C.mae20)} |`)
  lines.push(`| ALL3 | 100@3 | ${fmt(all3.d20)} | ${fmt(all3.d20Mean)} | ${fmt(all3.mae20)} |`)
  lines.push(`| WAIT4 | 100@4 | ${fmt(w4.d20)} | ${fmt(w4.d20Mean)} | ${fmt(w4.mae20)} |`)
  lines.push("")
  lines.push(
    "비중 차이는 존재하지만, 이번 Test에서 A/B/C 간 격차는 크지 않을 수 있음. **어느 하나도 최종 확정하지 않음.**",
  )
  lines.push("")

  lines.push("### 3. 3개에서 반등해 4개가 안 오는 경우")
  lines.push("")
  lines.push(
    `- Test 전체: **${doc.totals.no4ReboundCount} / ${doc.totals.episodeCount}** (${fmt(doc.totals.no4ReboundPct)}%).`,
  )
  lines.push(
    `- 이 경로의 scheme A d20 중앙값(3-only 행): ≈${fmt(A.threeOnlyD20)}%.`,
  )
  lines.push(
    `- WAIT4 기준이면 이 구간은 진입 자체가 없음(skipped ${w4.wait4SkippedCount}).`,
  )
  lines.push("")

  lines.push("### 4. 4개 이후 추가 하락")
  lines.push("")
  lines.push(
    `- 4-fill 이후 20일 MAE≥5%: pooled ≈**${fmt(A.deeperAfter4Pct5)}%** (A 집계).`,
  )
  lines.push(`- 4-fill 이후 MAE 중앙값 ≈${fmt(A.maeAfter4)}%.`)
  lines.push("- 강한 후보여도 분할·여유 현금 관점이 필요함을 시사.")
  lines.push("")

  lines.push("### 5. 제품으로 가져갈 수 있는 최소 구조 (비중 미확정)")
  lines.push("")
  lines.push("1. 신호 계층: 2+=관심 / 3+=1차 후보 / 4=강한 후보 (기존 유지)")
  lines.push("2. 실행: **에피소드 단위** 3→(선택)4 분할 — 일별 중복 매수 금지")
  lines.push("3. 비중: A/B/C는 후보군으로만 유지, Test 재튜닝·수익 극대화 금지")
  lines.push("4. 반드시 UI/문구에: 4 미도달 비율, 4 이후 추가 하락 비율 고지")
  lines.push("5. Panic Index와 결합하지 않음 / UI 본체는 별도 단계")
  lines.push("")

  return { markdown: lines.join("\n") }
}

function main() {
  console.log("Split-buy simulation (Test)…")
  const etfs = []
  for (const meta of DAILY_BOTTOM_BUY_ETFS) {
    const bars = loadBars(meta.symbol)
    const r = analyzeEtfSplitBuy(meta, bars, FROZEN_THRESHOLDS)
    etfs.push(r)
    console.log(
      `  ${meta.symbol}: episodes=${r.episodeCount} →4=${r.reached4Count} no4=${r.no4ReboundCount} A.d20=${r.schemes.A.forward?.d20?.median}`,
    )
  }

  const totals = {
    episodeCount: etfs.reduce((a, e) => a + e.episodeCount, 0),
    reached4Count: etfs.reduce((a, e) => a + e.reached4Count, 0),
    no4ReboundCount: etfs.reduce((a, e) => a + e.no4ReboundCount, 0),
  }
  totals.reached4Pct = totals.episodeCount
    ? round2((totals.reached4Count / totals.episodeCount) * 100)
    : null
  totals.no4ReboundPct = totals.episodeCount
    ? round2((totals.no4ReboundCount / totals.episodeCount) * 100)
    : null

  const pooled = poolSchemes(etfs)
  const doc = {
    generatedAt: new Date().toISOString(),
    thresholds: FROZEN_THRESHOLDS,
    episodeDef: EPISODE_DEF,
    schemes: [...SPLIT_SCHEMES, ...BASELINE_SCHEMES],
    totals,
    pooled,
    etfs: etfs.map((e) => ({
      symbol: e.symbol,
      theme: e.theme,
      split: e.split,
      episodeCount: e.episodeCount,
      reached4Count: e.reached4Count,
      no4ReboundCount: e.no4ReboundCount,
      episodes: e.episodes,
      schemes: {
        A: slim(e.schemes.A),
        B: slim(e.schemes.B),
        C: slim(e.schemes.C),
        ALL3: slim(e.schemes.ALL3),
        WAIT4: slim(e.schemes.WAIT4),
      },
    })),
    conclusions: {},
  }
  doc.conclusions = buildConclusions(doc)

  fs.mkdirSync(CACHE, { recursive: true })
  fs.writeFileSync(OUT_JSON, JSON.stringify(doc, null, 2), "utf8")
  fs.writeFileSync(OUT_MD, buildMarkdown(doc), "utf8")
  console.log(`Wrote ${OUT_JSON}`)
  console.log(`Wrote ${OUT_MD}`)
}

function slim(s) {
  return {
    id: s.id,
    label: s.label,
    w3: s.w3,
    w4: s.w4,
    episodeCount: s.episodeCount,
    reached4Count: s.reached4Count,
    no4ReboundCount: s.no4ReboundCount,
    nPerf: s.nPerf,
    wait4SkippedCount: s.wait4SkippedCount,
    paths: s.paths,
    forward: s.forward,
    maeAfter4: s.maeAfter4,
    deeperAfter4Pct5: s.deeperAfter4Pct5,
    deeperAfter4Pct8: s.deeperAfter4Pct8,
    threeOnlyForward: s.threeOnlyForward,
    split34Forward: s.split34Forward,
  }
}

main()
