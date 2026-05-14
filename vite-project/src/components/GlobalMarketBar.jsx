import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { fetchMarketData } from "../config/api.js"

const REFRESH_MS = 30_000
const MOBILE_KEYS = new Set(["kospi", "nasdaq", "usdkrw", "us10y"])
const MARKET_ITEMS = [
  { key: "kospi", label: "KOSPI" },
  { key: "kosdaq", label: "KOSDAQ" },
  { key: "nasdaq", label: "NASDAQ" },
  { key: "sp500", label: "S&P500" },
  { key: "usdkrw", label: "USD/KRW" },
  { key: "us10y", label: "US10Y" },
]

function numberFormatter(value, key) {
  if (value == null) return "-"
  if (typeof value === "string") return value
  if (!Number.isFinite(value)) return "-"
  if (key === "us10y") return `${value.toFixed(2)}%`
  if (key === "usdkrw") return value.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (value >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 2 })
  return value.toLocaleString("en-US", { maximumFractionDigits: 3 })
}

function pctFormatter(value) {
  if (!Number.isFinite(value)) return "-"
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(2)}%`
}

function directionOf(value) {
  if (!Number.isFinite(value)) return "flat"
  if (value > 0) return "up"
  if (value < 0) return "down"
  return "flat"
}

export default function GlobalMarketBar({ isMobile = false }) {
  const [marketData, setMarketData] = useState({})
  const [marketChange, setMarketChange] = useState({})
  const [loading, setLoading] = useState(true)
  const [flashMap, setFlashMap] = useState({})
  const flashTimersRef = useRef({})

  const applyFlash = useCallback((prevData, nextData) => {
    const nextFlash = {}
    for (const { key } of MARKET_ITEMS) {
      const prev = prevData[key]
      const next = nextData[key]
      if (!Number.isFinite(prev) || !Number.isFinite(next) || prev === next) continue
      const dir = next > prev ? "up" : "down"
      nextFlash[key] = dir

      if (flashTimersRef.current[key]) {
        window.clearTimeout(flashTimersRef.current[key])
      }
      flashTimersRef.current[key] = window.setTimeout(() => {
        setFlashMap((old) => ({ ...old, [key]: "" }))
      }, 650)
    }
    if (Object.keys(nextFlash).length) {
      setFlashMap((old) => ({ ...old, ...nextFlash }))
    }
  }, [])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const { parsedData, changeData } = await fetchMarketData()
      setMarketData((prev) => {
        applyFlash(prev, parsedData)
        return parsedData
      })
      setMarketChange(changeData)
      if (import.meta.env.DEV) {
        console.log("[GlobalBar] parsedData", parsedData)
        console.log("[GlobalBar] setMarketData(parsedData) executed")
      }
    } catch (err) {
      console.error("글로벌 시황 바 로드 실패", err)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [applyFlash])

  useEffect(() => {
    let mounted = true
    const safeLoad = async (silent = false) => {
      if (!mounted) return
      await load(silent)
    }

    void safeLoad(false)

    const interval = setInterval(() => {
      void safeLoad(true)
    }, REFRESH_MS)

    return () => {
      mounted = false
      clearInterval(interval)
      for (const id of Object.values(flashTimersRef.current)) {
        window.clearTimeout(id)
      }
      flashTimersRef.current = {}
    }
  }, [load])

  const visibleItems = useMemo(() => {
    if (!isMobile) return MARKET_ITEMS
    return MARKET_ITEMS.filter((row) => MOBILE_KEYS.has(row.key))
  }, [isMobile])

  if (loading && Object.keys(marketData).length === 0) {
    return (
      <div className="mb-3 rounded-xl border border-gray-800/80 bg-[#111827]/70 px-3 py-2 text-xs text-gray-400">
        불러오는 중...
      </div>
    )
  }

  return (
    <div className="mb-3 overflow-x-auto rounded-xl border border-gray-800/80 bg-[#111827]/70">
      <div className="flex min-w-max items-center gap-2 px-3 py-2 text-xs">
        {visibleItems.map((item) => {
          const value = marketData[item.key]
          const changePct = marketChange[item.key]
          const dir = directionOf(changePct)
          const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "■"
          const toneClass =
            dir === "up" ? "text-emerald-300" : dir === "down" ? "text-rose-300" : "text-gray-300"
          const flash = flashMap[item.key]
          const flashClass = flash === "up" ? "market-flash-up" : flash === "down" ? "market-flash-down" : ""

          return (
            <span
              key={item.key}
              className={`whitespace-nowrap rounded-md px-2 py-1 transition-colors ${flashClass}`}
            >
              <span className="text-gray-400">{item.label} </span>
              <span className="font-mono text-gray-100">{numberFormatter(value ?? "-", item.key)} </span>
              <span className={`font-mono ${toneClass}`}>
                {arrow} {pctFormatter(changePct ?? "-")}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
