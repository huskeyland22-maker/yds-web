import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { TICKERS, runStudy } from "./lib/equity-buy-validation-v38.mjs"

const root = dirname(fileURLToPath(import.meta.url))
const prior = JSON.parse(readFileSync(join(root, "data", "equity-weekly-trend-sell-v1.json"), "utf8"))
const series = {}
for (const symbol of TICKERS) {
  series[symbol] = JSON.parse(readFileSync(join(root, ".cache", "eq-ohlcv", `${symbol}.json`), "utf8")).bars
}
const spy = JSON.parse(readFileSync(join(root, ".cache", "eq-ohlcv", "SPY.json"), "utf8")).bars

let result
try {
  result = runStudy(series, prior.buy.counts, spy)
} catch (error) {
  if (error.lines) {
    console.log("episode identity mismatch")
    console.log(error.lines.join("\n"))
    process.exit(1)
  }
  if (error.violations) {
    console.log(`lookaheadViolations ${error.violations.length}`)
    console.log(JSON.stringify(error.violations.slice(0, 8), null, 2))
    process.exit(1)
  }
  throw error
}

writeFileSync(join(root, ".cache", "equity-buy-validation-v38-result.json"), JSON.stringify(result))
console.log(formatReport(result))

function pct(value) {
  if (value == null || Number.isNaN(value)) return "결측"
  return `${(value * 100).toFixed(2)}%`
}

function pp(value) {
  if (value == null || Number.isNaN(value)) return "결측"
  return `${(value * 100).toFixed(2)}%p`
}

function num(value) {
  if (value == null || Number.isNaN(value)) return "결측"
  return Number(value).toFixed(1)
}

function perf(cell) {
  if (!cell) return "결측"
  return `n=${cell.n} 평균 ${pct(cell.mean)} 중앙값 ${pct(cell.median)} 승률 ${pct(cell.winRate)} 25% ${pct(cell.q25)} 75% ${pct(cell.q75)}`
}

