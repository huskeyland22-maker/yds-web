/**
 * Generate DBB signal vs matched non-signal control v10 JSON.
 * node scripts/dbb-chart-quality-v10.mjs
 * Does not modify v1~v9, DBB engine, or trade records.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { analyzeSignalVsControl } from "./lib/dbb-chart-quality-v10.mjs"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dataDir = join(root, "vite-project", "public", "data")
const eqDir = join(root, "scripts", ".cache", "eq-ohlcv")
const outPath = join(dataDir, "dbb-chart-quality-v10.json")
const reportPath = join(root, "docs", "dbb-chart-quality-v10-method.md")

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
const qqqBars = loadBars("QQQ") || []

const report = analyzeSignalVsControl(v1, seriesBySymbol, qqqBars)
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(report)}\n`, "utf8")

const t60 = report.tables?.["60"]
const methodMd = `# DBB 실전 효용 검증 v10 — 신호일 vs 비신호일 대조

- 기준일: ${report.asOf}
- 목적: DBB 신호 다음 시가 매수가, 같은 종목의 유사 환경 비신호일 매수보다 유리한지 검증
- 분할: 학습 ~${report.split?.trainEndDate} / 검증 ${report.split?.validationStartDate}~ (v1과 동일)
- 매칭 시도 ${report.counts?.signalsAttempted} · 매칭 ${report.counts?.matched} · 미매칭 ${report.counts?.unmatched} · 매칭률 ${report.counts?.matchRatePct}%
- 신호 재검증: 표본 종목 ${report.verification?.sampledSymbols} · 일치 ${report.verification?.matched} · 불일치 ${report.verification?.mismatched}
- 대조: count<3, 에피소드 ±${report.rule?.exclusionTradingDays}일 제외, QQQ 국면 일치, dd20·vol20·qqqRet20 캘리퍼
- 거리 표준편차(학습 고정): dd20=${report.scales?.dd20}, vol20=${report.scales?.vol20}, qqqRet20=${report.scales?.qqqRet20}
- 진입: 다음 거래일 시가. 미완성 ≠ 실패/0%.

## 한계
- 관측 가능 변수로만 매칭해도 잔여 교란이 남을 수 있음
- 같은 날 다수 신호는 비독립 → 날짜 단위 부트스트랩
- 대조일 1:1 비재사용. 풀 고갈 시 미매칭 증가
- 효용 미입증 시 규칙 채택·자동매매 적용 없음

## 판정 (사전 고정)
- ${report.verdict?.level} — ${report.verdict?.reason}
- 전체 60일 수익률 중앙값 차이(신호−대조): ${t60?.diff?.returnMedian}
- 검증 60일: ${report.validation?.byHorizon?.["60"]?.returnMedian} · 날짜 CI 상태 ${report.validation?.sameDay60?.bootstrap?.status}
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
      balanceAfter: report.balance?.after,
      tables60: report.tables?.["60"],
      train60: report.train,
      validation60: {
        n: report.validation?.n,
        diff: report.validation?.byHorizon?.["60"],
        sameDay: report.validation?.sameDay60,
        signal: report.validation?.signal,
        control: report.validation?.control,
      },
      auxiliary: {
        strength: report.auxiliary?.strength,
        regimes: Object.fromEntries(
          Object.entries(report.auxiliary?.regimes || {}).map(([key, block]) => [
            key,
            { n: block.n, exploratory: block.exploratory, returnMedian: block.diff60?.returnMedian },
          ]),
        ),
      },
      verdict: report.verdict,
    },
    null,
    2,
  ),
)
