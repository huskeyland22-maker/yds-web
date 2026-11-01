import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { TICKERS, runStudy } from "./lib/equity-trend-state-research-v37.mjs"

const root = dirname(fileURLToPath(import.meta.url))
const prior = JSON.parse(readFileSync(join(root, "data", "equity-weekly-trend-sell-v1.json"), "utf8"))
const series = {}
for (const symbol of TICKERS) {
  const raw = JSON.parse(readFileSync(join(root, ".cache", "eq-ohlcv", `${symbol}.json`), "utf8"))
  series[symbol] = raw.bars
}

let result
try {
  result = runStudy(series, prior.buy.counts)
} catch (error) {
  if (error.violations) {
    console.log(`lookaheadViolations ${error.violations.length}`)
    console.log(JSON.stringify(error.violations.slice(0, 8), null, 2))
    process.exit(1)
  }
  throw error
}
if (result.lookAhead.violations !== 0) {
  console.log(`lookaheadViolations ${result.lookAhead.violations}`)
  process.exit(1)
}

writeFileSync(join(root, ".cache", "equity-trend-state-research-v37-result.json"), JSON.stringify(result))
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

function cellText(cell) {
  if (!cell) return "결측"
  return `n=${cell.n} 평균 ${pct(cell.mean)} 중앙값 ${pct(cell.median)} 승률 ${pct(cell.winRate)} MDD ${pct(cell.mdd)}`
}

