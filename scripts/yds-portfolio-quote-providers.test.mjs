/**
 * Portfolio quote providers — node scripts/yds-portfolio-quote-providers.test.mjs
 */
import { pathToFileURL } from "node:url"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const mod = await import(pathToFileURL(join(root, "api/_lib/portfolioQuoteProviders.js")).href)

const { resolvePortfolioQuote, portfolioQuoteKey, naverProviderGetQuote, yahooProviderGetQuote } =
  mod

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(portfolioQuoteKey("us", "NVDA") === "us:NVDA", "quote key")
assert(portfolioQuoteKey("kr", "005380") === "kr:005380", "kr key")

const nvda = await yahooProviderGetQuote("NVDA")
assert(nvda?.price != null && nvda.price > 0, `yahoo nvda ${nvda?.price}`)
assert(nvda.currency === "USD", "usd")

const hyundai = await naverProviderGetQuote("005380")
assert(hyundai?.price != null && hyundai.price > 0, `naver hyundai ${hyundai?.price}`)
assert(hyundai.currency === "KRW", "krw")

const resolvedUs = await resolvePortfolioQuote("us", "NVDA")
assert(resolvedUs.price != null, "resolved us")

const resolvedKr = await resolvePortfolioQuote("kr", "005380")
assert(resolvedKr.price != null, `resolved kr ${resolvedKr.source}`)

console.log("OK portfolio quote providers", {
  nvda: nvda.price,
  hyundai: hyundai.price,
  krSource: resolvedKr.source,
})
