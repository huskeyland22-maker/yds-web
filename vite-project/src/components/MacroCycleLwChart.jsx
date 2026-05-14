import { useEffect, useMemo, useRef, useState } from "react"
import { ColorType, LastPriceAnimationMode, createChart } from "lightweight-charts"
import { resolveSeriesColor } from "./macroCycleChartUtils.js"

/** @param {unknown} time */
function timeToKey(time) {
  if (time == null) return null
  if (typeof time === "string") return time
  if (typeof time === "number") {
    const d = new Date(time * 1000)
    if (Number.isNaN(d.getTime())) return null
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, "0")
    const day = String(d.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  }
  if (typeof time === "object" && "year" in time && "month" in time && "day" in time) {
    const { year, month, day } = time
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }
  return null
}

function rowDay(row) {
  const t = row?.ts
  if (t && /^\d{4}-\d{2}-\d{2}/.test(String(t))) return String(t).slice(0, 10)
  return null
}

function fmtPrice(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—"
  const v = Number(n)
  return v.toLocaleString("ko-KR", { maximumFractionDigits: v >= 1000 && v % 1 === 0 ? 0 : 2 })
}

function fmtVol(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—"
  return Number(n).toLocaleString("ko-KR", { maximumFractionDigits: 0 })
}

/**
 * 단일 시계열(일별) → 합성 OHLC + 거래량 + MA20/60 (미니 프로 차트용).
 * @param {object[]} rows
 * @param {string} primaryKey
 */
function buildLwPack(rows, primaryKey) {
  const sorted = [...(rows || [])]
    .filter((r) => rowDay(r) && Number.isFinite(Number(r[primaryKey])))
    .sort((a, b) => String(rowDay(a)).localeCompare(String(rowDay(b))))
    .slice(-120)

  if (sorted.length < 2) return null

  /** @type {{ time: string; open: number; high: number; low: number; close: number; _v: number }[]} */
  const raw = []
  for (let i = 0; i < sorted.length; i++) {
    const close = Number(sorted[i][primaryKey])
    const open = i > 0 ? Number(sorted[i - 1][primaryKey]) : close
    const rng = Math.abs(close - open)
    const eps = Math.max(rng * 0.42, Math.abs(close) * 0.002, 0.03)
    const high = Math.max(open, close) + eps * 0.55
    const low = Math.min(open, close) - eps * 0.55
    const vol = rng * 1e6 + Math.abs(close) * 2e3 + 50
    raw.push({
      time: rowDay(sorted[i]),
      open,
      high,
      low,
      close,
      _v: vol,
    })
  }

  const candles = raw.map(({ time, open, high, low, close }) => ({ time, open, high, low, close }))

  const sma = (period) => {
    /** @type {{ time: string; value: number }[]} */
    const out = []
    for (let i = 0; i < raw.length; i++) {
      if (i < period - 1) continue
      let s = 0
      for (let j = 0; j < period; j++) s += raw[i - j].close
      out.push({ time: raw[i].time, value: s / period })
    }
    return out
  }

  const ma20 = sma(20)
  const ma60 = sma(60)

  const vols = raw.map((r) => r._v)
  const volume = raw.map((r, i) => {
    const up = r.close >= r.open
    let sum = 0
    let c = 0
    for (let j = Math.max(0, i - 19); j < i; j++) {
      sum += vols[j]
      c += 1
    }
    const avg = c > 0 ? sum / c : vols[i]
    const spike = avg > 0 && r._v >= avg * 1.3
    let color = up ? "rgba(0,194,168,0.28)" : "rgba(255,107,87,0.28)"
    if (spike) color = up ? "rgba(0,194,168,0.55)" : "rgba(255,107,87,0.5)"
    return { time: r.time, value: r._v, color }
  })

  /** @type {Map<string, { open: number; high: number; low: number; close: number; volume: number }>} */
  const meta = new Map()
  for (const r of raw) {
    meta.set(r.time, { open: r.open, high: r.high, low: r.low, close: r.close, volume: r._v })
  }

  return { candles, ma20, ma60, volume, meta }
}

/**
 * @param {{
 *   rows: object[]
 *   primarySeries: { key: string; name?: string; color?: string }
 *   className?: string
 * }} props
 */
