import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { fetchMarketData } from "../../config/api.js"

const REFRESH_MS = 30_000

/** Design B ticker — only symbols available from /api/market-data (no Dow). */
const TICKER_ITEMS = [
  { key: "sp500", label: "S&P 500" },
  { key: "nasdaq", label: "NASDAQ" },
  { key: "us10y", label: "미국 10년물" },
  { key: "dxy", label: "달러 지수" },
  { key: "usdkrw", label: "USD/KRW" },
]

const MOBILE_KEYS = new Set(["sp500", "nasdaq", "us10y", "dxy"])

function numberFormatter(value, key) {
  if (value == null) return "—"
  if (typeof value === "string") return value
  if (!Number.isFinite(value)) return "—"
  if (key === "us10y") return `${value.toFixed(2)}%`
  if (key === "usdkrw") {
    return value.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  if (value >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 2 })
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 })
}

function pctFormatter(value) {
  if (!Number.isFinite(value)) return "—"
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(2)}%`
}

function directionOf(value) {
  if (!Number.isFinite(value)) return "flat"
  if (value > 0) return "up"
  if (value < 0) return "down"
  return "flat"
}

/**
 * /market-analysis Design B market strip.
 * @param {{ className?: string; compact?: boolean }} props
 */
export default function YdsMarketTickerBar({ className = "", compact = false }) {
  const [marketData, setMarketData] = useState({})
  const [marketChange, setMarketChange] = useState({})
  const [loading, setLoading] = useState(true)
  const [flashMap, setFlashMap] = useState({})
  const flashTimersRef = useRef({})

  const applyFlash = useCallback((prevData, nextData) => {
    const nextFlash = {}
    for (const { key } of TICKER_ITEMS) {
      const prev = prevData[key]
      const next = nextData[key]
      if (!Number.isFinite(prev) || !Number.isFinite(next) || prev === next) continue
      nextFlash[key] = next > prev ? "up" : "down"
      if (flashTimersRef.current[key]) window.clearTimeout(flashTimersRef.current[key])
      flashTimersRef.current[key] = window.setTimeout(() => {
        setFlashMap((old) => ({ ...old, [key]: "" }))
      }, 650)
    }
    if (Object.keys(nextFlash).length) setFlashMap((old) => ({ ...old, ...nextFlash }))
  }, [])

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const { parsedData, changeData } = await fetchMarketData()
        setMarketData((prev) => {
          applyFlash(prev, parsedData)
          return parsedData
        })
        setMarketChange(changeData)
      } catch {
        /* keep last good snapshot */
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [applyFlash],
  )

  useEffect(() => {
    let mounted = true
    const run = async (silent = false) => {
      if (!mounted) return
      await load(silent)
    }
    void run(false)
    const interval = setInterval(() => void run(true), REFRESH_MS)
    return () => {
      mounted = false
      clearInterval(interval)
      for (const id of Object.values(flashTimersRef.current)) window.clearTimeout(id)
      flashTimersRef.current = {}
    }
  }, [load])

  const items = useMemo(
    () => (compact ? TICKER_ITEMS.filter((row) => MOBILE_KEYS.has(row.key)) : TICKER_ITEMS),
    [compact],
  )

  const hasAny = items.some((item) => Number.isFinite(Number(marketData[item.key])))

  return (
    <div
      className={["yds-market-ticker", className].filter(Boolean).join(" ")}
      aria-label="시장 시세"
      data-loading={loading && !hasAny ? "true" : "false"}
    >
      {loading && !hasAny ? (
        <p className="yds-market-ticker__loading">시장 시세를 불러오는 중…</p>
      ) : (
        <ul className="yds-market-ticker__list">
          {items.map((item) => {
            const value = marketData[item.key]
            const changePct = marketChange[item.key]
            const dir = directionOf(changePct)
            const flash = flashMap[item.key]
            return (
              <li
                key={item.key}
                className={[
                  "yds-market-ticker__item",
                  `is-${dir}`,
                  flash === "up" ? "is-flash-up" : "",
                  flash === "down" ? "is-flash-down" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="yds-market-ticker__label">{item.label}</span>
                <span className="yds-market-ticker__value font-mono tabular-nums">
                  {numberFormatter(value ?? null, item.key)}
                </span>
                <span className="yds-market-ticker__chg font-mono tabular-nums">
                  {dir === "up" ? "▲" : dir === "down" ? "▼" : "·"} {pctFormatter(changePct)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
