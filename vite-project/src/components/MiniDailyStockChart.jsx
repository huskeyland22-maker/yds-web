import { useEffect, useMemo, useRef, useState } from "react"
import { ColorType, createChart } from "lightweight-charts"

const CHART_H = 460
const DISPLAY_BARS = 66

const THEME = {
  bg: "#080b12",
  text: "rgba(203,213,225,0.82)",
  grid: "rgba(255,255,255,0.045)",
  border: "rgba(255,255,255,0.08)",
  up: "#22c55e",
  upWick: "#4ade80",
  down: "#ef4444",
  downWick: "#f87171",
  ma20: "#fbbf24",
  ma60: "#94a3b8",
  crosshair: "rgba(148,163,184,0.45)",
}

/** @param {string | null | undefined} dateRaw YYYYMMDD */
function ymdToTime(dateRaw) {
  const s = String(dateRaw || "").trim()
  if (s.length === 8 && /^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return null
}

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
 * @param {Array<{ date?: string; open: number; high: number; low: number; close: number; volume?: number; ma20?: number | null; ma60?: number | null }>} bars
 */
function buildTrendSummary(bars) {
  if (!bars?.length) {
    return { lines: [], stance: "데이터 부족", tone: "neutral", dayChgPct: null }
  }
  const last = bars[bars.length - 1]
  const prev = bars.length >= 2 ? bars[bars.length - 2] : null
  const m20 = last.ma20
  const m60 = last.ma60
  if (!Number.isFinite(last.close)) {
    return { lines: [], stance: "—", tone: "neutral", dayChgPct: null }
  }
  let stance = "추세 확인"
  let tone = "neutral"
  if (Number.isFinite(m20) && Number.isFinite(m60)) {
    if (m20 > m60 && last.close > m20) {
      stance = "상승 우위"
      tone = "up"
    } else if (m20 < m60 && last.close < m20) {
      stance = "하락·조정"
      tone = "down"
    } else {
      stance = "혼조"
    }
  }
  const lines = []
  if (Number.isFinite(m20) && Number.isFinite(m60)) {
    if (m20 > m60 && last.close > m20) lines.push("20>60 · 종가 단기 이평 상단")
    else if (m20 < m60 && last.close < m20) lines.push("20<60 · 종가 단기 이평 하단")
    else lines.push("이평 혼합 · 방향 대기")
  }
  let dayChgPct = null
  if (prev && Number.isFinite(prev.close) && prev.close > 0) {
    dayChgPct = ((last.close - prev.close) / prev.close) * 100
  }
  return { lines: lines.slice(0, 2), stance, tone, dayChgPct }
}

/**
 * @param {Array<{ date?: string; open: number; high: number; low: number; close: number; volume?: number; ma20?: number | null; ma60?: number | null }>} bars
 */
function prepareChartData(bars) {
  /** @type {Array<{ time: string; open: number; high: number; low: number; close: number }>} */
  const candles = []
  /** @type {Array<{ time: string; value: number }>} */
  const ma20d = []
  /** @type {Array<{ time: string; value: number }>} */
  const ma60d = []
  /** @type {Array<{ time: string; value: number; color: string }>} */
  const volume = []
  /** @type {Map<string, { open: number; high: number; low: number; close: number; volume: number; changePct: number; dateLabel: string }>} */
  const meta = new Map()

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i]
    const t = ymdToTime(b.date)
    if (!t) continue

    const up = b.close >= b.open
    candles.push({
      time: t,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    })

    if (b.ma20 != null && Number.isFinite(b.ma20)) ma20d.push({ time: t, value: b.ma20 })
    if (b.ma60 != null && Number.isFinite(b.ma60)) ma60d.push({ time: t, value: b.ma60 })

    volume.push({
      time: t,
      value: b.volume ?? 0,
      color: up ? "rgba(34,197,94,0.55)" : "rgba(239,68,68,0.55)",
    })

    const prevClose = i > 0 ? bars[i - 1].close : b.close
    const chg = prevClose ? ((b.close - prevClose) / prevClose) * 100 : 0
    const dateLabel = b.date && /^\d{8}$/.test(String(b.date))
      ? `${String(b.date).slice(4, 6)}/${String(b.date).slice(6, 8)}`
      : t
    meta.set(t, {
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume ?? 0,
      changePct: chg,
      dateLabel,
    })
  }

  return { candles, ma20: ma20d, ma60: ma60d, volume, meta }
}

/**
 * 프리미엄 일봉 캔들 · 거래량 · MA (lightweight-charts).
 * @param {{ bars: Array<{ date?: string; open: number; high: number; low: number; close: number; volume?: number; ma20?: number | null; ma60?: number | null }>; chartMeta?: object; className?: string }} props
 */