export default function MacroCycleLwChart({ rows, primarySeries, className = "" }) {
  const wrapRef = useRef(null)
  const chartRef = useRef(null)
  const metaRef = useRef(new Map())
  const [tooltip, setTooltip] = useState(null)

  const pack = useMemo(() => {
    if (!primarySeries?.key) return null
    return buildLwPack(rows, primarySeries.key)
  }, [rows, primarySeries?.key])

  const seriesName = primarySeries?.name ?? primarySeries?.key ?? "Metric"
  const accent = resolveSeriesColor(primarySeries)

  useEffect(() => {
    metaRef.current = pack?.meta ?? new Map()
  }, [pack?.meta])

  useEffect(() => {
    const el = wrapRef.current
    if (!el || !pack || pack.candles.length < 2) return undefined

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "#080b12" },
        textColor: "rgba(148,163,184,0.72)",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.035)" },
        horzLines: { color: "rgba(255,255,255,0.035)" },
      },
      width: el.clientWidth,
      height: el.clientHeight || 240,
      rightPriceScale: { borderColor: "rgba(255,255,255,0.06)" },
      timeScale: {
        borderColor: "rgba(255,255,255,0.06)",
        timeVisible: false,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        barSpacing: 5,
        minBarSpacing: 3,
      },
      crosshair: {
        vertLine: { color: "rgba(148,163,184,0.32)", width: 1, style: 2 },
        horzLine: { color: "rgba(148,163,184,0.2)", width: 1, style: 2 },
      },
      localization: { locale: "ko-KR" },
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#00c2a8",
      downColor: "#ff6b57",
      borderUpColor: "#00c2a8",
      borderDownColor: "#ff6b57",
      wickUpColor: "rgba(0,194,168,0.85)",
      wickDownColor: "rgba(255,107,87,0.85)",
      lastPriceAnimation: LastPriceAnimationMode.Disabled,
    })

    const ma20Series = chart.addLineSeries({
      color: "#60a5fa",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    const ma60Series = chart.addLineSeries({
      color: "rgba(255,255,255,0.32)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
      base: 0,
    })

    candleSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.04, bottom: 0.22 },
    })
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.74, bottom: 0.02 },
    })

    candleSeries.setData(pack.candles)
    ma20Series.setData(pack.ma20)
    ma60Series.setData(pack.ma60)
    volumeSeries.setData(pack.volume)

    const last = pack.candles[pack.candles.length - 1]
    const prev = pack.candles.length >= 2 ? pack.candles[pack.candles.length - 2] : null
    if (last && prev) {
      const up = last.close >= last.open
      candleSeries.setMarkers([
        {
          time: last.time,
          position: "aboveBar",
          color: up ? "rgba(0,194,168,0.55)" : "rgba(255,107,87,0.5)",
          shape: "circle",
          size: 1.35,
        },
      ])
    }

    const onCrosshair = (param) => {
      if (!param.point || param.time === undefined) {
        setTooltip(null)
        return
      }
      const data = param.seriesData.get(candleSeries)
      if (!data || typeof data !== "object" || data.close == null) {
        setTooltip(null)
        return
      }
      const tkey = timeToKey(param.time)
      const extra = tkey ? metaRef.current.get(tkey) : null
      setTooltip({
        x: param.point.x,
        y: param.point.y,
        dateLabel: tkey ?? String(param.time),
        open: data.open,
        high: data.high,
        low: data.low,
        close: data.close,
        volume: extra?.volume ?? 0,
      })
    }

    chart.subscribeCrosshairMove(onCrosshair)
    chartRef.current = chart
    chart.timeScale().fitContent()

    let lastW = Math.max(1, Math.floor(el.clientWidth))
    let lastH = Math.max(1, Math.floor(el.clientHeight || 240))
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect
      if (!cr || !chartRef.current) return
      const w = Math.max(1, Math.floor(cr.width))
      const h = Math.max(1, Math.floor(cr.height))
      if (w === lastW && h === lastH) return
      lastW = w
      lastH = h
      requestAnimationFrame(() => {
        chartRef.current?.applyOptions({ width: w, height: h })
      })
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.unsubscribeCrosshairMove(onCrosshair)
      chart.remove()
      chartRef.current = null
      setTooltip(null)
    }
  }, [pack])

  if (!pack) {
    return (
      <div
        className={`flex min-h-[200px] items-center justify-center rounded-lg border border-white/[0.05] bg-black/30 px-3 text-center text-[11px] text-slate-600 ${className}`}
      >
        차트용 데이터가 부족합니다.
      </div>
    )
  }

  return (
    <div
      className={`relative w-full min-w-0 overflow-hidden rounded-lg border border-white/[0.07] bg-[#080b12] ${className}`}
      style={{
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 0 32px rgba(0,0,0,0.35)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.05] px-2.5 py-2 sm:px-3">
        <p className="m-0 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Mini · {seriesName}
        </p>
        <div className="flex flex-wrap items-center gap-3 text-[9px] text-slate-600">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#60a5fa" }} />
            MA20
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-px w-3 bg-white/35" />
            MA60
          </span>
          <span className="text-slate-500">Vol · |Δ| 합성</span>
          <span className="font-mono text-slate-600" style={{ color: accent }}>
            ●
          </span>
        </div>
      </div>

      <div className="relative h-[220px] w-full min-h-[200px] sm:h-[240px]">
        <div ref={wrapRef} className="absolute inset-0 h-full w-full" />

        {tooltip ? (
          <div
            className="pointer-events-none absolute z-20 min-w-[196px] rounded-md border border-white/[0.1] bg-[rgba(6,9,16,0.94)] px-2.5 py-2 shadow-[0_12px_32px_rgba(0,0,0,0.55)] backdrop-blur-sm"
            style={{
              left: Math.min(Math.max(tooltip.x + 12, 6), (wrapRef.current?.clientWidth ?? 280) - 204),
              top: Math.min(Math.max(tooltip.y + 6, 6), (wrapRef.current?.clientHeight ?? 220) - 130),
            }}
          >
            <p className="m-0 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">{tooltip.dateLabel}</p>
            <dl className="m-0 mt-1.5 grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-0.5 text-[10px] tabular-nums">
              <dt className="m-0 text-slate-600">O</dt>
              <dd className="m-0 text-right font-medium text-slate-100">{fmtPrice(tooltip.open)}</dd>
              <dt className="m-0 text-slate-600">H</dt>
              <dd className="m-0 text-right font-medium text-slate-100">{fmtPrice(tooltip.high)}</dd>
              <dt className="m-0 text-slate-600">L</dt>
              <dd className="m-0 text-right font-medium text-slate-100">{fmtPrice(tooltip.low)}</dd>
              <dt className="m-0 text-slate-600">C</dt>
              <dd className="m-0 text-right font-medium text-slate-100">{fmtPrice(tooltip.close)}</dd>
              <dt className="m-0 text-slate-600">Vol</dt>
              <dd className="m-0 text-right text-slate-200">{fmtVol(tooltip.volume)}</dd>
            </dl>
          </div>
        ) : null}
      </div>
    </div>
  )
}
