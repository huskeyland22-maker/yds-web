import { useEffect, useMemo, useRef, useState } from "react"
import { ColorType, LastPriceAnimationMode, LineType, createChart } from "lightweight-charts"
import { useIsMobileLayout } from "../hooks/useIsMobileLayout.js"
import {
  chartTimeToDayKey,
  formatChartAxisTick,
  formatChartTooltip,
} from "../utils/chartDateFormat.js"
import { formatMetricValue, resolveSeriesColor } from "./macroCycleChartUtils.js"

/** 플롯 끝 ↔ 마지막 포인트 간격 (우측 값 레인 w-[72px] sm:w-[96px] 는 JSX) */
const PLOT_END_INSET_PX = 24

function rowDay(row) {
  const t = row?.ts
  if (t && /^\d{4}-\d{2}-\d{2}/.test(String(t))) return String(t).slice(0, 10)
  return null
}

function fmtVol(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—"
  return Number(n).toLocaleString("ko-KR", { maximumFractionDigits: 0 })
}

/** @typedef {'riskOn'|'neutral'|'riskOff'} FlowRegime */

/**
 * 단일 시계열(일별) → 종가 라인용 포인트 + MA20/60 + 보조 거래량(합성) + 메타.
 * @param {object[]} rows
 * @param {string} primaryKey
 */
function buildLwPack(rows, primaryKey) {
  const sorted = [...(rows || [])]
    .filter((r) => rowDay(r) && Number.isFinite(Number(r[primaryKey])))
    .sort((a, b) => String(rowDay(a)).localeCompare(String(rowDay(b))))
    .slice(-120)

  if (sorted.length < 2) return null

  /** @type {{ time: string; close: number; open: number; _v: number }[]} */
  const raw = []
  for (let i = 0; i < sorted.length; i++) {
    const close = Number(sorted[i][primaryKey])
    const open = i > 0 ? Number(sorted[i - 1][primaryKey]) : close
    const rng = Math.abs(close - open)
    const vol = rng * 1e6 + Math.abs(close) * 2e3 + 50
    raw.push({
      time: rowDay(sorted[i]),
      open,
      close,
      _v: vol,
    })
  }

  /** @type {{ time: string; value: number }[]} */
  const closes = raw.map((r) => ({ time: r.time, value: r.close }))

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
    let color = up ? "rgba(45,212,191,0.08)" : "rgba(251,113,133,0.08)"
    if (spike) color = up ? "rgba(45,212,191,0.16)" : "rgba(251,113,133,0.14)"
    return { time: r.time, value: r._v, color }
  })

  /** @type {Map<string, { close: number; volume: number; changePct: number }>} */
  const meta = new Map()
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i]
    const prevClose = i > 0 ? raw[i - 1].close : r.close
    const chg = prevClose ? ((r.close - prevClose) / Math.abs(prevClose)) * 100 : 0
    meta.set(r.time, { close: r.close, volume: r._v, changePct: chg })
  }

  const last = raw[raw.length - 1].close
  const prev = raw[raw.length - 2].close
  const ma20v = ma20.length ? ma20[ma20.length - 1].value : NaN
  const ma60v = ma60.length ? ma60[ma60.length - 1].value : NaN
  const dayChg = prev ? ((last - prev) / Math.abs(prev)) * 100 : 0

  /** @type {FlowRegime} */
  let regime = "neutral"
  if (Number.isFinite(ma20v) && Number.isFinite(ma60v)) {
    if (last >= ma20v && ma20v >= ma60v * 0.997) regime = "riskOn"
    if (last <= ma20v && ma20v <= ma60v * 1.003) regime = "riskOff"
  }
  if (dayChg <= -1.2) regime = "riskOff"
  if (dayChg >= 1.2 && regime !== "riskOff") regime = "riskOn"

  return { closes, ma20, ma60, volume, meta, regime, primaryKey }
}

/** @param {FlowRegime} regime */
function regimeAreaStyle(regime) {
  if (regime === "riskOn") {
    return {
      line: "#5eead4",
      glow: "rgba(45,212,191,0.22)",
      top: "rgba(94,234,212,0.32)",
      bottom: "rgba(7,10,16,0)",
      priceLine: "rgba(52,211,153,0.75)",
    }
  }
  if (regime === "riskOff") {
    return {
      line: "#fcd34d",
      glow: "rgba(251,191,36,0.18)",
      top: "rgba(252,211,77,0.22)",
      bottom: "rgba(7,10,16,0)",
      priceLine: "rgba(251,191,36,0.72)",
    }
  }
  return {
    line: "#38bdf8",
    glow: "rgba(56,189,248,0.2)",
    top: "rgba(56,189,248,0.26)",
    bottom: "rgba(7,10,16,0)",
    priceLine: "rgba(34,211,238,0.78)",
  }
}

