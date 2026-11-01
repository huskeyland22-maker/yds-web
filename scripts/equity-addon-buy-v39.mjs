import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { TICKERS, runStudy } from "./lib/equity-addon-buy-v39.mjs"

const root = dirname(fileURLToPath(import.meta.url))
const prior = JSON.parse(readFileSync(join(root, ".cache", "equity-buy-validation-v38-result.json"), "utf8"))
const series = {}
for (const symbol of TICKERS) {
  series[symbol] = JSON.parse(readFileSync(join(root, ".cache", "eq-ohlcv", `${symbol}.json`), "utf8")).bars
}

let result
try {
  result = runStudy(series, { episodes: prior.episodes, fingerprint: prior.integrity.fingerprint })
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

writeFileSync(join(root, ".cache", "equity-addon-buy-v39-result.json"), JSON.stringify(result))
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

function line(cell) {
  if (!cell) return "결측"
  return `n=${cell.n} 평균 ${pct(cell.mean)} 중앙값 ${pct(cell.median)} 승률 ${pct(cell.winRate)} 25% ${pct(cell.q25)} 75% ${pct(cell.q75)}`
}

function formatReport(report) {
  const lines = []
  const names = [["BUY_AND_HOLD", "B&H"], ["BUY_PLUS_5", "BUY+5"], ["BUY_PLUS_10", "BUY+10"]]
  lines.push("[1] 데이터 무결성")
  lines.push(`종목 수 ${report.integrity.tickers}`)
  lines.push(`BUY episode ${report.integrity.episodes}`)
  lines.push(`중복 ${report.integrity.overlap}`)
  lines.push(`lookaheadViolations ${report.lookAhead.violations}`)
  lines.push(`fingerprint ${report.integrity.fingerprint}`)
  lines.push(`selectedStrategy ${report.selectedStrategy}`)

  lines.push("[2] 추가매수 발생 빈도")
  for (const horizon of [20, 60, 120]) {
    for (const [key, label] of names) {
      const row = report.strategies[key][horizon]
      lines.push(`${label} T+${horizon} 평가가능 ${row.n} 추가매수 ${row.addN} 발생률 ${pct(row.addRate)}`)
    }
  }

  lines.push("[3] 평균단가 개선")
  lines.push("동일 금액 1.0+1.0이라 평균단가는 조화평균이다.")
  for (const key of ["BUY_PLUS_5", "BUY_PLUS_10"]) {
    const row = report.cost[key]
    lines.push(`${key} n=${row.n} 평균단가 개선 평균 ${pct(row.avgImprovementMean)} 중앙값 ${pct(row.avgImprovementMedian)} 추가 1.0 수익 평균 ${pct(row.extraProfitMean)} 중앙값 ${pct(row.extraProfitMedian)}`)
    lines.push(`  추가매수 후 최저 추가하락 평균 ${pct(row.minFromAddMean)} 중앙값 ${pct(row.minFromAddMedian)}`)
  }

  lines.push("[4] B&H vs BUY+5 vs BUY+10")
  lines.push("핵심 지표는 총 투자금 대비 수익률이다.")
  for (const horizon of [20, 60, 120]) {
    lines.push(`T+${horizon}`)
    for (const [key, label] of names) {
      const row = report.strategies[key][horizon]
      lines.push(`${label} 투자금 ${line(row)}`)
      lines.push(`  최초 1.0 기준 ${line(row.initialStake)}`)
      lines.push(`  가격 ${line(row.price)} MDD ${pct(row.mdd)} -20% ${pct(row.tail20)} -30% ${pct(row.tail30)} -40% ${pct(row.tail40)}`)
    }
  }

  lines.push("[5] T+20")
  lines.push("[6] T+60")
  lines.push("[7] T+120")
  for (const horizon of [20, 60, 120]) {
    lines.push(`표 T+${horizon}`)
    lines.push("전략 | 발생률 | 평균 | 중앙값 | 승률 | MDD | -20%")
    for (const [key, label] of names) {
      const row = report.strategies[key][horizon]
      lines.push(`${label} | ${pct(row.addRate)} | ${pct(row.mean)} | ${pct(row.median)} | ${pct(row.winRate)} | ${pct(row.mdd)} | ${pct(row.tail20)}`)
    }
  }

  lines.push("[8] 추가매수 이후 tail")
  for (const key of ["BUY_PLUS_5", "BUY_PLUS_10"]) {
    const row = report.recovery[key]
    lines.push(`${key} 추가매수가 대비 -5% ${pct(row.deeper5)} -10% ${pct(row.deeper10)} -20% ${pct(row.deeper20)} -30% ${pct(row.deeper30)} -40% ${pct(row.deeper40)}`)
    lines.push(`  추가매수 후 T+60 손실 ${pct(report.loss[key][60].loss)} n=${report.loss[key][60].n}`)
    lines.push(`  추가매수 후 T+120 손실 ${pct(report.loss[key][120].loss)} <=-10% ${pct(report.loss[key][120].loss10)} <=-20% ${pct(report.loss[key][120].loss20)} n=${report.loss[key][120].n}`)
  }

  lines.push("[9] 추가매수 후 회복")
  for (const key of ["BUY_PLUS_5", "BUY_PLUS_10"]) {
    const row = report.recovery[key]
    lines.push(`${key} 추가매수가 +5% ${pct(row["rise_0.05"].rate)} 평균 T+${num(row["rise_0.05"].meanDay)} / +10% ${pct(row["rise_0.1"].rate)} / +20% ${pct(row["rise_0.2"].rate)}`)
    lines.push(`  평균단가 회복 ${pct(row.average_0.rate)} 중앙 ${num(row.average_0.medianDay)}일, +5% ${pct(row["average_0.05"].rate)}, +10% ${pct(row["average_0.1"].rate)}`)
    lines.push(`  BUY가 회복 ${pct(row.buy_0.rate)} 중앙 ${num(row.buy_0.medianDay)}일, +5% ${pct(row["buy_0.05"].rate)}, +10% ${pct(row["buy_0.1"].rate)}`)
  }

  lines.push("[10] 추가 하락 깊이")
  for (const name of ["NO_DIP", "DIP_5_10", "DIP_10_20", "DIP_20_PLUS"]) {
    const row = report.dips[name]
    lines.push(`${name} n=${row.n} ${row.sample} T+60 ${pct(row.t60.mean)} 승률 ${pct(row.t60.winRate)} T+120 ${pct(row.t120.mean)} 승률 ${pct(row.t120.winRate)} 최저점 중앙 T+${num(row.dayMedian)}`)
  }

  lines.push("[11] 31종목")
  for (const ticker of report.tickers) {
    lines.push(`${ticker.symbol} n=${ticker.episodes} ${ticker.sample} B&H 60/120 ${pct(ticker.BUY_AND_HOLD[60].mean)}/${pct(ticker.BUY_AND_HOLD[120].mean)} +5 ${pct(ticker.BUY_PLUS_5[60].mean)}/${pct(ticker.BUY_PLUS_5[120].mean)} +10 ${pct(ticker.BUY_PLUS_10[60].mean)}/${pct(ticker.BUY_PLUS_10[120].mean)}`)
  }
  for (const key of ["BUY_PLUS_5", "BUY_PLUS_10"]) {
    const row = report.breadth[key]
    lines.push(`${key} T+60 우위 ${row.better60}/${row.qualified} T+120 우위 ${row.better120}/${row.qualified} 두 구간 ${row.better}/${row.qualified}`)
  }

  lines.push("[12] 성장주")
  for (const ticker of report.focus) {
    lines.push(`${ticker.symbol} n=${ticker.episodes} ${ticker.sample} -5% ${pct(ticker.addRate5)} -10% ${pct(ticker.addRate10)} B&H ${pct(ticker.BUY_AND_HOLD[60].mean)}/${pct(ticker.BUY_AND_HOLD[120].mean)} +5 ${pct(ticker.BUY_PLUS_5[60].mean)}/${pct(ticker.BUY_PLUS_5[120].mean)} +10 ${pct(ticker.BUY_PLUS_10[60].mean)}/${pct(ticker.BUY_PLUS_10[120].mean)} MDD120 ${pct(ticker.BUY_AND_HOLD.mdd120)}/${pct(ticker.BUY_PLUS_5.mdd120)}/${pct(ticker.BUY_PLUS_10.mdd120)}`)
  }

  lines.push("[13] 통계 검증")
  lines.push("같은 episode의 짝비교이며, 같은 종목의 episode는 서로 독립이 아니다.")
  for (const key of ["BUY_PLUS_5", "BUY_PLUS_10"]) {
    for (const horizon of [60, 120]) {
      const interval = report.ci[key][horizon]
      const perm = report.permutation[key][horizon]
      lines.push(`${key} T+${horizon} 투자금 평균차 ${pp(perm.observed)} CI ${pp(interval.meanLow)} ~ ${pp(interval.meanHigh)} 중앙값 CI ${pp(interval.medianLow)} ~ ${pp(interval.medianHigh)} p ${perm.p.toFixed(3)}`)
    }
    const dollar = report.cost[key]
    lines.push(`${key} 추가 1.0 T+120 평균 ${pct(dollar.extraProfitMean)} 중앙값 ${pct(dollar.extraProfitMedian)} CI ${pct(dollar.extraCi.meanLow)} ~ ${pct(dollar.extraCi.meanHigh)}`)
  }

  lines.push("[14] 최종 판정")
  lines.push(report.judgment.label)
  const hold60 = report.strategies.BUY_AND_HOLD[60]
  const hold120 = report.strategies.BUY_AND_HOLD[120]
  const plus5s = report.strategies.BUY_PLUS_5
  const plus10s = report.strategies.BUY_PLUS_10
  lines.push("v39 결론")
  lines.push(`- BUY episode: ${report.integrity.episodes}`)
  lines.push(`- -5% 추가매수 발생률: ${pct(plus5s[120].addRate)}`)
  lines.push(`- -10% 추가매수 발생률: ${pct(plus10s[120].addRate)}`)
  lines.push(`- B&H T+60: 평균 ${pct(hold60.mean)} 중앙값 ${pct(hold60.median)} 승률 ${pct(hold60.winRate)}`)
  lines.push(`- BUY+5 T+60: 평균 ${pct(plus5s[60].mean)} 중앙값 ${pct(plus5s[60].median)} 승률 ${pct(plus5s[60].winRate)}`)
  lines.push(`- BUY+10 T+60: 평균 ${pct(plus10s[60].mean)} 중앙값 ${pct(plus10s[60].median)} 승률 ${pct(plus10s[60].winRate)}`)
  lines.push(`- B&H T+120: 평균 ${pct(hold120.mean)} 중앙값 ${pct(hold120.median)} 승률 ${pct(hold120.winRate)}`)
  lines.push(`- BUY+5 T+120: 평균 ${pct(plus5s[120].mean)} 중앙값 ${pct(plus5s[120].median)} 승률 ${pct(plus5s[120].winRate)}`)
  lines.push(`- BUY+10 T+120: 평균 ${pct(plus10s[120].mean)} 중앙값 ${pct(plus10s[120].median)} 승률 ${pct(plus10s[120].winRate)}`)
  lines.push(`- 추가매수의 평균단가 개선: +5 ${pct(report.cost.BUY_PLUS_5.avgImprovementMedian)} / +10 ${pct(report.cost.BUY_PLUS_10.avgImprovementMedian)}`)
  lines.push(`- 추가매수의 tail risk: +5 T+120 -20% ${pct(plus5s[120].tail20)} / +10 ${pct(plus10s[120].tail20)} / B&H ${pct(hold120.tail20)}`)
  lines.push(`- 31종목 중 B&H 대비 우위 종목 수: +5 ${report.breadth.BUY_PLUS_5.better}/${report.breadth.BUY_PLUS_5.qualified} / +10 ${report.breadth.BUY_PLUS_10.better}/${report.breadth.BUY_PLUS_10.qualified}`)
  const focusOk = (key) => report.focus.filter((ticker) => ticker.BUY_AND_HOLD[120].n >= 10 && ticker[key][120].mean >= ticker.BUY_AND_HOLD[120].mean).length
  lines.push(`- 성장주 결과: T+120 평균이 B&H 이상인 종목 +5 ${focusOk("BUY_PLUS_5")}/6 / +10 ${focusOk("BUY_PLUS_10")}/6`)
  lines.push(`- 통계적 유의성: ${report.judgment.label}`)
  lines.push(`- 추가매수 전략 판단: ${report.judgment.label}`)
  lines.push("- production 변경 여부: 변경 없음")
  lines.push("- selectedStrategy: null")
  return lines.join("\n")
}
