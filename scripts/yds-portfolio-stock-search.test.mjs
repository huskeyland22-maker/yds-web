/**
 * Portfolio stock search — node scripts/yds-portfolio-stock-search.test.mjs
 */
import {
  PORTFOLIO_STOCK_CATALOG,
  searchPortfolioStocks,
} from "../vite-project/src/content/ydsPortfolioStockSearch.js"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(PORTFOLIO_STOCK_CATALOG.length > 20, "catalog loaded")

const hyundai = searchPortfolioStocks("현")
const hyundaiNames = hyundai.map((s) => s.name)
assert(hyundaiNames.includes("현대차"), `현대차 in ${hyundaiNames.join(",")}`)
assert(hyundaiNames.includes("현대모비스"), "현대모비스")
assert(hyundaiNames.includes("현대건설"), "현대건설")

const nvda = searchPortfolioStocks("엔비디아")
assert(nvda[0]?.ticker === "NVDA", `nvda ${nvda[0]?.ticker}`)
assert(nvda[0]?.country === "us", "nvda us")

const usTickers = searchPortfolioStocks("NVDA")
assert(usTickers.some((s) => s.ticker === "NVDA"), "NVDA ticker search")
assert(searchPortfolioStocks("브로드컴")[0]?.ticker === "AVGO", "broadcom")
assert(searchPortfolioStocks("메타")[0]?.ticker === "META", "meta")
assert(searchPortfolioStocks("TSMC")[0]?.ticker === "TSM", "tsmc")

console.log("OK portfolio stock search", {
  catalog: PORTFOLIO_STOCK_CATALOG.length,
  hyundai: hyundaiNames.slice(0, 4),
})