/**
 * @param {{
 *   rows: object[]
 *   primarySeries: { key: string; name?: string; color?: string }
 *   className?: string
 * }} props
 */
export default function MacroCycleLwChart({ rows, primarySeries, className = "", compact = false }) {
  const isMobile = useIsMobileLayout()
  const wrapRef = useRef(null)
  const chartRef = useRef(null)
  const metaRef = useRef(new Map())
  const [tooltip, setTooltip] = useState(null)
  const [chartIn, setChartIn] = useState(false)
  const [lastValueTopPx, setLastValueTopPx] = useState(null)

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
    if (!el || !pack || pack.closes.length < 2) return undefined

    const rs = regimeAreaStyle(pack.regime)

    const plotRightPadding = PLOT_END_INSET_PX
    const endBarOffset = Math.max(4, Math.ceil(plotRightPadding / 9))

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "#070a10" },
        textColor: "rgba(148,163,184,0.62)",
        fontSize: 10,
        padding: { right: plotRightPadding },
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(255,255,255,0.009)" },
      },
      width: el.clientWidth,
      height: el.clientHeight || 360,
      rightPriceScale: { borderColor: "rgba(148,163,184,0.08)" },
      timeScale: {
        borderColor: "rgba(34,211,238,0.08)",
        timeVisible: false,
        secondsVisible: false,
        fixLeftEdge: false,
        fixRightEdge: true,
        rightOffset: endBarOffset,
        barSpacing: 9,
        minBarSpacing: 5,
        tickMarkFormatter: (time) => {
          const key = chartTimeToDayKey(time)
          return key ? formatChartAxisTick(key, { mobile: isMobile, compact }) : ""
        },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: "rgba(148,163,184,0.22)",
          width: 1,
          style: 0,
          labelBackgroundColor: "rgba(15,23,42,0.94)",
        },
        horzLine: {
          color: "rgba(34,211,238,0.28)",
          width: 1,
          style: 0,
          labelBackgroundColor: "rgba(15,23,42,0.94)",
        },
      },
      localization: {
        locale: "en-US",
        dateFormat: "yyyy-MM-dd",
        timeFormatter: (time) => {
          const key = chartTimeToDayKey(time)
          return key ? formatChartTooltip(key) : ""
        },
      },
    })

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
      base: 0,
    })

    const glowSeries = chart.addLineSeries({
      color: rs.glow,
      lineWidth: 7,
      lineType: LineType.Curved,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })

    const ma60Series = chart.addLineSeries({
      color: "rgba(148,163,184,0.2)",
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })

    const ma20Series = chart.addLineSeries({
      color: "rgba(56,189,248,0.26)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })

    const priceSeries = chart.addAreaSeries({
      lineColor: rs.line,
      topColor: rs.top,
      bottomColor: rs.bottom,
      lineWidth: 4,
      lineType: LineType.Curved,
      lastPriceAnimation: LastPriceAnimationMode.Continuous,
      priceLineVisible: true,
      priceLineWidth: 1,
      priceLineColor: rs.priceLine,
      priceLineStyle: 2,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerBorderColor: "rgba(236,254,255,0.9)",
      crosshairMarkerBackgroundColor: rs.line,
    })

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.94, bottom: 0 },
    })
    priceSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.06, bottom: 0.08 },
    })

    volumeSeries.setData(pack.volume)
    glowSeries.setData(pack.closes)
    ma60Series.setData(pack.ma60)
    ma20Series.setData(pack.ma20)
    priceSeries.setData(pack.closes)

    const last = pack.closes[pack.closes.length - 1]
    if (last) {
      priceSeries.setMarkers([
        {
          time: last.time,
          position: "inBar",
          shape: "circle",
          color: "#ecfeff",
          size: 2.2,
          borderColor: rs.line,
          borderWidth: 2,
        },
      ])
    }

    const onCrosshair = (param) => {
      if (!param.point || param.time === undefined) {
        setTooltip(null)
        return
      }
      const data = param.seriesData.get(priceSeries)
      if (!data || typeof data !== "object" || data.value == null) {
        setTooltip(null)
        return
      }
      const tkey = chartTimeToDayKey(param.time)
      const extra = tkey ? metaRef.current.get(tkey) : null
      setTooltip({
        x: param.point.x,
        y: param.point.y,
        dateLabel: tkey ? formatChartTooltip(tkey) : String(param.time),
        value: data.value,
        volume: extra?.volume ?? 0,
        changePct: extra?.changePct ?? 0,
      })
    }

    const syncLastValueTop = () => {
      const last = pack.closes[pack.closes.length - 1]
      if (!last) {
        setLastValueTopPx(null)
        return
      }
      const y = priceSeries.priceToCoordinate(last.value)
      if (y == null || !Number.isFinite(Number(y))) {
        setLastValueTopPx(null)
        return
      }
      setLastValueTopPx(Number(y))
    }

    chart.subscribeCrosshairMove(onCrosshair)
    chartRef.current = chart
    chart.timeScale().fitContent()

    const n = pack.closes.length
    if (n >= 16) {
      requestAnimationFrame(() => {
        try {
          chart.timeScale().setVisibleLogicalRange({ from: n - 15, to: n - 1 })
        } catch {
          /* ignore */
        }
        syncLastValueTop()
      })
    } else {
      syncLastValueTop()
    }

    const onVisibleRange = () => syncLastValueTop()
    chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleRange)

    let lastW = Math.max(1, Math.floor(el.clientWidth))
    let lastH = Math.max(1, Math.floor(el.clientHeight || 360))
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
        syncLastValueTop()
      })
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onVisibleRange)
      chart.unsubscribeCrosshairMove(onCrosshair)
      chart.remove()
      chartRef.current = null
      setTooltip(null)
      setLastValueTopPx(null)
    }
  }, [pack, isMobile, compact])

  useEffect(() => {
    if (!pack) {
      setChartIn(false)
      return undefined
    }
    setChartIn(false)
    const id = requestAnimationFrame(() => setChartIn(true))
    return () => cancelAnimationFrame(id)
  }, [pack])

  const regimeLabel =
    pack?.regime === "riskOn" ? "위험 선호 흐름" : pack?.regime === "riskOff" ? "위험 회피 흐름" : "중립 흐름"

  const lastPoint = pack?.closes?.[pack?.closes?.length - 1]
  const prevPoint = pack?.closes?.[pack?.closes?.length - 2]
  const lastValue = lastPoint && Number.isFinite(lastPoint.value) ? lastPoint.value : null
  const dayChgPct =
    lastValue != null && prevPoint && Number.isFinite(prevPoint.value) && Math.abs(prevPoint.value) > 1e-9
      ? ((lastValue - prevPoint.value) / Math.abs(prevPoint.value)) * 100
      : null

  if (!pack) {
    return (
      <div
        className={`flex min-h-[200px] items-center justify-center rounded-lg border border-white/[0.05] bg-black/30 px-3 text-center text-[11px] text-slate-600 ${className}`}
      >
        실제 데이터 없음 (차트 히스토리 미수신)
      </div>
    )
  }

  return (
    <div
      className={`relative w-full min-w-0 overflow-hidden rounded-lg border border-white/[0.08] bg-[#070a10] ring-1 ring-violet-500/[0.06] transition-opacity duration-500 ease-out ${chartIn ? "opacity-100" : "opacity-0"} ${className}`}
      style={{
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 0 32px rgba(0,0,0,0.35)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-gradient-to-r from-white/[0.03] to-transparent px-2.5 py-2 sm:px-3">
        <div className="min-w-0">
          <p className="m-0 text-[9px] font-semibold tracking-[0.12em] text-slate-500">데스크</p>
          <p className="m-0 mt-0.5 truncate text-[12px] font-semibold text-slate-100 sm:text-[13px]">{seriesName}</p>
          <p className="m-0 mt-0.5 text-[8px] font-medium tracking-wide text-slate-600">{regimeLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[9px] text-slate-600">
          <span className="inline-flex items-center gap-1.5 text-slate-600">
            <span className="inline-block h-2 w-5 rounded-full bg-gradient-to-r from-teal-400/85 to-cyan-300/75 shadow-[0_0_10px_rgba(45,212,191,0.35)]" />
            일별 흐름
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-sky-400/45" />
            MA20
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-px w-3 bg-white/28" />
            MA60
          </span>
          <span className="text-slate-600">Vol · 최소</span>
          <span className="font-mono text-slate-600" style={{ color: accent }}>
            ●
          </span>
        </div>
      </div>

      <div
        className={
          compact
            ? "relative h-[min(52vw,242px)] w-full min-h-[220px] sm:h-[286px] sm:min-h-[242px]"
            : "relative h-[360px] w-full min-h-[280px] sm:h-[400px] sm:min-h-[300px]"
        }
      >
        <div className="relative flex h-full w-full min-h-0">
          <div className="relative min-h-0 min-w-0 flex-1">
            <div ref={wrapRef} className="absolute inset-0 h-full w-full" />

            {tooltip ? (
              <div
                className="pointer-events-none absolute z-20 min-w-[188px] rounded-md border border-white/[0.1] bg-[rgba(6,9,16,0.94)] px-2.5 py-2 shadow-[0_12px_32px_rgba(0,0,0,0.55)] backdrop-blur-sm"
                style={{
                  left: Math.min(Math.max(tooltip.x + 12, 6), (wrapRef.current?.clientWidth ?? 280) - 196),
                  top: Math.min(Math.max(tooltip.y + 6, 6), (wrapRef.current?.clientHeight ?? 360) - 120),
                }}
              >
                <p className="m-0 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">{tooltip.dateLabel}</p>
                <p className="m-0 mt-1.5 font-mono text-lg font-semibold tabular-nums leading-none text-slate-50">
                  {formatMetricValue(pack.primaryKey, tooltip.value)}
                </p>
                <p
                  className={`m-0 mt-1 font-mono text-[11px] font-semibold tabular-nums ${
                    (tooltip.changePct ?? 0) >= 0 ? "text-emerald-300/95" : "text-rose-300/95"
                  }`}
                >
                  {Number(tooltip.changePct ?? 0) >= 0 ? "+" : ""}
                  {Number(tooltip.changePct ?? 0).toFixed(2)}%{" "}
                  <span className="text-[9px] font-medium text-slate-600">vs 전일</span>
                </p>
                <p className="m-0 mt-2 border-t border-white/[0.06] pt-2 font-mono text-[9px] text-slate-600">
                  Vol <span className="text-slate-500">{fmtVol(tooltip.volume)}</span>
                </p>
              </div>
            ) : null}
          </div>

          <div
            className="relative h-full w-[72px] shrink-0 sm:w-[96px]"
            aria-hidden={lastValue == null}
          >
            {lastValue != null && lastValueTopPx != null ? (
              <div
                className="pointer-events-none absolute right-2 z-[1] text-right"
                style={{ top: lastValueTopPx, transform: "translateY(-50%)" }}
              >
                <div
                  className={`rounded-lg border bg-[rgba(7,10,16,0.9)] px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm sm:px-3 sm:py-2 ${
                pack.regime === "riskOn"
                  ? "border-emerald-400/30 shadow-[0_0_20px_rgba(52,211,153,0.12)]"
                  : pack.regime === "riskOff"
                    ? "border-amber-400/35 shadow-[0_0_20px_rgba(251,191,36,0.12)]"
                    : "border-cyan-400/30 shadow-[0_0_20px_rgba(34,211,238,0.12)]"
              }`}
            >
              <p className="m-0 text-[8px] font-semibold tracking-[0.12em] text-cyan-300/75">현재</p>
              <p className="m-0 mt-0.5 flex items-center justify-end gap-2">
                <span className="relative inline-flex h-2.5 w-2.5 shrink-0 items-center justify-center">
                  <span
                    className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      pack.regime === "riskOn"
                        ? "bg-emerald-400"
                        : pack.regime === "riskOff"
                          ? "bg-amber-400"
                          : "bg-cyan-400"
                    } animate-ping`}
                  />
                  <span
                    className={`relative inline-block h-2 w-2 rounded-full ${
                      pack.regime === "riskOn"
                        ? "bg-emerald-200 shadow-[0_0_10px_rgba(52,211,153,0.9)]"
                        : pack.regime === "riskOff"
                          ? "bg-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.85)]"
                          : "bg-cyan-100 shadow-[0_0_10px_rgba(34,211,238,0.85)]"
                    }`}
                  />
                </span>
                <span className="font-mono text-lg font-semibold tabular-nums leading-none text-slate-50 sm:text-xl">
                  {formatMetricValue(pack.primaryKey, lastValue)}
                </span>
              </p>
              {dayChgPct != null && Number.isFinite(dayChgPct) ? (
                <p
                  className={`m-0 mt-1 font-mono text-[11px] font-semibold tabular-nums ${
                    dayChgPct >= 0 ? "text-emerald-300/95" : "text-rose-300/95"
                  }`}
                >
                  {dayChgPct >= 0 ? "+" : ""}
                  {dayChgPct.toFixed(2)}% <span className="text-[9px] font-medium text-slate-600">1D</span>
                </p>
              ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