function formatReport(report) {
  const lines = []
  const { integrity, distribution, forward, diffs, duration, cautionExits, recovery, judgment } = report
  lines.push("[1] 데이터 무결성")
  lines.push(`종목 수 ${integrity.tickers}`)
  lines.push(`데이터 기간 ${integrity.from} ~ ${integrity.to}`)
  lines.push(`상태 일수 HOLD ${integrity.dayCounts.HOLD} / CAUTION ${integrity.dayCounts.CAUTION} / RISK ${integrity.dayCounts.RISK} / 미정 ${integrity.dayCounts.none}`)
  lines.push(`상태 진입 HOLD ${integrity.entries.HOLD} / CAUTION ${integrity.entries.CAUTION} / RISK ${integrity.entries.RISK}`)
  lines.push(`상태 전환 ${integrity.transitionTotal}`)
  for (const [kind, count] of Object.entries(integrity.transitions)) lines.push(`  ${kind} ${count}`)
  lines.push(`lookaheadViolations ${report.lookAhead.violations}`)
  lines.push(`episode 수 ${integrity.episodes}`)
  lines.push(`BUY 당시 상태 HOLD ${integrity.buyState.HOLD} / CAUTION ${integrity.buyState.CAUTION} / RISK ${integrity.buyState.RISK} / 미정 ${integrity.buyState.none}`)
  lines.push(`BUY 이후 새 CAUTION ${integrity.laterCaution.n}건, 중앙값 ${num(integrity.laterCaution.medianDays)}거래일`)
  lines.push(`BUY 이후 새 RISK ${integrity.laterRisk.n}건, 중앙값 ${num(integrity.laterRisk.medianDays)}거래일, 진입 수익률 중앙값 ${pct(integrity.laterRisk.medianReturn)}`)

  lines.push("[2] 전체 상태 분포")
  lines.push(`HOLD ${pct(distribution.HOLD)}`)
  lines.push(`CAUTION ${pct(distribution.CAUTION)}`)
  lines.push(`RISK ${pct(distribution.RISK)}`)

  lines.push("[3] 상태별 미래 수익률")
  lines.push("상태 | n | T+20 | T+60 | T+120 | 승률 | MDD")
  for (const state of ["HOLD", "CAUTION", "RISK"]) {
    const row = [20, 60, 120].map((horizon) => forward[state][horizon])
    lines.push([
      state,
      `20:${row[0].n} 60:${row[1].n} 120:${row[2].n}`,
      pct(row[0].mean),
      pct(row[1].mean),
      pct(row[2].mean),
      [20, 60, 120].map((horizon) => pct(forward[state][horizon].winRate)).join(" / "),
      [20, 60, 120].map((horizon) => pct(forward[state][horizon].mdd)).join(" / "),
    ].join(" | "))
    lines.push(`  중앙값 T+20 ${pct(row[0].median)} / T+60 ${pct(row[1].median)} / T+120 ${pct(row[2].median)}`)
  }

  lines.push("[4] HOLD 대비 차이")
  lines.push("비교 | T+20 차이 | T+60 차이 | T+120 차이")
  for (const name of ["CAUTION-HOLD", "RISK-HOLD"]) {
    lines.push(`${name} 평균 | ${[20, 60, 120].map((horizon) => pp(diffs[name][horizon]?.mean)).join(" | ")}`)
    lines.push(`${name} 중앙값 | ${[20, 60, 120].map((horizon) => pp(diffs[name][horizon]?.median)).join(" | ")}`)
    lines.push(`${name} 승률 | ${[20, 60, 120].map((horizon) => pp(diffs[name][horizon]?.winRate)).join(" | ")}`)
  }

  lines.push("[5] RISK 위험도")
  for (const horizon of [20, 60, 120]) {
    const risk = forward.RISK[horizon]
    const hold = forward.HOLD[horizon]
    lines.push(`T+${horizon} ${cellText(risk)}`)
    lines.push(`  -5% ${pct(risk.hit5)} / -10% ${pct(risk.hit10)} / -20% ${pct(risk.hit20)}`)
    lines.push(`  같은 기간 HOLD -5% ${pct(hold.hit5)} / -10% ${pct(hold.hit10)} / -20% ${pct(hold.hit20)}`)
  }
  lines.push(`T+120 비교 가능 종목 ${report.breadth.qualified}, 그중 RISK 평균이 더 낮은 종목 ${report.breadth.worse}`)

  lines.push("[6] 상태 지속기간")
  for (const state of ["HOLD", "CAUTION", "RISK"]) {
    const row = duration[state].all
    const done = duration[state].completed
    lines.push(`${state} 전체 평균 ${num(row.mean)} 중앙값 ${num(row.median)} 최소 ${num(row.min)} 최대 ${num(row.max)} (n=${row.n})`)
    lines.push(`${state} 종료된 구간 평균 ${num(done.mean)} 중앙값 ${num(done.median)} 최소 ${num(done.min)} 최대 ${num(done.max)} (n=${done.n})`)
  }
  const cautionDone = cautionExits.hold + cautionExits.risk
  lines.push(`CAUTION → HOLD ${cautionExits.hold} / CAUTION → RISK ${cautionExits.risk} / 진행 중 ${cautionExits.open}`)
  lines.push(`종료된 CAUTION 중 HOLD 비율 ${pct(cautionDone ? cautionExits.hold / cautionDone : null)}`)

  lines.push("[7] RISK 회복")
  lines.push(`RISK 진입 ${recovery.spells}, 표본 종료 시 진행 중 ${recovery.open}`)
  lines.push(`이후 20W > 60W ${pct(recovery.maRate)}, 거래일 평균 ${num(recovery.daysToMa.mean)} 중앙값 ${num(recovery.daysToMa.median)}`)
  lines.push(`이후 Weekly Close > 20W ${pct(recovery.closeRate)}, 거래일 평균 ${num(recovery.daysToClose.mean)} 중앙값 ${num(recovery.daysToClose.median)}`)
  lines.push(`진입 당일 이미 Close > 20W ${pct(recovery.alreadyAboveRate)}`)

  lines.push("[8] 고성장주")
  for (const row of report.focusResults) {
    lines.push(`${row.symbol} 진입 H${row.entries.HOLD}/C${row.entries.CAUTION}/R${row.entries.RISK} 판정 ${row.conclusion}`)
    lines.push(`  CAUTION T+120 ${cellText(row.cautionT120)}`)
    lines.push(`  RISK T+60 ${cellText(row.riskT60)}`)
    lines.push(`  RISK T+120 ${cellText(row.riskT120)}`)
    lines.push(`  20W>60W 회복 ${pct(row.recovery.maRate)}, Close>20W ${pct(row.recovery.closeRate)}, 회복 중앙값 ${num(row.recovery.daysToMa.median)}거래일`)
    lines.push(`  RISK 진입 시 120거래일 고점 대비 ${pct(row.recovery.medianDrawdown120)}`)
    lines.push(`  BUY 이후 새 RISK ${row.laterRisk.n}건, 중앙값 ${num(row.laterRisk.medianDays)}거래일, 수익률 ${pct(row.laterRisk.medianReturn)}`)
  }

  lines.push("[9] 31종목별 참고 결과")
  for (const ticker of report.tickers) {
    const risk = ticker.forward.RISK[120]
    const hold = ticker.forward.HOLD[120]
    lines.push(`${ticker.symbol} H${ticker.entries.HOLD}/C${ticker.entries.CAUTION}/R${ticker.entries.RISK} RISK T+120 ${cellText(risk)} | HOLD T+120 평균 ${pct(hold.mean)} n=${hold.n} | ${ticker.sample.RISK}`)
  }

  lines.push("[10] 최종 판정")
  lines.push(judgment.label)
  lines.push(`A. ${judgment.A}`)
  lines.push(`B. ${judgment.B}`)
  lines.push(`C. ${judgment.C}`)
  lines.push("v37 결론")
  lines.push(`- HOLD: 진입 ${integrity.entries.HOLD}, T+120 평균 ${pct(forward.HOLD[120].mean)}, 중앙값 ${pct(forward.HOLD[120].median)}, 승률 ${pct(forward.HOLD[120].winRate)}`)
  lines.push(`- CAUTION: 진입 ${integrity.entries.CAUTION}, T+120 평균 ${pct(forward.CAUTION[120].mean)}, 중앙값 ${pct(forward.CAUTION[120].median)}, 승률 ${pct(forward.CAUTION[120].winRate)}`)
  lines.push(`- RISK: 진입 ${integrity.entries.RISK}, T+120 평균 ${pct(forward.RISK[120].mean)}, 중앙값 ${pct(forward.RISK[120].median)}, 승률 ${pct(forward.RISK[120].winRate)}`)
  lines.push(`- RISK의 미래 성과 예측력: ${judgment.A}`)
  lines.push(`- CAUTION과 RISK의 구분 가치: ${judgment.B}`)
  lines.push(`- 웹사이트 표시 가치: ${judgment.C}`)
  lines.push("- SELL 규칙 채택 여부: 채택하지 않음")
  lines.push("- production 변경 여부: 변경 없음")
  lines.push("- selectedStrategy: null")
  return lines.join("\n")
}
