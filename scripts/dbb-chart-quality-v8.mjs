/**
 * Generate DBB signal-strength v8 JSON (3-of-4 vs 4-of-4).
 * node scripts/dbb-chart-quality-v8.mjs
 * Does not modify v1~v7 files, DBB engine, or trade records.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { analyzeSignalStrength } from "./lib/dbb-chart-quality-v8.mjs"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dataDir = join(root, "vite-project", "public", "data")
const eqDir = join(root, "scripts", ".cache", "eq-ohlcv")
const outPath = join(dataDir, "dbb-chart-quality-v8.json")
const reportPath = join(root, "docs", "dbb-chart-quality-v8-method.md")

function loadBars(symbol) {
  const path = join(eqDir, `${symbol}.json`)
  if (!existsSync(path)) return null
  const raw = JSON.parse(readFileSync(path, "utf8"))
  const bars = Array.isArray(raw?.bars) ? raw.bars : Array.isArray(raw) ? raw : null
  return bars?.length ? bars : null
}

const v1 = JSON.parse(readFileSync(join(dataDir, "dbb-chart-quality-v1.json"), "utf8"))
const seriesBySymbol = {}
for (const row of EQUITY_SELL_RESEARCH_UNIVERSE) {
  const bars = loadBars(row.symbol)
  if (bars) seriesBySymbol[row.symbol] = bars
}

const report = analyzeSignalStrength(v1, seriesBySymbol)
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(report)}\n`, "utf8")

const v60 = report.validation.byHorizon["60"]
const o60 = report.overall.byHorizon["60"]
const methodMd = `# DBB 신호 강도 검증 v8 — 방법과 한계

- 기준일: ${report.asOf}
- 신호: ${report.counts.signals} · 3개: ${report.counts.three} · 4개: ${report.counts.four} · 분류불가: ${report.counts.unclassified}
- 분할: 학습 ~${report.split.trainEndDate} / 검증 ${report.split.validationStartDate}~ (v1·v7과 동일)
- 조건 재검증: 표본 ${report.verification.sampled} · 일치 ${report.verification.matched} · 불일치 ${report.verification.mismatched} · 바 없음 ${report.verification.missingBars}
- 임계값: RSI≤${report.rule.thresholds.rsiMax}, Stoch%K≤${report.rule.thresholds.stochKMax}, %B≤${report.rule.thresholds.bbPctBMax}, MA20≤${report.rule.thresholds.ma20DevMax}%
- 진입: 신호 다음 거래일 시가. 성공: 기간 수익률 > 0% (0%는 별도). 미완성 ≠ 실패.
- MAE: v1 horizon maxDrawdownPct(기간 저가). 일봉만으로 장중 순서는알 수 없음.

## 한계
- 같은 날 다수 종목 신호는 비독립. 날짜 단위·부트스트랩을 함께 본다.
- 0~2개 충족일은 기존 매수 신호가 아니며 본 비교의 주대상이 아니다.
- 회복 기간은 v1 행에 저장되지 않아 본 연구에서 분포를 산출하지 않는다.
- 검증 결과를 보고 분류·임계값을 바꾸지 않는다. 효용 미입증 시 채택하지 않는다.

## 판정 (사전 고정 규칙)
- ${report.verdict.level} — ${report.verdict.reason}
- 전체 60일 성공률 차이: ${o60.diff.successRatePp}%p · 중앙값 차이: ${o60.diff.priceMedianPp}%p · MAE 차이: ${o60.diff.maeMedianPp}%p
- 검증 60일 성공률 차이: ${v60.diff.successRatePp}%p · 중앙값 차이: ${v60.diff.priceMedianPp}%p
`

mkdirSync(dirname(reportPath), { recursive: true })
writeFileSync(reportPath, methodMd, "utf8")

console.log(
  JSON.stringify(
    {
      outPath,
      reportPath,
      asOf: report.asOf,
      verification: report.verification,
      counts: report.counts,
      tableA: report.tableA,
      overall60: {
        three: o60.three,
        four: o60.four,
        diff: o60.diff,
        sameDay: {
          pairedDates: o60.sameDay.pairedDates,
          returnGapMedian: o60.sameDay.returnGapMedian,
          bootstrap: o60.sameDay.bootstrapReturn,
        },
      },
      validation60: {
        three: v60.three,
        four: v60.four,
        diff: v60.diff,
        sameDay: {
          pairedDates: v60.sameDay.pairedDates,
          returnGapMedian: v60.sameDay.returnGapMedian,
          bootstrap: v60.sameDay.bootstrapReturn,
        },
      },
      verdict: report.verdict,
    },
    null,
    2,
  ),
)
