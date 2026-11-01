import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { ETF_WINDOW, EQUITY_WINDOW, MATRIX, assertStoredFacts } from "./lib/equity-research-synthesis-v41.mjs"

const root = dirname(fileURLToPath(import.meta.url))
const sources = {
  technical: JSON.parse(readFileSync(join(root, "data", "equity-technical-sell-v1.json"), "utf8")),
  weekly: JSON.parse(readFileSync(join(root, "data", "equity-weekly-trend-sell-v1.json"), "utf8")),
  state: JSON.parse(readFileSync(join(root, ".cache", "equity-trend-state-research-v37-result.json"), "utf8")),
  buy: JSON.parse(readFileSync(join(root, ".cache", "equity-buy-validation-v38-result.json"), "utf8")),
  addon: JSON.parse(readFileSync(join(root, ".cache", "equity-addon-buy-v39-result.json"), "utf8")),
  recovery: JSON.parse(readFileSync(join(root, ".cache", "equity-addon-recovery-v40-result.json"), "utf8")),
}

let facts
try {
  facts = assertStoredFacts(sources)
} catch (error) {
  console.log(error.lines ? error.lines.join("\n") : error.message)
  process.exit(1)
}

writeFileSync(join(root, ".cache", "equity-research-synthesis-v41-result.json"), JSON.stringify(facts))
console.log(formatReport(sources))

function pct(value) {
  return `${(value * 100).toFixed(2)}%`
}

function pp(value) {
  return `${(value * 100).toFixed(2)}pp`
}