export default function MiniDailyStockChart({ bars, chartMeta, className = "" }) {
  const wrapRef = useRef(null)
  const chartRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)
  const metaRef = useRef(new Map())

  const normalizedBars = useMemo(() => {
    if (!Array.isArray(bars) || bars.length === 0) return []
    return bars
      .map((b) => {
        const c = Number(b.close)
        let o = Number(b.open)
        let h = Number(b.high)
        let l = Number(b.low)
        if (!Number.isFinite(c)) return null
        if (!Number.isFinite(o)) o = c
        if (!Number.isFinite(h)) h = Math.max(o, c)
        if (!Number.isFinite(l)) l = Math.min(o, c)
        h = Math.max(h, o, c)
        l = Math.min(l, o, c)
        return {
          ...b,
          open: o,
          high: h,
          low: l,
          close: c,
          volume: Math.max(0, b.volume ?? 0),
          ma20: b.ma20 ?? null,
          ma60: b.ma60 ?? null,
        }
      })
      .filter(Boolean)
  }, [bars])

  const trendPack = useMemo(() => buildTrendSummary(normalizedBars), [normalizedBars])
  const chartPack = useMemo(() => prepareChartData(normalizedBars), [normalizedBars])

  useEffect(() => {
    metaRef.current = chartPack.meta
  }, [chartPack.meta])

  useEffect(() => {
    const el = wrapRef.current
    if (!el || chartPack.candles.length < 2) return undefined

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: THEME.bg },
        textColor: THEME.text,
        fontSize: 11,
        fontFamily: "'IBM Plex Mono', 'Pretendard', ui-monospace, monospace",
      },
      grid: {
        vertLines: { color: THEME.grid },
        horzLines: { color: THEME.grid },
      },
      width: el.clientWidth,
      height: el.clientHeight || CHART_H,
      rightPriceScale: {
        borderColor: THEME.border,
        scaleMargins: { top: 0.06, bottom: 0.22 },
      },
      timeScale: {
        borderColor: THEME.border,
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: false,
        fixRightEdge: false,
        barSpacing: 7,
        minBarSpacing: 3,
        rightOffset: 6,
      },
      crosshair: {
        mode: 1,
        vertLine: { color: THEME.crosshair, width: 1, style: 2, labelBackgroundColor: "#1e293b" },
        horzLine: { color: THEME.crosshair, width: 1, style: 2, labelBackgroundColor: "#1e293b" },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: { time: true, price: true },
      },
      localization: { locale: "ko-KR" },
    })

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    })
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
      borderVisible: false,
    })

    const ma60Series = chart.addLineSeries({
      color: THEME.ma60,
      lineWidth: 2,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
    })

    const ma20Series = chart.addLineSeries({
      color: THEME.ma20,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor: THEME.up,
      downColor: THEME.down,
      borderVisible: true,
      borderUpColor: THEME.up,
      borderDownColor: THEME.down,
      wickUpColor: THEME.upWick,
      wickDownColor: THEME.downWick,
      priceLineVisible: true,
      priceLineWidth: 1,
      priceLineColor: "rgba(148,163,184,0.55)",
      priceLineStyle: 2,
      lastValueVisible: true,
    })

    volumeSeries.setData(chartPack.volume)
    ma60Series.setData(chartPack.ma60)
    ma20Series.setData(chartPack.ma20)
    candleSeries.setData(chartPack.candles)

    const n = chartPack.candles.length
    const visible = Math.min(DISPLAY_BARS, n)
    if (visible > 0) {
      chart.timeScale().setVisibleLogicalRange({
        from: n - visible,
        to: n + 2,
      })
    } else {
      chart.timeScale().fitContent()
    }

    const onCrosshair = (param) => {
      if (!param.point || param.time === undefined) {
        setTooltip(null)
        return
      }
      const candle = param.seriesData.get(candleSeries)
      if (!candle || typeof candle !== "object" || candle.close == null) {
        setTooltip(null)
        return
      }
      const tkey = timeToKey(param.time)
      const extra = tkey ? metaRef.current.get(tkey) : null
      setTooltip({
        x: param.point.x,
        y: param.point.y,
        dateLabel: extra?.dateLabel ?? String(param.time),
        open: extra?.open ?? candle.open,
        high: extra?.high ?? candle.high,
        low: extra?.low ?? candle.low,
        close: candle.close,
        changePct: extra?.changePct ?? 0,
        volume: extra?.volume ?? 0,
      })
    }

    chart.subscribeCrosshairMove(onCrosshair)
    chartRef.current = chart

    let lastW = Math.max(1, Math.floor(el.clientWidth))
    let lastH = Math.max(1, Math.floor(el.clientHeight || CHART_H))
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
  }, [chartPack])

  if (normalizedBars.length < 2) return null

  const meta = chartMeta && typeof chartMeta === "object" ? chartMeta : null
  const sessionLabel = meta?.sessionLabel ?? "일봉 OHLC"
  const sourceLabel = meta?.dataSourceLabel ?? "—"
  const updateBasis = meta?.updateBasisLabelKst ?? meta?.asOfLabelKst ?? meta?.updatedLabelKst ?? "—"
  const delayNote = meta?.delayNote ?? null
  const refClose =
    meta?.lastClose != null && Number.isFinite(Number(meta.lastClose))
      ? Number(meta.lastClose)
      : normalizedBars[normalizedBars.length - 1]?.close

  const toneClass =
    trendPack.tone === "up"
      ? "border-l-emerald-500/70"
      : trendPack.tone === "down"
        ? "border-l-rose-500/65"
        : "border-l-slate-500/50"

  return (
    <div
      className={`relative w-full min-w-0 overflow-hidden rounded-xl border border-white/[0.08] bg-[#080b12] ${className}`}
    >
      <div className={`border-b border-white/[0.06] bg-[#0c1018] px-3 py-2.5 md:px-4 ${toneClass} border-l-[3px]`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[13px] font-semibold text-slate-100">{trendPack.stance}</span>
            {trendPack.dayChgPct != null ? (
              <span
                className={`font-mono text-[12px] font-semibold tabular-nums ${
                  trendPack.dayChgPct >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {trendPack.dayChgPct >= 0 ? "+" : ""}
                {trendPack.dayChgPct.toFixed(2)}%
              </span>
            ) : null}
            {refClose != null ? (
              <span className="font-mono text-[12px] tabular-nums text-slate-400">{fmtPrice(refClose)}</span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[9px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-500" />
              캔들
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-0.5 w-3 bg-amber-400" />
              MA20
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-0.5 w-3 border-b border-dashed border-slate-400" />
              MA60
            </span>
          </div>
        </div>
        {trendPack.lines[0] ? <p className="m-0 mt-1 text-[10px] text-slate-500">{trendPack.lines[0]}</p> : null}
      </div>

      <div className="border-b border-white/[0.05] bg-[#0a0e16] px-3 py-2 text-[10px] leading-relaxed text-slate-400 md:px-4">
        <p className="m-0 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">업데이트 기준</p>
        <p className="m-0 mt-1 font-mono text-[11px] tabular-nums text-slate-200">{updateBasis}</p>
        <p className="m-0 mt-1 font-medium text-slate-300">{sessionLabel}</p>
        {delayNote ? <p className="m-0 mt-0.5 text-slate-500">{delayNote}</p> : null}
        <p className="m-0 mt-0.5 font-mono text-[9px] text-slate-600">{sourceLabel}</p>
        {meta?.ohlcPriority ? (
          <p className="m-0 mt-0.5 text-[9px] text-slate-600">OHLC · {meta.ohlcPriority === "regular_close" ? "정규장 마감 우선" : meta.ohlcPriority}</p>
        ) : null}
      </div>

      <div
        className="relative w-full min-h-[420px] sm:min-h-[460px]"
        style={{ height: CHART_H }}
      >
        <div ref={wrapRef} className="absolute inset-0 h-full w-full touch-pan-x" />

        {tooltip ? (
          <div
            className="pointer-events-none absolute z-20 min-w-[200px] rounded-md border border-white/10 bg-[#0f141c]/96 px-2.5 py-2 shadow-lg backdrop-blur-sm"
            style={{
              left: Math.min(Math.max(tooltip.x + 12, 8), (wrapRef.current?.clientWidth ?? 360) - 210),
              top: Math.min(Math.max(tooltip.y + 8, 8), (wrapRef.current?.clientHeight ?? CHART_H) - 130),
            }}
          >
            <p className="m-0 font-mono text-[9px] text-slate-500">{tooltip.dateLabel}</p>
            <p className="m-0 mt-1 font-mono text-[11px] tabular-nums text-slate-200">
              O {fmtPrice(tooltip.open)} · H {fmtPrice(tooltip.high)}
            </p>
            <p className="m-0 font-mono text-[11px] tabular-nums text-slate-200">
              L {fmtPrice(tooltip.low)} · C {fmtPrice(tooltip.close)}
            </p>
            <p
              className={`m-0 mt-1 font-mono text-[11px] font-semibold tabular-nums ${
                tooltip.changePct >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {tooltip.changePct >= 0 ? "+" : ""}
              {tooltip.changePct.toFixed(2)}%
            </p>
            <p className="m-0 mt-1 font-mono text-[10px] text-slate-500">Vol {fmtVol(tooltip.volume)}</p>
          </div>
        ) : null}

        <p className="pointer-events-none absolute bottom-1 right-2 z-10 font-mono text-[9px] text-slate-600">
          휠·핀치 확대 · 드래그 이동
        </p>
      </div>
    </div>
  )
}
