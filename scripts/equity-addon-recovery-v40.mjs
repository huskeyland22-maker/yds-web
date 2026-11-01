import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { TICKERS, runRecoveryStudy } from "./lib/equity-addon-recovery-v40.mjs"

const root = dirname(fileURLToPath(import.meta.url))
const prior = JSON.parse(readFileSync(join(root, ".cache", "equity-buy-validation-v38-result.json"), "utf8"))
const v39 = JSON.parse(readFileSync(join(root, ".cache", "equity-addon-buy-v39-result.json"), "utf8"))
const series = {}
for (const symbol of TICKERS) {
  series[symbol] = JSON.parse(readFileSync(join(root, ".cache", "eq-ohlcv", `${symbol}.json`), "utf8")).bars
}

let result
try {
  result = runRecoveryStudy(series, { episodes: prior.episodes, fingerprint: prior.integrity.fingerprint }, {
    add5: v39.strategies.BUY_PLUS_5[120].addN,
    add10: v39.strategies.BUY_PLUS_10[120].addN,
  })
} catch (error) {
  if (error.lines) {
    console.log(error.message)
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

writeFileSync(join(root, ".cache", "equity-addon-recovery-v40-result.json"), JSON.stringify(result))

const BUCKET_LABEL = {
  A: "A 추가하락 5% 미만",
  B: "B -5% ~ -10% 미만",
  C: "C -10% ~ -20% 미만",
  D: "D -20% ~ -30% 미만",
  E: "E -30% ~ -40% 미만",
  F: "F -40% 이하",
}

const TIMING_LABEL = {
  D0: "추가하락 없음",
  D1_5: "T+1~5",
  D6_10: "T+6~10",
  D11_20: "T+11~20",
  D21_40: "T+21~40",
  D41_60: "T+41~60",
  D61_120: "T+61~120",
}

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

function cell(stats) {
  if (!stats || !stats.n) return "결측"
  return `n=${stats.n} 평균 ${pct(stats.mean)} 중앙값 ${pct(stats.median)} 승률 ${pct(stats.winRate)}`
}

function formatReport(report) {
  const lines = []
  const add5 = report.strategies.ADD5
  const add10 = report.strategies.ADD10
  lines.push(`1. 한 줄 결론`)
  lines.push(report.judgment.label)
  lines.push("2. 데이터 무결성")
  lines.push(`종목 수 ${report.integrity.tickers}`)
  lines.push(`BUY episode ${report.integrity.episodes}`)
  lines.push(`ADD5 ${report.integrity.add5} 그중 추가매수 후 T+120 ${report.integrity.add5Full}`)
  lines.push(`ADD10 ${report.integrity.add10} 그중 추가매수 후 T+120 ${report.integrity.add10Full}`)
  lines.push(`중복 ${report.integrity.overlap}`)
  lines.push(`lookaheadViolations ${report.lookAhead.violations}`)
  lines.push(`fingerprint ${report.integrity.fingerprint}`)
  lines.push(`selectedStrategy ${report.selectedStrategy}`)

  lines.push("3. ADD5 / ADD10 전체")
  lines.push("수익률은 추가매수 가격 기준이다. 추가매수 당일 종가는 회복 계산에서 제외한다.")
  for (const [name, block] of [["ADD5", add5], ["ADD10", add10]]) {
    for (const horizon of [5, 10, 20, 40, 60, 120]) {
      const row = block.overall[horizon]
      lines.push(`${name} T+${horizon} ${cell(row)} MDD ${pct(row.mddMean)} 최저 ${pct(row.minMedian)} 최고 ${pct(row.maxMean)}`)
    }
  }

  lines.push("4. 추가매수 후 최대 추가하락")
  lines.push("구간은 추가매수 후 T+120 최저가 기준이다. 경계의 정확한 값은 더 깊은 구간에 둔다.")
  for (const [name, block] of [["ADD5", add5], ["ADD10", add10]]) {
    for (const key of ["A", "B", "C", "D", "E", "F"]) {
      const row = block.buckets[key]
      const h20 = row.horizons[20]
      const h60 = row.horizons[60]
      const h120 = row.horizons[120]
      lines.push(`${name} ${BUCKET_LABEL[key]} n=${row.n} ${row.sample} 저점중앙 T+${num(row.lowDayMedian)}`)
      lines.push(`  T+20 ${pct(h20.mean)}/${pct(h20.median)} 승률 ${pct(h20.winRate)}`)
      lines.push(`  T+60 ${pct(h60.mean)}/${pct(h60.median)} 승률 ${pct(h60.winRate)} -10% ${pct(h60.loss10)}`)
      lines.push(`  T+120 ${pct(h120.mean)}/${pct(h120.median)} 승률 ${pct(h120.winRate)} -10% ${pct(h120.loss10)} -20% ${pct(h120.loss20)}`)
    }
  }

  lines.push("5. BUY 가격 회복")
  for (const [name, block] of [["ADD5", add5], ["ADD10", add10]]) {
    const row = block.overall[120].buy
    lines.push(`${name} T+120 회복 ${pct(row.rate)} 미회복 ${pct(row.unrecovered)} 회복일 평균 ${num(row.meanDay)} 중앙 ${num(row.medianDay)} n=${row.n}`)
    for (const horizon of [20, 40, 60]) {
      lines.push(`  T+${horizon} ${pct(block.overall[horizon].buy.rate)}`)
    }
    for (const key of ["A", "B", "C", "D", "E", "F"]) {
      const buy = block.buckets[key].horizons[120].buy
      lines.push(`  ${key} n=${buy.n} 회복 ${pct(buy.rate)} 미회복 ${pct(buy.unrecovered)} 중앙 ${num(buy.medianDay)}일`)
    }
  }

  lines.push("6. ADD 가격 회복")
  lines.push("여기의 회복은 추가매수 다음 날부터 처음 되돌아온 시점이다. 그 뒤에 더 깊은 저점이 올 수 있다.")
  for (const [name, block] of [["ADD5", add5], ["ADD10", add10]]) {
    for (const key of ["ALL", "A", "B", "C", "D", "E", "F"]) {
      const source = key === "ALL" ? block.overall : block.buckets[key].horizons
      const days = source[120].add
      lines.push(`${name} ${key} T+20 ${pct(source[20].add.rate)} T+40 ${pct(source[40].add.rate)} T+60 ${pct(source[60].add.rate)} T+120 ${pct(source[120].add.rate)} 중앙 ${num(days.medianDay)}일 n=${days.n}`)
    }
  }

  lines.push("7. 평균단가 회복")
  for (const [name, block] of [["ADD5", add5], ["ADD10", add10]]) {
    const row = block.overall[120]
    lines.push(`${name} T+120 평균단가 ${pct(row.average.rate)} / BUY ${pct(row.buy.rate)} / ADD ${pct(row.add.rate)}`)
    for (const horizon of [20, 40, 60, 120]) {
      const item = block.overall[horizon]
      lines.push(`  T+${horizon} 평균단가 ${pct(item.average.rate)} BUY ${pct(item.buy.rate)} ADD ${pct(item.add.rate)}`)
    }
  }

  lines.push("8. 깊은 추가하락")
  for (const [name, block] of [["ADD5", add5], ["ADD10", add10]]) {
    for (const level of [0.1, 0.2, 0.3, 0.4]) {
      const row = block.deep[level]
      const end = row.t120
      lines.push(`${name} -${level * 100}% 이하 n=${row.n} ${row.sample}`)
      lines.push(`  T+20 ${pct(row.t20.mean)} T+60 ${pct(row.t60.mean)}/${pct(row.t60.median)} 승률 ${pct(row.t60.winRate)}`)
      lines.push(`  T+120 ${pct(end.mean)}/${pct(end.median)} 승률 ${pct(end.winRate)} -10% ${pct(end.loss10)} MDD ${pct(end.mddMean)}`)
      lines.push(`  저점 이전 터치 BUY ${pct(end.buy.rate)} ADD ${pct(end.add.rate)} 평균단가 ${pct(end.average.rate)}`)
      lines.push(`  저점 이후 회복 BUY ${pct(end.buyAfterLow.rate)} ADD ${pct(end.addAfterLow.rate)} 평균단가 ${pct(end.averageAfterLow.rate)}`)
    }
  }

  lines.push("9. 저점 시점")
  for (const [name, block] of [["ADD5", add5], ["ADD10", add10]]) {
    for (const key of Object.keys(TIMING_LABEL)) {
      const row = block.timing[key]
      lines.push(`${name} ${TIMING_LABEL[key]} n=${row.n} ${row.sample} 추가하락 평균 ${pct(row.minMean)} 중앙값 ${pct(row.minMedian)}`)
    }
  }

  lines.push("10. 추가 1.0의 손익")
  lines.push("추가 투입 1.0의 수익률은 미래 종가 / 추가매수가 - 1 이다. 혼합 수익률은 같은 금액을 더 싼 가격에 넣은 계산값이다.")
  for (const [name, block] of [["ADD5", add5], ["ADD10", add10]]) {
    for (const horizon of [20, 40, 60, 120]) {
      const row = block.overall[horizon]
      lines.push(`${name} T+${horizon} 추가1.0 ${pct(row.incremental.mean)}/${pct(row.incremental.median)} 승률 ${pct(row.incremental.winRate)} 기존1.0 ${pct(row.original.mean)} 혼합 ${pct(row.blended.mean)}`)
    }
  }

  lines.push("11. 종목별 위험")
  for (const [name, block] of [["ADD5", add5], ["ADD10", add10]]) {
    for (const ticker of block.tickers) {
      lines.push(`${name} ${ticker.symbol} 추가 ${ticker.addN} T+120 n=${ticker.n} ${ticker.sample} 최저중앙 ${pct(ticker.minMedian)} T+60 ${pct(ticker.t60)} T+120 ${pct(ticker.t120)} BUY회복 ${pct(ticker.buyRecovery)} ADD회복 ${pct(ticker.addRecovery)} 평균단가 ${pct(ticker.avgRecovery)}`)
    }
  }
  lines.push("성장주")
  for (const symbol of ["NVDA", "AMD", "AVGO", "CRWD", "PLTR", "TSLA"]) {
    for (const [name, block] of [["ADD5", add5], ["ADD10", add10]]) {
      const ticker = block.tickers.find((row) => row.symbol === symbol)
      lines.push(`${name} ${ticker.symbol} n=${ticker.n} ${ticker.sample} T+60 ${pct(ticker.t60)} T+120 ${pct(ticker.t120)} ADD회복 ${pct(ticker.addRecovery)} BUY회복 ${pct(ticker.buyRecovery)}`)
    }
  }

  lines.push("12. 통계 검증")
  lines.push("비교는 추가매수 후 -20% 이하 그룹에서 -20% 미만 그룹을 뺀 값이다. 종목 단위로 다시 뽑았고, 라벨도 종목 안에서만 섞었다.")
  for (const [name, block] of [["ADD5", add5], ["ADD10", add10]]) {
    lines.push(`${name} 얕은 n=${block.shallow.n} T+60 ${pct(block.shallow.t60.mean)}/${pct(block.shallow.t60.median)} 승률 ${pct(block.shallow.t60.winRate)}`)
    lines.push(`  T+120 ${pct(block.shallow.t120.mean)}/${pct(block.shallow.t120.median)} 승률 ${pct(block.shallow.t120.winRate)} 저점 이후 BUY ${pct(block.shallow.t120.buyAfterLow.rate)} ADD ${pct(block.shallow.t120.addAfterLow.rate)} 평균단가 ${pct(block.shallow.t120.averageAfterLow.rate)}`)
    lines.push(`${name} 깊음 n=${block.deep20.n} T+60 ${pct(block.deep20.t60.mean)}/${pct(block.deep20.t60.median)} 승률 ${pct(block.deep20.t60.winRate)}`)
    lines.push(`  T+120 ${pct(block.deep20.t120.mean)}/${pct(block.deep20.t120.median)} 승률 ${pct(block.deep20.t120.winRate)} 저점 이후 BUY ${pct(block.deep20.t120.buyAfterLow.rate)} ADD ${pct(block.deep20.t120.addAfterLow.rate)} 평균단가 ${pct(block.deep20.t120.averageAfterLow.rate)}`)
    for (const horizon of [60, 120]) {
      const row = block.contrast[horizon]
      lines.push(`${name} T+${horizon} 평균차 ${pp(row.permutation.observed)} CI ${pp(row.meanLow)} ~ ${pp(row.meanHigh)} 중앙값차 CI ${pp(row.medianLow)} ~ ${pp(row.medianHigh)} p ${row.permutation.p == null ? "결측" : row.permutation.p.toFixed(3)}`)
    }
  }

  lines.push("13. 해석")
  lines.push("구간 분류는 추가매수 이후 실제로 기록된 최저가를 본 것이다. 추가매수 시점에 그 깊이를 알 수는 없다.")
  lines.push("14. 최종 판정")
  lines.push(report.judgment.label)
  for (const name of ["ADD5", "ADD10"]) {
    const verdict = report.judgment.verdicts[name]
    const missed = Object.entries(verdict.checks).filter(([, ok]) => !ok).map(([key]) => key)
    lines.push(`${name} ${verdict.pass ? "기준 충족" : "기준 미달"} ${missed.join(", ") || "없음"}`)
  }
  lines.push("15. production 영향")
  lines.push("- BUY 변경 여부: 변경 없음")
  lines.push("- SELL 변경 여부: 변경 없음")
  lines.push("- ADD 변경 여부: 변경 없음")
  lines.push("- selectedStrategy: null")
  lines.push("- production 변경: 없음")
  return lines.join("\n")
}
