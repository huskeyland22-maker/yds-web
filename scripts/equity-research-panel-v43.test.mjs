import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import assert from "node:assert/strict"

const root = dirname(fileURLToPath(import.meta.url))
const web = join(root, "..", "vite-project")

test("v43 research summary stays static and unadopted", async () => {
  const { EQUITY_RESEARCH_SUMMARY: study } = await import(
    new URL("../vite-project/src/content/equityResearchSummary.js", import.meta.url).href
  )
  assert.equal(study.version, "v41")
  assert.equal(study.episodes, 1380)
  assert.equal(study.buy.T60.mean, 12.45)
  assert.equal(study.buy.T120.winRate, 76.25)
  assert.equal(study.selectedStrategy, null)
  assert.equal(study.sell.adopted, false)
  assert.equal(study.weeklySell.adopted, false)
  assert.equal(study.add.automated, false)
  assert.equal(study.riskState.available, false)
  assert.equal(study.baseline.name, "Buy & Hold")
})

test("v43 panel sits between the score and the conditions", () => {
  const page = readFileSync(join(web, "src/pages/EquityDailyBottomBuyPage.jsx"), "utf8")
  const panel = readFileSync(join(web, "src/components/equity/EquityResearchPanel.jsx"), "utf8")
  const score = page.indexOf("DBB SCORE")
  const research = page.indexOf("<EquityResearchPanel />")
  const conditions = page.indexOf("4 CONDITIONS")
  assert.ok(score < research && research < conditions)
  assert.match(panel, /과거 연구 기준/)
  assert.match(panel, /미래 수익률 예측이 아닙니다/)
  assert.match(panel, /범용 SELL 규칙이 확인되지 않았습니다/)
  assert.match(panel, /자동 추가매수 규칙도 채택하지 않았습니다/)
  assert.match(panel, /연구 비교 기준/)
  for (const banned of ["SELL NOW", "매도 추천", "ADD5", "ADD10", "-5% 추가매수", "-10% 추가매수", "-20% SELL", "RISK = SELL"]) {
    assert.equal(panel.includes(banned), false, banned)
  }
  assert.doesNotMatch(page, /equity-daily-bottom-buy.*EQUITY_RESEARCH_SUMMARY|fetchEquityDailyBottomBuy\([^)]*study/)
  const listAt = page.indexOf("전체 개별 종목 목록")
  const recordAt = page.indexOf("매수 기록")
  assert.ok(recordAt > 0 && listAt > recordAt)
  assert.match(page, /selectEquityBuyCandidates\(packed, symbols\)/)
  const etf = readFileSync(join(web, "src/pages/DailyBottomBuyPage.jsx"), "utf8")
  assert.match(etf, /전체 9개 ETF/)
  assert.doesNotMatch(etf, /전체 개별 종목 목록/)
})
