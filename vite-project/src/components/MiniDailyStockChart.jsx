import { useEffect, useMemo, useRef, useState } from "react"
import { ColorType, LastPriceAnimationMode, createChart } from "lightweight-charts"

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

function formatDateLabel(dateRaw) {
  const t = ymdToTime(dateRaw)
  return t || "—"
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
  if (!bars?.length || bars.length < 3) return []
  const last = bars[bars.length - 1]
  const prev = bars[bars.length - 2]
  const m20 = last.ma20
  const m60 = last.ma60
  if (!Number.isFinite(last.close)) return []
  const lines = []
  if (Number.isFinite(m20) && Number.isFinite(m60)) {
    if (m20 > m60 && last.close > m20) lines.push("상승 추세 유지 · 종가 20일선 상단")
    else if (m20 < m60 && last.close < m20) lines.push("조정 국면 · 종가 20일선 하단")
    else if (last.close >= m20 * 0.997 && last.close <= m20 * 1.007) lines.push("20일선 지지·되돌림 구간")
    else lines.push("이평 혼합 · 추세 확인")
  }
  const vols = bars.map((b) => b.volume ?? 0)
  const n = vols.length
  const from = Math.max(0, n - 21)
  let s = 0
  let c = 0
  for (let i = from; i < n - 1; i++) {
    s += vols[i] || 0
    c += 1
  }
  const avg = c > 0 ? s / c : 0
  const lv = last.volume || 0
  if (avg > 0 && lv >= avg * 1.35) {
    if (Number.isFinite(prev.close) && last.close >= prev.close) lines.push("거래량 동반 상승")
    else lines.push("거래 급증 · 매물 소화 여부 확인")
  }
  if (Number.isFinite(prev.close) && prev.close > 0 && last.close > prev.close * 1.04) {
    lines.push("단기 급등 구간 · 과열 감시")
  }
  return lines.slice(0, 3)
}

/**
 * @param {Array<{ date?: string; open: number; high: number; low: number; close: number; volume?: number; ma20?: number | null; ma60?: number | null }>} bars
 */
function prepareChartData(bars) {
  const vols = bars.map((b) => b.volume ?? 0)
  /** @type {Array<{ time: string; open: number; high: number; low: number; close: number }>} */
  const candles = []
  /** @type {Array<{ time: string; value: number }>} */
  const ma20d = []
  /** @type {Array<{ time: string; value: number }>} */
  const ma60d = []
  /** @type {Array<{ time: string; value: number; color: string }>} */
  const hist = []
  /** @type {Map<string, { volume: number; changePct: number; dateLabel: string }>} */
  const meta = new Map()

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i]
    const t = ymdToTime(b.date)
    if (!t) continue
    candles.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close })
    if (b.ma20 != null && Number.isFinite(b.ma20)) ma20d.push({ time: t, value: b.ma20 })
    if (b.ma60 != null && Number.isFinite(b.ma60)) ma60d.push({ time: t, value: b.ma60 })

    let volSma = 0
    let cnt = 0
    for (let j = Math.max(0, i - 19); j <= i; j++) {
      volSma += vols[j] || 0
      cnt += 1
    }
    volSma = cnt ? volSma / cnt : 0
    const v = vols[i] || 0
    const spike = volSma > 0 && v >= volSma * 1.35
    const up = b.close >= b.open
    let color = up ? "rgba(0,194,168,0.26)" : "rgba(255,107,87,0.26)"
    if (spike) color = up ? "rgba(0,194,168,0.58)" : "rgba(255,107,87,0.52)"
    hist.push({ time: t, value: v, color })

    const prevClose = i > 0 ? bars[i - 1].close : b.close
    const chg = prevClose ? ((b.close - prevClose) / prevClose) * 100 : 0
    meta.set(t, { volume: v, changePct: chg, dateLabel: formatDateLabel(b.date) })
  }

  return { candles, ma20: ma20d, ma60: ma60d, volume: hist, meta }
}

/**
 * 밸류체인 우측 패널 — TradingView 스타일 미니 캔들 + 20/60 MA + 거래량 (lightweight-charts).
 * @param {{ bars: Array<{ date?: string; open: number; high: number; low: number; close: number; volume?: number; ma20?: number | null; ma60?: number | null }>; className?: string }} props
 */
