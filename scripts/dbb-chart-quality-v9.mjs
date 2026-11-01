/**
 * Generate DBB signal-strength robustness v9 JSON.
 * node scripts/dbb-chart-quality-v9.mjs
 * Does not modify v1~v8 files, DBB engine, or trade records.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { analyzeRobustness } from "./lib/dbb-chart-quality-v9.mjs"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const dataDir = join(root, "vite-project", "public", "data")
const eqDir = join(root, "scripts", ".cache", "eq-ohlcv")
const outPath = join(dataDir, "dbb-chart-quality-v9.json")
const reportPath = join(root, "docs", "dbb-chart-quality-v9-method.md")

function loadBars(symbol) {
  const path = join(eqDir, `${symbol}.json`)
  if (!existsSync(path)) return null
  const raw = JSON.parse(readFileSync(path, "utf8"))
  const bars = Array.isArray(raw?.bars) ? raw.bars : Array.isArray(raw) ? raw : null
  return bars?.length ? bars : null
}

const v1 = JSON.parse(readFileSync(join(dataDir, "dbb-chart-quality-v1.json"), "utf8"))
const v8 = JSON.parse(readFileSync(join(dataDir, "dbb-chart-quality-v8.json"), "utf8"))
const qqqBars = loadBars("QQQ") || []

const report = analyzeRobustness(v1, v8, qqqBars)
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(report)}\n`, "utf8")

const lo = report.studyA?.leaveOutValidation?.summary
const methodMd = `# DBB 신호 강도 검증 v9 — 방법과 한계

- 기준일: ${report.asOf}
- 목적: v8의 3개 vs 4개 차이가 종목 편중·국면·QQQ 초과수익·날짜 상관에 의존하는지 재검증
- 분할: 학습 ~${report.split?.trainEndDate} / 검증 ${report.split?.validationStartDate}~ (v1·v7·v8과 동일)
- v8 재현: ${report.v8Match?.ok ? "일치" : "불일치"} · 게시 초과차 목표 ${report.rule?.v8ExcessOverall60Expected}%p → 재현 ${report.studyC?.reproducedExcessDiffPp}%p
- 국면: ETF 신호 국면 v3와 동일 (QQQ MA50/MA200/20일 기울기, 신호일 종가만)

## 연구
- A 종목 편중: leave-one-ticker-out. 검증 중앙값 부호반전 ${lo?.flipMedianCount ?? "—"} · 성공률 부호반전 ${lo?.flipSuccessCount ?? "—"}
- B 국면: 상승/하락/횡보 전부 공개. 표본 부족 국면은 탐색적으로만 표시
- C 초과수익: 절대수익과 분리. 동일 보유기간 QQQ 차감
- D 날짜 단위: v8과 같은 날짜 그룹 부트스트랩. CI가 0을 포함하면 판정을 바꾸지 않음

## 한계
- 같은 날 다수 신호는 비독립
- 국면은 QQQ 추세 정의이며 개별 종목 국면이 아님
- 상위 기여 종목 제외는 민감도용이며 유니버스 변경이 아님
- 효용 미입증 시 규칙 채택·자동매매 적용 없음

## 판정 (사전 고정)
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
      aborted: report.aborted,
      v8Match: report.v8Match,
      counts: report.counts,
      studyA: {
        leaveOutValidation: report.studyA?.leaveOutValidation?.summary,
        dropTop3: report.studyA?.dropTop3Contributors,
      },
      studyB: Object.fromEntries(
        Object.entries(report.studyB?.regimes || {}).map(([key, block]) => [
          key,
          {
            n3: block.n3,
            n4: block.n4,
            exploratory: block.exploratory,
            diff60: block.byHorizon?.["60"]?.diff,
          },
        ]),
      ),
      studyC: report.studyC,
      studyD: {
        overall: {
          paired: report.studyD?.overall?.pairedDates,
          gap: report.studyD?.overall?.returnGapMedian,
          boot: report.studyD?.overall?.bootstrapReturn,
        },
        validation: {
          paired: report.studyD?.validation?.pairedDates,
          gap: report.studyD?.validation?.returnGapMedian,
          boot: report.studyD?.validation?.bootstrapReturn,
        },
      },
      verdict: report.verdict,
    },
    null,
    2,
  ),
)
