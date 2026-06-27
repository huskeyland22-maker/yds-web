/**
 * YDS 일일 종합 시장 리포트 — Markdown · 인쇄(PDF)용 HTML
 */

import { buildMarketDeskSummary } from "./ydsMarketDeskSummary.js"
import { buildDashboardActionGuideReport } from "./ydsDashboardActionGuide.js"
import { buildMarketJudgmentRationale } from "./ydsMarketJudgmentRationale.js"
import { resolveUnifiedMarketStateGuide, resolveUnifiedMarketStateLabel } from "./ydsUnifiedMarketState.js"
import { buildPanicCompositeVerdictReport } from "./ydsPanicCompositeVerdict.js"
import { getFinalScore } from "../utils/tradingScores.js"
import { resolveMarketPositionView } from "./ydsMarketPositionEngine.js"

/**
 * @param {{
 *   panicData?: object | null
 *   historyRows?: object[]
 *   cycleFlow?: import("./ydsMarketCycleFlow.js").MarketCycleFlowReport | null
 *   dualLiquidity?: import("../market-os/liquidityDualEngine.js").DualLiquidityReport | null
 *   weekEvents?: { items?: { date?: string; title?: string }[] } | null
 *   picks?: { ticker: string; name: string; score?: number }[]
 *   etfContext?: object | null
 * }} input
 */
export function buildDailyMarketReport(input = {}) {
  const {
    panicData,
    historyRows = [],
    cycleFlow,
    dualLiquidity,
    weekEvents,
    picks = [],
    etfContext,
  } = input

  const today = new Date().toISOString().slice(0, 10)
  const unifiedLabel = resolveUnifiedMarketStateLabel(cycleFlow, "—")
  const guide = resolveUnifiedMarketStateGuide(unifiedLabel)
  const deskSummary = buildMarketDeskSummary(panicData, dualLiquidity, cycleFlow)
  const priceContext = {
    spyPrices: etfContext?.spyPrices,
    qqqPrices: etfContext?.qqqPrices,
    asOfDate: etfContext?.asOfDate ?? null,
  }
  const actionGuide = buildDashboardActionGuideReport(
    panicData,
    historyRows,
    dualLiquidity,
    cycleFlow,
    priceContext,
  )
  const judgment = buildMarketJudgmentRationale({
    panicData,
    cycleFlow,
    dualLiquidity,
    etfContext,
  })

  const panicScore = panicData ? Math.round(getFinalScore(panicData) ?? NaN) : null
  const composite = buildPanicCompositeVerdictReport(panicData, priceContext)
  const positionView = resolveMarketPositionView(panicData)

  const weekItems = (weekEvents?.flatItems ?? weekEvents?.macroItems ?? []).slice(0, 8)

  /** @type {string[]} */
  const risks = []
  if (judgment.factors.some((f) => f.id === "qqq-2d" && f.tone === "negative")) {
    risks.push("단기 지수 조정 압력")
  }
  if (judgment.factors.some((f) => f.id === "liq-policy" && f.tone === "negative")) {
    risks.push("정책 유동성 부담")
  }
  if (composite.visible && composite.verdictId === "overheat") risks.push("패닉·가격 과열 구간")
  else if (composite.visible && composite.verdictId === "laggingFear") {
    risks.push("늦은 공포 — 추격매수 주의")
  }
  if (!risks.length) risks.push("급격한 변동성 확대")

  /** @type {string[]} */
  const checkpoints = [
    "시장 상태 전환 여부",
    "패닉 점수 변화",
    "유동성 점수 변화",
    "추천 종목 점수·등급 변동",
  ]

  const sections = {
    title: `YDS 시장 종합 리포트 · ${today}`,
    summary: deskSummary?.lines ?? [],
    marketState: {
      label: unifiedLabel,
      score: positionView?.score ?? null,
      phase: guide.strategyPhase,
      narrative: guide.strategyNarrative,
    },
    panic: {
      score: panicScore,
      label: composite.visible ? composite.verdictLabel : "—",
      buyStrength: composite.visible ? composite.buyStrength : "—",
      action: composite.visible ? composite.actionLine : "—",
      psychLabel: composite.visible ? composite.psychLabel : "—",
      priceLabel: composite.visible ? composite.priceLabel : "—",
    },
    liquidity: {
      market: dualLiquidity?.market?.band?.label ?? "—",
      policy: dualLiquidity?.policy?.band?.label ?? "—",
      lead: dualLiquidity?.synthesis?.leadSentence ?? "—",
    },
    weekEvents: weekItems.map((e) => `${e.date ?? ""} ${e.title ?? e.label ?? e.name ?? ""}`.trim()),
    picks: picks.slice(0, 10).map((p) => `${p.ticker} ${p.name} (${p.score ?? "—"})`),
    strategy: guide.actions,
    actionGuide: actionGuide.recommendedActions,
    risks,
    checkpoints,
    judgment: judgment.factors.map((f) => `${f.icon} ${f.text}`),
    conclusion: judgment.conclusion,
  }

  const markdown = buildDailyMarketReportMarkdown(sections)
  const html = buildDailyMarketReportHtml(sections)

  return { sections, markdown, html, generatedAt: new Date().toISOString() }
}