export default function MiniDailyStockChart({ bars, className = "" }) {
  const wrapRef = useRef(null)
  const chartRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)
  const metaRef = useRef(new Map())

  const normalizedBars = useMemo(() => {
    if (!Array.isArray(bars) || bars.length === 0) return []
    return bars.map((b) => {
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
    }).filter(Boolean)
  }, [bars])

  const trendLines = useMemo(() => buildTrendSummary(normalizedBars), [normalizedBars])

  const chartPack = useMemo(() => prepareChartData(normalizedBars), [normalizedBars])

  useEffect(() => {
    metaRef.current = chartPack.meta
  }, [chartPack.meta])

  useEffect(() => {
    const el = wrapRef.current
    if (!el || chartPack.candles.length < 2) return undefined

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "#0b101a" },
        textColor: "rgba(148,163,184,0.82)",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      width: el.clientWidth,
      height: el.clientHeight || 300,
      rightPriceScale: { borderColor: "rgba(255,255,255,0.07)" },
      timeScale: {
        borderColor: "rgba(255,255,255,0.07)",
        timeVisible: false,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        barSpacing: 5,
        minBarSpacing: 3,
      },
      crosshair: {
        vertLine: { color: "rgba(148,163,184,0.35)", width: 1, style: 2 },
        horzLine: { color: "rgba(148,163,184,0.22)", width: 1, style: 2 },
      },
      localization: { locale: "ko-KR" },
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#00c2a8",
      downColor: "#ff6b57",
      borderUpColor: "#00c2a8",
      borderDownColor: "#ff6b57",
      wickUpColor: "#00c2a8",
      wickDownColor: "#ff6b57",
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
      color: "rgba(255,255,255,0.35)",
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
      scaleMargins: { top: 0.06, bottom: 0.24 },
    })
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.76, bottom: 0.02 },
    })

    candleSeries.setData(chartPack.candles)
    ma20Series.setData(chartPack.ma20)
    ma60Series.setData(chartPack.ma60)
    volumeSeries.setData(chartPack.volume)

    const last = chartPack.candles[chartPack.candles.length - 1]
    if (last) {
      candleSeries.setMarkers([
        {
          time: last.time,
          position: "aboveBar",
          color: "rgba(0,194,168,0.42)",
          shape: "circle",
          size: 1.1,
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
      const changePct = extra?.changePct ?? 0
      setTooltip({
        x: param.point.x,
        y: param.point.y,
        dateLabel: extra?.dateLabel ?? String(param.time),
        open: data.open,
        high: data.high,
        low: data.low,
        close: data.close,
        changePct,
        volume: extra?.volume ?? 0,
      })
    }

    chart.subscribeCrosshairMove(onCrosshair)

    chartRef.current = chart

    let lastW = Math.max(1, Math.floor(el.clientWidth))
    let lastH = Math.max(1, Math.floor(el.clientHeight || 300))
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

  return (
    <div
      className={`relative w-full min-w-0 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0b101a] ${className}`}
      style={{
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 0 40px rgba(0,0,0,0.35)",
      }}
    >
      {trendLines.length ? (
        <div className="border-b border-white/[0.06] px-3 py-2.5 md:px-3.5">
          <p className="m-0 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">추세·체크</p>
          <ul className="m-0 mt-1.5 list-none space-y-1 p-0">
            {trendLines.map((line) => (
              <li key={line} className="text-[11px] leading-snug text-slate-300 md:text-[12px]">
                · {line}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-3 text-[9px] text-slate-600">
            <span>
              <span className="inline-block h-2 w-2 rounded-full align-middle" style={{ background: "#60a5fa" }} />{" "}
              <span className="align-middle">MA20</span>
            </span>
            <span>
              <span className="inline-block h-px w-3 align-middle bg-white/35" /> <span className="align-middle">MA60</span>
            </span>
            <span className="text-slate-500">Vol · 급증 시 강조</span>
          </div>
        </div>
      ) : null}

      <div className="relative h-[min(320px,48vh)] w-full min-h-[260px] sm:min-h-[280px]">
        <div ref={wrapRef} className="absolute inset-0 h-full w-full" />

        {tooltip ? (
          <div
            className="pointer-events-none absolute z-20 min-w-[200px] rounded-lg border border-white/[0.1] bg-[rgba(8,12,22,0.94)] px-3 py-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.55)] backdrop-blur-md"
            style={{
              left: Math.min(Math.max(tooltip.x + 14, 8), (wrapRef.current?.clientWidth ?? 300) - 210),
              top: Math.min(Math.max(tooltip.y + 8, 8), (wrapRef.current?.clientHeight ?? 280) - 140),
            }}
          >
            <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{tooltip.dateLabel}</p>
            <dl className="m-0 mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] tabular-nums">
              <dt className="m-0 text-slate-500">O</dt>
              <dd className="m-0 text-right font-medium text-slate-100">{fmtPrice(tooltip.open)}</dd>
              <dt className="m-0 text-slate-500">H</dt>
              <dd className="m-0 text-right font-medium text-slate-100">{fmtPrice(tooltip.high)}</dd>
              <dt className="m-0 text-slate-500">L</dt>
              <dd className="m-0 text-right font-medium text-slate-100">{fmtPrice(tooltip.low)}</dd>
              <dt className="m-0 text-slate-500">C</dt>
              <dd className="m-0 text-right font-medium text-slate-100">{fmtPrice(tooltip.close)}</dd>
              <dt className="m-0 text-slate-500">등락</dt>
              <dd
                className={`m-0 text-right font-semibold ${tooltip.changePct >= 0 ? "text-[#00c2a8]" : "text-[#ff6b57]"}`}
              >
                {tooltip.changePct >= 0 ? "+" : ""}
                {tooltip.changePct.toFixed(2)}%
              </dd>
              <dt className="m-0 text-slate-500">Vol</dt>
              <dd className="m-0 text-right text-slate-200">{fmtVol(tooltip.volume)}</dd>
            </dl>
          </div>
        ) : null}
      </div>
    </div>
  )
}
