/**
 * Generate DBB v10 audit (v11) JSON.
 * node scripts/dbb-chart-quality-v11.mjs
 * Does not modify v1~v10, DBB engine, or trade records.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { analyzeV10Audit } from "./lib/dbb-chart-quality-v11.mjs"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dataDir = join(root, "vite-project", "public", "data")
const eqDir = join(root, "scripts", ".cache", "eq-ohlcv")
const outPath = join(dataDir, "dbb-chart-quality-v11.json")
const reportPath = join(root, "docs", "dbb-chart-quality-v11-method.md")

function loadBars(symbol) {
  const path = join(eqDir, `${symbol}.json`)
  if (!existsSync(path)) return null
  const raw = JSON.parse(readFileSync(path, "utf8"))
  const bars = Array.isArray(raw?.bars) ? raw.bars : Array.isArray(raw) ? raw : null
  return bars?.length ? bars : null
}

const v1 = JSON.parse(readFileSync(join(dataDir, "dbb-chart-quality-v1.json"), "utf8"))
const v10 = JSON.parse(readFileSync(join(dataDir, "dbb-chart-quality-v10.json"), "utf8"))
const seriesBySymbol = {}
for (const row of EQUITY_SELL_RESEARCH_UNIVERSE) {
  const bars = loadBars(row.symbol)
  if (bars) seriesBySymbol[row.symbol] = bars
}
const qqqBars = loadBars("QQQ") || []

const report = analyzeV10Audit(v10, v1, seriesBySymbol, qqqBars)
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(report)}\n`, "utf8")

const methodMd = `# DBB 실전 효용 검증 v11 — v10 매칭·부트스트랩 감사

- 기준일: ${report.asOf}
- 목적: v10 「효용 미입증」이 설계·구현상 타당한지 감사. 새 매수 규칙 탐색 아님.
- v10 재현: ${report.reproduce?.ok ? "일치" : "불일치"}
- 날짜 클러스터: 신호일 단위 gap → bootstrapGapMedian (reps=${report.rule.blockBootstrap.reps}, seed=${report.rule.blockBootstrap.seed})
- 시간 블록: 1차 ${report.rule.blockBootstrap.primaryBlockDates} 신호일 서열, 민감도 ${report.rule.blockBootstrap.sensitivityBlockDates.join("·")} (사전 고정)
- 동일 종목 60일 구간 중첩률: ${report.independence?.sameSymbolWindowOverlap60?.ratePct}%
- 대조 중복: ${report.independence?.duplicateControls}

## 한계
- 날짜 클러스터만으로 인접일 수익률 중첩이 해소되지 않음 → 시간 블록 진단 병행
- 미매칭 미래성과는 사후 진단
- 보조 분석(3/4·국면)으로 핵심 판정을 바꾸지 않음

## 판정
- ${report.verdict?.level} — ${report.verdict?.reason}
`

mkdirSync(dirname(reportPath), { recursive: true })
writeFileSync(reportPath, methodMd, "utf8")

console.log(
  JSON.stringify(
    {
      outPath,
      reportPath,
      asOf: report.asOf,
      reproduce: report.reproduce,
      counts: report.counts,
      matchingBias: {
        matchedN: report.matchingBias?.matchedN,
        unmatchedN: report.matchingBias?.unmatchedN,
        reasons: report.matchingBias?.reasons,
        smd: {
          dd20: report.matchingBias?.covariates?.dd20?.smd,
          vol20: report.matchingBias?.covariates?.vol20?.smd,
          qqqRet20: report.matchingBias?.covariates?.qqqRet20?.smd,
          ret60PostHoc: report.matchingBias?.postHocOutcomes?.ret60?.smd,
        },
      },
      balance: report.balance,
      independence: report.independence,
      bootstrap: {
        dateCluster: {
          overall: report.bootstrap?.dateClusterOverall?.sameDayApi,
          matchesApi: report.bootstrap?.dateClusterOverall?.matchesSameDayApi,
          reproducible: report.bootstrap?.dateClusterOverall?.reproducible,
        },
        blockOverallPrimary: report.bootstrap?.blockOverall?.primary,
        blockValPrimary: report.bootstrap?.blockValidation?.primary,
        trainValDateOverlap: report.bootstrap?.trainValDateOverlap,
      },
      core: report.core,
      verdict: report.verdict,
    },
    null,
    2,
  ),
)