function formatReport(report) {
  const lines = []
  const buy = report.buy
  lines.push("[1] 데이터 무결성")
  lines.push(`종목 수 ${report.integrity.tickers}`)
  lines.push(`기간 ${report.integrity.from} ~ ${report.integrity.to}`)
  lines.push(`BUY episode ${report.integrity.episodes}`)
  lines.push(`중복 episode ${report.integrity.overlap}`)
  lines.push(`lookaheadViolations ${report.lookAhead.violations}`)
  lines.push(`selectedStrategy ${report.selectedStrategy}`)
  lines.push(`fingerprint ${report.integrity.fingerprint}`)
  lines.push(report.integrity.dependence)

  lines.push("[2] BUY 전체 성능")
  for (const horizon of [1, 3, 5, 10, 20, 40, 60, 120]) lines.push(`T+${horizon} ${perf(buy.performance[horizon])}`)

  lines.push("[3] BUY 이후 경로")
  for (const horizon of [20, 60, 120]) {
    const row = buy.drawdowns[horizon]
    lines.push(`T+${horizon} MDD 평균 ${pct(row.mean)} 중앙값 ${pct(row.median)} -5% ${pct(row.hit5)} -10% ${pct(row.hit10)} -20% ${pct(row.hit20)} n=${row.n}`)
  }

  lines.push("[4] 저점 포착력")
  const trough = buy.trough
  lines.push(`추가 하락 평균 ${pct(trough.extraMean)} 중앙값 ${pct(trough.extraMedian)} 추가 저점 없음 ${pct(trough.noFurtherLowRate)} n=${trough.n}`)
  lines.push(`최저가 시점 평균 T+${num(trough.dayMean)} 중앙값 T+${num(trough.dayMedian)}`)
  lines.push(`최저가 이후 BUY 대비 회복 평균 ${pct(trough.recoveryFromBuyMean)} 중앙값 ${pct(trough.recoveryFromBuyMedian)}`)
  lines.push(`이후 60일 저가와의 거리 평균 ${pct(trough.gapToFutureLowMean)} 중앙값 ${pct(trough.gapToFutureLowMedian)}`)
  lines.push(`진입 당시 과거 60일 저가와의 거리 평균 ${pct(trough.gapToTrailingLowMean)} 중앙값 ${pct(trough.gapToTrailingLowMedian)}`)

  lines.push("[5] 반등 포착력")
  for (const target of [0.03, 0.05, 0.1, 0.15, 0.2]) {
    const row = buy.reach[target]
    lines.push(`+${target * 100}% 도달률 ${pct(row.rate)} 평균 T+${num(row.meanDay)} 중앙값 T+${num(row.medianDay)} n=${row.n} ${row.sample}`)
  }

  lines.push("[6] 3조건 vs 4조건")
  lines.push("설명용 비교이며 조건 개수를 바꾸지 않는다.")
  for (const count of [3, 4]) {
    const row = report.countGroups[count]
    lines.push(`${count}개 n=${row.n} ${row.sample} T+20 ${pct(row.t20.mean)} T+60 ${pct(row.t60.mean)} T+120 ${pct(row.t120.mean)} 승률60 ${pct(row.t60.winRate)} MDD60 ${pct(row.mdd60.mean)} +10% ${pct(row.reach10.rate)}`)
  }

  lines.push("[7] 개별 조건 참고")
  lines.push("단일 조건 BUY는 만들지 않는다.")
  for (const [key, row] of Object.entries(report.flagStats)) {
    lines.push(`${key} 충족 ${pct(row.share)} n=${row.n} T+20 ${pct(row.t20.mean)} T+60 ${pct(row.t60.mean)} T+120 ${pct(row.t120.mean)} ${row.sample}`)
  }

  lines.push("조건 조합은 참고만 하고 가장 좋은 조합을 선택하지 않는다.")
  for (const row of report.pairs) lines.push(`쌍 ${row.keys} ${row.n}건 ${pct(row.share)}`)
  for (const row of report.trios) lines.push(`3조건 ${row.keys} n=${row.n} ${row.sample} T+20 ${pct(row.t20.mean)} T+60 ${pct(row.t60.mean)} T+120 ${pct(row.t120.mean)}`)

  lines.push("[8] 시장 상황별")
  lines.push(`SPY 20일 평균 ${pct(report.regimeContext.spy20Mean)} SPY 60일 평균 ${pct(report.regimeContext.spy60Mean)} 미분류 ${report.regimeContext.missing}`)
  for (const name of ["강세", "중립", "약세"]) {
    const row = report.regimes[name]
    lines.push(`${name} n=${row.n} ${row.sample} T+20 ${pct(row.t20.mean)} T+60 ${pct(row.t60.mean)} T+120 ${pct(row.t120.mean)} 승률60 ${pct(row.t60.winRate)}`)
  }

  lines.push("[9] BUY vs Random")
  lines.push(`seed ${report.random.seed}`)
  for (const horizon of [20, 60, 120]) {
    lines.push(`BUY T+${horizon} ${perf(buy.performance[horizon])}`)
    lines.push(`Random T+${horizon} ${perf(report.randomSample.performance[horizon])}`)
    const gap = report.comparison[horizon]
    lines.push(`차이 평균 ${pp(gap?.mean)} 중앙값 ${pp(gap?.median)} 승률 ${pp(gap?.winRate)}`)
  }
  lines.push(`+10% 도달 BUY ${pct(buy.reach[0.1].rate)} Random ${pct(report.randomSample.reach[0.1].rate)} 차이 ${pp(report.comparison.reach10)}`)
  lines.push(`MDD60 BUY ${pct(buy.drawdowns[60].mean)} Random ${pct(report.randomSample.drawdowns[60].mean)} 차이 ${pp(report.comparison.mdd60)}`)
  lines.push(`MDD120 BUY ${pct(buy.drawdowns[120].mean)} Random ${pct(report.randomSample.drawdowns[120].mean)} 차이 ${pp(report.comparison.mdd120)}`)

  lines.push("[10] 31종목별")
  for (const ticker of report.tickers) {
    lines.push(`${ticker.symbol} n=${ticker.episodes} ${ticker.sample} T+20 ${pct(ticker.t20.mean)}/${pct(ticker.t20.median)} T+60 ${pct(ticker.t60.mean)}/${pct(ticker.t60.median)} 승률 ${pct(ticker.t60.winRate)} T+120 ${pct(ticker.t120.mean)}/${pct(ticker.t120.median)} +10% ${pct(ticker.reach10.rate)} 추가하락 ${pct(ticker.extraMedian)}`)
  }

  lines.push("[11] 성장주 6종목")
  for (const ticker of report.focus) {
    lines.push(`${ticker.symbol} n=${ticker.episodes} ${ticker.sample} T+20 ${pct(ticker.t20.mean)} T+60 ${pct(ticker.t60.mean)} T+120 ${pct(ticker.t120.mean)} +10% ${pct(ticker.reach10.rate)} 추가하락 ${pct(ticker.extraMedian)}`)
  }

  lines.push("[12] EARLY_RISE / DIP_THEN_RISE / SIDEWAYS / FAILED")
  lines.push(`분류 ${buy.paths.classified} 미분류 ${buy.paths.unclassified}`)
  for (const name of ["EARLY_RISE", "DIP_THEN_RISE", "SIDEWAYS", "FAILED", "OTHER"]) {
    lines.push(`${name} ${buy.paths.counts[name]} ${pct(buy.paths.share[name])}`)
  }

  lines.push("[13] 통계 검증")
  lines.push(report.integrity.dependence)
  for (const horizon of [60, 120]) {
    const interval = report.ci[horizon]
    const perm = report.permutation[horizon]
    lines.push(`T+${horizon} 평균 차이 ${pp(perm.observed)} CI ${pp(interval.meanLow)} ~ ${pp(interval.meanHigh)} 중앙값 CI ${pp(interval.medianLow)} ~ ${pp(interval.medianHigh)} permutation p ${perm.p.toFixed(3)}`)
  }
  lines.push(`종목 비교 ${report.breadth.qualified}개 중 두 구간 모두 앞선 종목 ${report.breadth.better}개`)

  lines.push("[14] 최종 판정")
  lines.push(report.judgment.label)
  const t20 = buy.performance[20]
  const t60 = buy.performance[60]
  const t120 = buy.performance[120]
  lines.push("v38 결론")
  lines.push(`- BUY episode: ${report.integrity.episodes}`)
  lines.push(`- BUY 이후 T+20: 평균 ${pct(t20.mean)} 중앙값 ${pct(t20.median)} 승률 ${pct(t20.winRate)}`)
  lines.push(`- BUY 이후 T+60: 평균 ${pct(t60.mean)} 중앙값 ${pct(t60.median)} 승률 ${pct(t60.winRate)}`)
  lines.push(`- BUY 이후 T+120: 평균 ${pct(t120.mean)} 중앙값 ${pct(t120.median)} 승률 ${pct(t120.winRate)}`)
  lines.push(`- +10% 도달률: ${pct(buy.reach[0.1].rate)}`)
  lines.push(`- 최대 추가하락: 중앙값 ${pct(trough.extraMedian)} 평균 ${pct(trough.extraMean)}`)
  lines.push(`- BUY vs Random: T+60 평균 차이 ${pp(report.comparison[60].mean)} T+120 평균 차이 ${pp(report.comparison[120].mean)}`)
  lines.push(`- BUY의 독립적인 우위: ${report.judgment.label}`)
  lines.push(`- 31종목 일관성: ${report.breadth.better}/${report.breadth.qualified}`)
  lines.push(`- BUY 개선 필요 여부: ${report.judgment.improvement}`)
  lines.push(`- SELL 연구 재개 여부: ${report.judgment.sellResearch}`)
  lines.push(`- production 변경 여부: ${report.productionChanged ? "변경" : "변경 없음"}`)
  lines.push("- selectedStrategy: null")
  return lines.join("\n")
}