/** @param {ReturnType<typeof buildDailyMarketReport>["sections"]} sections */
export function buildDailyMarketReportMarkdown(sections) {
  const lines = [
    `# ${sections.title}`,
    "",
    "## 1. 오늘 시장 요약",
    ...sections.summary.map((l) => `- ${l}`),
    "",
    "## 2. 시장 상태 분석",
    `- **${sections.marketState.label}** (점수 ${sections.marketState.score ?? "—"})`,
    `- ${sections.marketState.phase}`,
    ...sections.marketState.narrative.map((l) => `- ${l}`),
    "",
    "## 3. 패닉 강도 · 심리+가격 종합",
    `- 심리 점수: ${sections.panic.score ?? "—"} · ${sections.panic.psychLabel ?? "—"}`,
    `- 가격 위치: ${sections.panic.priceLabel ?? "—"}`,
    `- 종합: ${sections.panic.label}`,
    `- 매수 강도: ${sections.panic.buyStrength}`,
    `- 권장: ${sections.panic.action}`,
    "",
    "## 4. 유동성 환경",
    `- 시장: ${sections.liquidity.market}`,
    `- 정책: ${sections.liquidity.policy}`,
    `- ${sections.liquidity.lead}`,
    "",
    "## 5. 이번주 주요 이벤트",
    ...(sections.weekEvents.length
      ? sections.weekEvents.map((e) => `- ${e}`)
      : ["- (등록된 이벤트 없음)"]),
    "",
    "## 6. 추천 종목",
    ...(sections.picks.length ? sections.picks.map((p) => `- ${p}`) : ["- (없음)"]),
    "",
    "## 7. 투자 전략",
    ...sections.strategy.map((s) => `- ${s}`),
    "",
    "## 8. 오늘 행동 가이드",
    ...sections.actionGuide.map((s) => `- ✓ ${s}`),
    "",
    "## 9. 리스크 요인",
    ...sections.risks.map((r) => `- ${r}`),
    "",
    "## 10. 체크포인트",
    ...sections.checkpoints.map((c) => `- [ ] ${c}`),
    "",
    "## 시장 판단 근거",
    ...sections.judgment.map((j) => `- ${j}`),
    "",
    `**최종 판단** ${sections.conclusion}`,
    "",
    "---",
    "_YDS 자동 생성 리포트_",
  ]
  return lines.join("\n")
}

/** @param {ReturnType<typeof buildDailyMarketReport>["sections"]} sections */
export function buildDailyMarketReportHtml(sections) {
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")

  const list = (items) =>
    items.map((i) => `<li>${esc(i)}</li>`).join("")

  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"/><title>${esc(sections.title)}</title>
<style>
body{font-family:"Pretendard",system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;color:#0f172a;line-height:1.55}
h1{font-size:1.35rem;border-bottom:2px solid #334155;padding-bottom:.5rem}
h2{font-size:1rem;margin-top:1.4rem;color:#334155}
ul{padding-left:1.2rem}
.footer{margin-top:2rem;font-size:.75rem;color:#64748b}
@media print{body{margin:1rem}}
</style></head><body>
<h1>${esc(sections.title)}</h1>
<h2>1. 오늘 시장 요약</h2><ul>${list(sections.summary)}</ul>
<h2>2. 시장 상태 분석</h2><p><strong>${esc(sections.marketState.label)}</strong> · 점수 ${esc(sections.marketState.score)}</p><ul>${list([sections.marketState.phase, ...sections.marketState.narrative])}</ul>
<h2>3. 패닉 · 심리+가격 종합</h2><ul>${list([`심리 ${sections.panic.score} · ${sections.panic.psychLabel}`, `가격 ${sections.panic.priceLabel}`, sections.panic.label, sections.panic.buyStrength, sections.panic.action])}</ul>
<h2>4. 유동성</h2><ul>${list([sections.liquidity.market, sections.liquidity.policy, sections.liquidity.lead])}</ul>
<h2>5. 이번주 이벤트</h2><ul>${list(sections.weekEvents.length ? sections.weekEvents : ["없음"])}</ul>
<h2>6. 추천 종목</h2><ul>${list(sections.picks.length ? sections.picks : ["없음"])}</ul>
<h2>7. 투자 전략</h2><ul>${list(sections.strategy)}</ul>
<h2>8. 행동 가이드</h2><ul>${list(sections.actionGuide)}</ul>
<h2>9. 리스크</h2><ul>${list(sections.risks)}</ul>
<h2>10. 체크포인트</h2><ul>${list(sections.checkpoints)}</ul>
<h2>판단 근거</h2><ul>${list(sections.judgment)}</ul>
<p><strong>${esc(sections.conclusion)}</strong></p>
<p class="footer">YDS 자동 생성 리포트</p>
</body></html>`
}

/** @param {string} markdown @param {string} filename */
export function downloadTextFile(markdown, filename) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** @param {string} html */
export function openPrintableReport(html) {
  const w = window.open("", "_blank", "noopener,noreferrer")
  if (!w) return false
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 400)
  return true
}
