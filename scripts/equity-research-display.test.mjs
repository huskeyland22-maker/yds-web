/**
 * node --test scripts/equity-research-display.test.mjs
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import { equityUniverse } from "./lib/equity-daily-bottom-buy.mjs"
import {
  EQUITY_SELL_RESEARCH_SELECTED_STRATEGY,
  EQUITY_SELL_RESEARCH_UNIVERSE,
} from "./lib/equity-sell-research-universe.mjs"
import {
  closeTickerPicker,
  equityProgressMeta,
  equityResearchDisplayList,
  equitySummaryCatalog,
  equityTickerLabel,
  initialTickerPickerState,
  toggleTickerPicker,
  equitySummaryRow,
  equitySummaryToggleLabel,
  equitySummaryVisibleRows,
  visibleResearchStocks,
} from "../vite-project/src/utils/equityResearchDisplay.js"

const EXPECTED = [
  "AMZN", "AAPL", "AMAT", "ASML", "AVGO", "CEG", "ETN", "FCX", "FTNT", "GOOGL",
  "LRCX", "LLY", "MU", "NVDA", "ORCL", "PANW", "PLTR", "TSLA", "TSM", "VST",
  "KLAC", "ANET", "VRT", "PWR", "V", "MSFT", "GEV", "ISRG", "SNPS", "AMD", "CRWD",
]

describe("equity research display", () => {
  it("shows all 31 research names and leaves the 20-name scan in place", () => {
    assert.equal(EQUITY_SELL_RESEARCH_SELECTED_STRATEGY, null)
    const shown = equityResearchDisplayList()
    const tickers = shown.map((row) => row.symbol)
    assert.equal(tickers.length, 31)
    assert.equal(new Set(tickers).size, 31)
    assert.deepEqual(tickers, EXPECTED)
    assert.deepEqual(tickers, EQUITY_SELL_RESEARCH_UNIVERSE.map((row) => row.symbol))
    assert.equal(visibleResearchStocks(shown).length, 31)
    assert.deepEqual(visibleResearchStocks(shown).map((row) => row.symbol), EXPECTED)
    assert.equal(equityUniverse().length, 20)
    assert.equal(equityUniverse().some((row) => row.symbol === "CRWD"), false)
    assert.equal(equityUniverse().some((row) => row.symbol === "AMD"), false)
  })

  it("starts collapsed and labels tickers without CORE or WATCH", () => {
    const shown = equityResearchDisplayList()
    const labels = shown.map((row) => equityTickerLabel(row))
    assert.equal(initialTickerPickerState().open, false)
    const opened = toggleTickerPicker(initialTickerPickerState())
    assert.equal(opened.open, true)
    assert.equal(closeTickerPicker().open, false)
    assert.equal(equityTickerLabel(shown.find((row) => row.symbol === "AMZN")), "AMZN · Amazon · 아마존")
    assert.equal(equityTickerLabel(shown.find((row) => row.symbol === "NVDA")), "NVDA · NVIDIA · 엔비디아")
    assert.equal(equityTickerLabel(shown.find((row) => row.symbol === "CRWD")), "CRWD · CrowdStrike · 크라우드스트라이크")
    assert.equal(labels.some((label) => label.includes("CORE") || label.includes("WATCH")), false)
    assert.deepEqual(visibleResearchStocks(shown, { query: "엔비디아" }).map((row) => row.symbol), ["NVDA"])
    assert.deepEqual(visibleResearchStocks(shown, { query: "NVIDIA" }).map((row) => row.symbol), ["NVDA"])
    assert.deepEqual(visibleResearchStocks(shown, { query: "NVDA" }).map((row) => row.symbol), ["NVDA"])
    assert.deepEqual(visibleResearchStocks(shown, { query: "크라우드스트라이크" }).map((row) => row.symbol), ["CRWD"])
  })

  it("keeps an unscored summary blank and shows a real zero", () => {
    assert.deepEqual(equitySummaryRow(null), { countText: "—", stageLabel: "—", stageClass: "wait" })
    assert.deepEqual(equitySummaryRow({ ok: false, score: null }), { countText: "—", stageLabel: "—", stageClass: "wait" })
    const zero = equitySummaryRow({ ok: true, score: 0, state: { id: "wait", label: "WAIT" } })
    assert.equal(zero.countText, "0/4")
    assert.equal(zero.stageLabel, "대기")
    assert.equal(`${zero.countText} ${zero.stageLabel}`, "0/4 대기")
    assert.equal(equitySummaryRow({ ok: true, score: 2, state: { id: "interest", label: "INTEREST" } }).stageLabel, "관심")
    assert.equal(equitySummaryRow({ ok: true, score: 3, state: { id: "firstBuy", label: "FIRST BUY CANDIDATE" } }).stageLabel, "1차 매수")
    assert.equal(equitySummaryRow({ ok: true, score: 4, state: { id: "strongLow", label: "STRONG LOW CANDIDATE" } }).stageLabel, "강한 저점")
  })

  it("shows the first 10 names until the full list is opened", () => {
    const shown = equityResearchDisplayList()
    assert.equal(shown.length, 31)
    assert.deepEqual(equitySummaryVisibleRows(shown, false).map((row) => row.symbol), shown.slice(0, 10).map((row) => row.symbol))
    assert.equal(equitySummaryVisibleRows(shown, true).length, 31)
    assert.equal(equitySummaryToggleLabel(shown.length, false), "전체 31개 종목 보기 ▼")
    assert.equal(equitySummaryToggleLabel(shown.length, true), "접기 ▲")
  })

  it("appends held names after the 31 without joining the scan", () => {
    const research = equityResearchDisplayList()
    const shown = equitySummaryCatalog(research)
    assert.equal(research.length, 31)
    assert.equal(shown.length, 33)
    assert.deepEqual(shown.slice(0, 31).map((row) => row.symbol), EXPECTED)
    assert.deepEqual(shown.slice(-2).map((row) => row.symbol), ["NEE", "RXRX"])
    assert.equal(shown.find((row) => row.symbol === "NEE").group, "전력·유틸리티·재생에너지")
    assert.equal(shown.find((row) => row.symbol === "NEE").holding, true)
    assert.equal(shown.find((row) => row.symbol === "RXRX").group, "바이오·AI 신약 개발")
    assert.equal(shown.find((row) => row.symbol === "RXRX").nameKo, "리커전 파마슈티컬스")
    assert.equal(equitySummaryVisibleRows(shown, false).length, 10)
    assert.equal(equitySummaryVisibleRows(shown, true).length, 33)
    assert.equal(equitySummaryToggleLabel(shown.length, false), "전체 33개 종목 보기 ▼")
    assert.equal(equityUniverse().some((row) => row.symbol === "NEE" || row.symbol === "RXRX"), false)
    assert.equal(EQUITY_SELL_RESEARCH_UNIVERSE.some((row) => row.symbol === "NEE" || row.symbol === "RXRX"), false)
    assert.equal(equitySummaryRow(null).countText, "—")
    assert.equal(equitySummaryRow({ ok: false, score: 0 }).stageLabel, "—")
  })

  it("offers held names in the picker and only those two on the progress list", () => {
    const research = equityResearchDisplayList()
    const picker = equitySummaryCatalog(research)
    assert.equal(visibleResearchStocks(picker).length, 33)
    assert.deepEqual(visibleResearchStocks(picker).slice(0, 31).map((row) => row.symbol), EXPECTED)
    assert.deepEqual(visibleResearchStocks(picker, { query: "넥스트라" }).map((row) => row.symbol), ["NEE"])
    assert.deepEqual(visibleResearchStocks(picker, { query: "리커전" }).map((row) => row.symbol), ["RXRX"])
    assert.equal(equityTickerLabel(picker.find((row) => row.symbol === "NEE")), "NEE · NextEra Energy · 넥스트라 에너지")
    assert.equal(equityTickerLabel(picker.find((row) => row.symbol === "RXRX")), "RXRX · Recursion Pharmaceuticals · 리커전 파마슈티컬스")
    const scan = equityUniverse()
    const progress = equityProgressMeta(scan)
    assert.equal(progress.length, 22)
    assert.deepEqual(progress.slice(0, 20).map((row) => row.symbol), scan.map((row) => row.symbol))
    assert.deepEqual(progress.slice(-2).map((row) => row.symbol), ["NEE", "RXRX"])
    assert.equal(progress.some((row) => row.symbol === "MSFT" || row.symbol === "CRWD"), false)
    assert.deepEqual(equityProgressMeta([]).map((row) => row.symbol), ["NEE", "RXRX"])
    const page = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../vite-project/src/pages/EquityDailyBottomBuyPage.jsx"),
      "utf8",
    )
    assert.match(page, /visibleResearchStocks\(summaryCatalog/)
    assert.match(page, /equityProgressMeta\(universe\)/)
    assert.match(page, /selectEquityBuyCandidates\(packed, symbols\)/)
    assert.match(page, /system="dbb"\s+symbol=\{symbol\}/)
    assert.doesNotMatch(page, /연구 종목 31/)
  })
})