function formatReport(sources) {
  const { technical, weekly, state, buy, recovery } = sources
  const perf = buy.buy.performance
  const random = (horizon) => perf[horizon].mean - buy.comparison[horizon].mean
  const vote = technical.strategies.find((row) => row.id === "s2-vote4-downtrend")
  const weeklyRow = Object.fromEntries(weekly.strategies.map((row) => [row.id, row]))
  const add5 = recovery.strategies.ADD5
  const add10 = recovery.strategies.ADD10
  const bucket = (block, key) => block.buckets[key].horizons[120]
  const lines = []
  lines.push("1. BUY: 약한 우위 → 유지")
  lines.push("2. SELL: 우위 없음 → 미채택")
  lines.push("3. Trend SELL: B&H 초과 실패 → 미채택")
  lines.push("4. ADD: 얕은 하락 참고 가능 / 깊은 하락 위험 → 자동화 금지")
  lines.push("5. 최종: BUY + B&H baseline + Risk 참고 상태")

  lines.push("1. 연구 범위")
  lines.push("개별주식 31종목과 BUY episode 1,380개를 유지한다. v35부터 v40까지 날짜 지문은 같다.")
  lines.push(`개별주식 가격 구간은 ${EQUITY_WINDOW.from}~${EQUITY_WINDOW.to}다. v37과 v38 결과에 이 구간이 기록되어 있다.`)
  lines.push(`ETF 연구 구간은 ${ETF_WINDOW.from}~${ETF_WINDOW.to}다. ETF 성과는 이번 개별주식 결론에 합산하지 않는다.`)
  lines.push("v1~v34의 매도 탐색은 v35와 v36에서 종료된 중간 과정이다. 이번 종합은 그 종료 판정과 v37~v40의 저장 결과를 사용한다.")

  lines.push("2. 최종 BUY 평가")
  lines.push("BUY는 RSI 36 이하, 스토캐스틱 %K 15.4 이하, BB%B 0.01 이하, MA20 이격 -4.2% 이하 가운데 3개 이상이다. overlap 0, lookahead 0이다.")
  lines.push(`T+20 평균 ${pct(perf[20].mean)} 중앙값 ${pct(perf[20].median)} 승률 ${pct(perf[20].winRate)}`)
  lines.push(`T+60 평균 ${pct(perf[60].mean)} 중앙값 ${pct(perf[60].median)} 승률 ${pct(perf[60].winRate)}`)
  lines.push(`T+120 평균 ${pct(perf[120].mean)} 중앙값 ${pct(perf[120].median)} 승률 ${pct(perf[120].winRate)}`)
  lines.push(`Random 평균은 T+20 ${pct(random(20))}, T+60 ${pct(random(60))}, T+120 ${pct(random(120))}다.`)
  lines.push(`차이는 T+20 ${pp(buy.comparison[20].mean)}, T+60 ${pp(buy.comparison[60].mean)}, T+120 ${pp(buy.comparison[120].mean)}다.`)
  lines.push(`T+60 평균차 ${pp(buy.permutation[60].observed)}, 95% CI ${pp(buy.ci[60].meanLow)}~${pp(buy.ci[60].meanHigh)}, p ${buy.permutation[60].p.toFixed(3)}`)
  lines.push(`T+120 평균차 ${pp(buy.permutation[120].observed)}, 95% CI ${pp(buy.ci[120].meanLow)}~${pp(buy.ci[120].meanHigh)}, p ${buy.permutation[120].p.toFixed(3)}. 이 구간은 0을 포함한다.`)
  lines.push(`비교 가능한 30종목 중 T+60과 T+120 평균이 모두 Random보다 높은 종목은 ${buy.breadth.better}/${buy.breadth.qualified}다.`)
  lines.push("BUY 신호는 랜덤 대비 단기~중기 평균 성과에서 약한 우위를 보였으며, 특히 T+60에서 통계적 근거가 가장 명확하다. 다만 종목 전반에서 강력하고 보편적인 우위라고 단정할 수준은 아니다.")
  lines.push("BUY 조건은 변경하지 않는다.")

  lines.push("3. BUY의 한계")
  const trough = buy.buy.trough
  lines.push(`T+60이 있는 ${trough.n}건에서 BUY 이후 최저점까지 평균 ${pct(trough.extraMean)}, 중앙값 ${pct(trough.extraMedian)}다.`)
  lines.push(`추가 저점이 없는 비율은 ${pct(trough.noFurtherLowRate)}다. 저점 시점은 평균 T+${trough.dayMean.toFixed(1)}, 중앙값 T+${trough.dayMedian}다.`)
  lines.push(`60일 안에 +10% 도달은 ${pct(buy.buy.reach[0.1].rate)}, +20% 도달은 ${pct(buy.buy.reach[0.2].rate)}다.`)
  lines.push("BUY는 즉시 저점이라는 뜻이 아니다. 상승이 이어진 경우가 많지만, 그 전에 추가 하락을 거치는 경우가 다수다.")

  lines.push("4. BUY 3조건과 4조건")
  const three = buy.countGroups[3]
  const four = buy.countGroups[4]
  lines.push(`3조건 n ${three.n}, T+60 ${pct(three.t60.mean)}, T+120 ${pct(three.t120.mean)}, T+60 승률 ${pct(three.t60.winRate)}`)
  lines.push(`4조건 n ${four.n}, T+60 ${pct(four.t60.mean)}, T+120 ${pct(four.t120.mean)}, T+60 승률 ${pct(four.t60.winRate)}`)
  lines.push("4조건 구간의 평균이 더 높다. 이것은 참고 정보다. BUY를 4개 충족으로 강화하지 않는다. 조건 수를 결과 보고 고르면 선택 편향이 생긴다.")

  lines.push("5. SELL 최종 평가")
  lines.push(`일봉 기술적 SELL 중 4개 모두와 주봉 하락 조합의 평균 CAGR은 ${pct(vote.meanCagr)}, Buy & Hold는 ${pct(vote.meanBhCagr)}다.`)
  lines.push(`표본 밖 초과 CAGR은 ${vote.oos.map((row) => pp(row.meanExcessCagr)).join(", ")}다.`)
  lines.push(`주봉 W1 CAGR ${pct(weeklyRow.W1.meanCagr)}, W2 ${pct(weeklyRow.W2.meanCagr)}, W3 ${pct(weeklyRow.W3.meanCagr)}, Buy & Hold ${pct(weeklyRow.W1.meanBhCagr)}다.`)
  lines.push(`W1 표본 밖 ${weeklyRow.W1.oos.map((row) => pp(row.meanExcessCagr)).join(", ")}`)
  lines.push(`W2 표본 밖 ${weeklyRow.W2.oos.map((row) => pp(row.meanExcessCagr)).join(", ")}`)
  lines.push(`W3 표본 밖 ${weeklyRow.W3.oos.map((row) => pp(row.meanExcessCagr)).join(", ")}`)
  lines.push("주봉 추세를 이용한 SELL은 하락 위험을 일부 줄일 수 있었지만, 장기 복리수익에서 Buy & Hold를 안정적으로 능가하지 못했다.")
  lines.push("SELL 규칙은 채택하지 않는다.")

  lines.push("6. HOLD / CAUTION / RISK")
  lines.push(`상태 비중은 HOLD ${pct(state.distribution.HOLD)}, CAUTION ${pct(state.distribution.CAUTION)}, RISK ${pct(state.distribution.RISK)}다.`)
  lines.push(`T+120 평균은 HOLD ${pct(state.forward.HOLD[120].mean)}, CAUTION ${pct(state.forward.CAUTION[120].mean)}, RISK ${pct(state.forward.RISK[120].mean)}다.`)
  const risk = state.diffs["RISK-HOLD"][120]
  lines.push(`RISK의 T+120 중앙값은 HOLD보다 ${pp(risk.median)}, 승률은 ${pp(risk.winRate)}다.`)
  lines.push("평균 차이는 작다. 위험 참고로는 쓸 수 있고, 매도나 회피 신호로는 쓰지 않는다.")
  lines.push("분류는 참고용 리스크 상태다. SELL signal로 표시하지 않는다. 화면에서는 시장과 가격 상태 참고로 적는다.")

  lines.push("7. 추가매수")
  lines.push("v39의 ADD5는 BUY 이후 처음 -5% 종가에 같은 금액 1.0을 한 번 더한다. ADD10은 -10%에서 한 번 더한다.")
  lines.push("전체 투자금 수익률은 단순 보유보다 높았다. 더 싼 가격에 같은 금액을 넣는 계산이 그 차이에 포함된다.")
  lines.push("판정은 참고 가치이며 범용 규칙은 아니다. 자동 추가매수로 채택하지 않는다.")

  lines.push("8. 깊은 하락")
  lines.push(recovery.judgment.label)
  lines.push(`추가매수가 기준 전체 T+120은 ADD5 평균 ${pct(add5.overall[120].mean)}, 중앙값 ${pct(add5.overall[120].median)}, 승률 ${pct(add5.overall[120].winRate)}다.`)
  lines.push(`ADD10은 평균 ${pct(add10.overall[120].mean)}, 중앙값 ${pct(add10.overall[120].median)}, 승률 ${pct(add10.overall[120].winRate)}다.`)
  for (const [name, block] of [["ADD5", add5], ["ADD10", add10]]) {
    for (const key of ["D", "E", "F"]) {
      const row = bucket(block, key)
      lines.push(`${name} ${key} T+120 ${pct(row.mean)} / ${pct(row.median)} / ${pct(row.winRate)} n=${block.buckets[key].n}`)
    }
  }
  const deep5 = add5.deep["0.2"].t120
  const deep10 = add10.deep["0.2"].t120
  lines.push(`-20% 이하 ADD5 T+120 평균 ${pct(deep5.mean)}, 중앙값 ${pct(deep5.median)}, 승률 ${pct(deep5.winRate)}`)
  lines.push(`-20% 이하 ADD10 T+120 평균 ${pct(deep10.mean)}, 중앙값 ${pct(deep10.median)}, 승률 ${pct(deep10.winRate)}`)
  lines.push("전체 평균이 플러스라는 이유만으로 추가매수가 좋다고 해석하지 않는다. 깊은 경로의 중앙값은 손실이다.")

  lines.push("9. 깊은 하락과 얕은 하락의 차이")
  lines.push(`ADD5 T+120 평균차 ${pp(add5.contrast[120].permutation.observed)}, 95% CI ${pp(add5.contrast[120].meanLow)}~${pp(add5.contrast[120].meanHigh)}`)
  lines.push(`ADD10 T+120 평균차 ${pp(add10.contrast[120].permutation.observed)}, 95% CI ${pp(add10.contrast[120].meanLow)}~${pp(add10.contrast[120].meanHigh)}`)
  lines.push("깊은 하락 여부가 이후 성과를 크게 가른다. 이 결과를 -20% 매도 규칙으로 바꾸지 않는다. 이번 비교는 매도 규칙을 검증한 연구가 아니다.")

  lines.push("10. 종목별 차이")
  for (const symbol of ["NVDA", "AMD", "AVGO", "CRWD", "PLTR", "TSLA"]) {
    const left = add5.tickers.find((row) => row.symbol === symbol)
    const right = add10.tickers.find((row) => row.symbol === symbol)
    lines.push(`${symbol} ADD5 T+120 ${pct(left.t120)} 최저중앙 ${pct(left.minMedian)} / ADD10 T+120 ${pct(right.t120)} 최저중앙 ${pct(right.minMedian)} ${left.sample}`)
  }
  lines.push("PLTR의 ADD10 T+120 평균은 마이너스다. CRWD, PLTR, TSLA의 추가하락 중앙값은 상대적으로 깊다. NVDA, AMD, AVGO의 전체 평균은 상대적으로 높다.")
  lines.push("이 차이는 설명용이다. 종목별 추가매수 허용이나 금지로 확장하지 않는다.")

  lines.push("11. 증거 수준")
  lines.push("BUY B. SELL D. Weekly SELL D. HOLD/CAUTION/RISK C. ADD5/ADD10 C. 깊은 하락 위험 A.")
  lines.push("BUY 후 즉시 저점 D. 추가매수의 평균단가 개선 A, 이것은 같은 금액을 더 싼 가격에 넣는 계산이다. 깊은 하락 후 회복 D. Buy & Hold baseline A.")

  lines.push("12. 연구 결론의 구조")
  lines.push("BUY는 고정 조건으로 진입 후보를 찾는다.")
  lines.push("진입 뒤 BUY를 즉시 저점으로 두지 않는다.")
  lines.push("매도 우위가 확인되지 않았으므로 Buy & Hold를 기본 비교 기준으로 둔다.")
  lines.push("주봉 20주와 60주 상태는 HOLD, CAUTION, RISK 참고로만 쓴다.")
  lines.push("추가매수는 자동 규칙으로 쓰지 않는다. 깊은 하락에서는 위험이 커진다.")
  lines.push("현재 연구로 production SELL 규칙을 만들지 않는다.")

  lines.push("13. 표시할 수 있는 연구 정보")
  lines.push("BUY 조건 충족 여부, 충족 개수, 발생일, 과거 T+20·T+60·T+120 성과와 승률, 과거 낙폭, BUY 이후 추가하락 가능성을 참고로 보여줄 수 있다.")
  lines.push("HOLD, CAUTION, RISK는 리스크 상태 참고로 보여줄 수 있다. 매도라는 단어를 붙이지 않는다.")
  lines.push("경고 문장으로 과거 BUY 이후 추가하락이 흔했다는 점, 추가매수 후 깊은 하락의 회복 신뢰도가 낮았다는 점을 적을 수 있다.")

  lines.push("14. 표시하지 않는 문장")
  lines.push("SELL NOW, SELL signal, -5% ADD, -10% ADD, -20% SELL, RISK = SELL, 20주선 이탈 = SELL은 현재 연구에서 나오지 않았다.")
  lines.push("반드시 회복한다, 추가매수하면 유리하다, BUY 후 저점은 끝났다는 문장도 연구에서 확인되지 않았다.")

  lines.push("15. Decision matrix")
  lines.push("| 기능 | 연구 결과 | 증거 수준 | Production 채택 |")
  for (const row of MATRIX) lines.push(`| ${row.join(" | ")} |`)

  lines.push("16. 최종 결론")
  lines.push("현재 연구의 가장 중요한 결론은 SELL 규칙을 찾지 못했다는 것이 아니라, 검증된 BUY 이후의 보유 전략을 능가하는 범용 SELL 규칙을 찾지 못했다는 것이다.")
  lines.push("BUY는 랜덤 대비 제한적인 우위가 확인되었지만, BUY 이후 추가하락은 흔하다.")
  lines.push("추가매수는 얕은 하락에서는 평균단가와 성과를 개선할 수 있지만, 깊은 하락에서는 회복 신뢰도가 급격히 낮아진다.")
  lines.push("따라서 현재 연구에서는 BUY를 유지하고, SELL과 자동 ADD는 도입하지 않으며, 주봉 상태는 참고용 위험 정보로만 사용하는 것이 가장 보수적인 결론이다.")

  lines.push("17. Production 안전 확인")
  lines.push("selectedStrategy = null")
  lines.push("BUY: 변경 없음")
  lines.push("SELL: 변경 없음")
  lines.push("ADD: 변경 없음")
  lines.push("UI: 변경 없음")
  lines.push("API: 변경 없음")
  lines.push("DB: 변경 없음")
  lines.push("Production: 변경 없음")
  lines.push("Research only: YES")
  return lines.join("\n")
}
