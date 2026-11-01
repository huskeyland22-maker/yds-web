/**
 * Generate DBB practical utility v7 JSON.
 * node scripts/dbb-chart-quality-v7.mjs
 * Does not modify v1~v6 files.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { analyzePracticalUtility } from "./lib/dbb-chart-quality-v7.mjs"
import { EQUITY_SELL_RESEARCH_UNIVERSE } from "./lib/equity-sell-research-universe.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dataDir = join(root, "vite-project", "public", "data")
const eqDir = join(root, "scripts", ".cache", "eq-ohlcv")
const outPath = join(dataDir, "dbb-chart-quality-v7.json")
const reportPath = join(root, "docs", "dbb-chart-quality-v7-method.md")

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

const report = analyzePracticalUtility(v1, seriesBySymbol)
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(report)}\n`, "utf8")

const methodMd = `# DBB 실전 효용 검증 v7 — 방법과 한계

- 기준일: ${report.asOf}
- 신호: ${report.counts.signals} · 진입확정: ${report.counts.entered}
- 분할: 학습 ~${report.split.trainEndDate} (${report.counts.trainSignals}) / 검증 ${report.split.validationStartDate}~ (${report.counts.validationSignals})
- 상위 비율: v6과 동일 약 1/3 (경계 동점 포함)
- 손절 후보(사전 고정): ${report.rule.stopPcts.join(", ")}%
- 추세: 종가 < SMA${report.rule.trendMa}, 주결과는 다음날 시가 청산
- 비용: 실제 자료 없음. 왕복 ${report.rule.costAssumptionsPct.join(" / ")}% 가정 민감도만
- E: 비0 ${report.counts.e.nonzero}건 → 순위 전략 제외(참고)

## 한계
- 일봉 OHLC로 장중 체결 순서를 알 수 없음. 손절은 갭/터치 보수 가정.
- 같은 날 다수 신호는 비독립. 날짜 단위 비교를 별도 제시.
- 검증 결과를 보고 파라미터를 다시 고르지 않음.
- 효용 미입증 시 규칙 채택·자동매매 적용 없음.

## 판정
- 연구 A: ${report.overall.studyA.level} — ${report.overall.studyA.detail}
- 연구 B: ${report.overall.studyB.level} — ${report.overall.studyB.detail}
`

mkdirSync(dirname(reportPath), { recursive: true })
writeFileSync(reportPath, methodMd, "utf8")

console.log(
  JSON.stringify(
    {
      outPath,
      reportPath,
      asOf: report.asOf,
      counts: report.counts,
      studyA: Object.fromEntries(
        Object.entries(report.studyA.arms).map(([key, arm]) => [
          key,
          {
            selectedN: arm.selectedN,
            valDelta: arm.validation.diff60.deltaPriceMedian,
            sameDay: arm.sameDay.horizons["60"].gapVsMatchedMedian,
            verdict: arm.verdict.level,
          },
        ]),
      ),
      studyB: {
        hold60val: report.studyB.hold.byHorizon["60"].validation,
        judgments: report.studyB.judgments,
      },
      overall: report.overall,
    },
    null,
    2,
  ),
)
