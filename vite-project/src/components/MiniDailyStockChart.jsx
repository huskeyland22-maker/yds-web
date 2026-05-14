import { useEffect, useMemo, useRef, useState } from "react"
import { ColorType, LastPriceAnimationMode, LineType, createChart } from "lightweight-charts"

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
 * @returns {{ lines: string[]; stance: string; tone: "up" | "down" | "neutral"; dayChgPct: number | null; volRatio: number | null }}
 */
function buildTrendSummary(bars) {
  if (!bars?.length) {
    return { lines: [], stance: "데이터 부족", tone: "neutral", dayChgPct: null, volRatio: null }
  }
  const last = bars[bars.length - 1]
  const prev = bars.length >= 2 ? bars[bars.length - 2] : null
  const m20 = last.ma20
  const m60 = last.ma60
  if (!Number.isFinite(last.close)) {
    return { lines: [], stance: "—", tone: "neutral", dayChgPct: null, volRatio: null }
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
    } else if (last.close >= m20 * 0.997 && last.close <= m20 * 1.007) {
      stance = "20일선 박스"
      tone = "neutral"
    } else {
      stance = "혼조"
      tone = "neutral"
    }
  }
  const lines = []
  if (Number.isFinite(m20) && Number.isFinite(m60)) {
    if (m20 > m60 && last.close > m20) lines.push("20>60 · 종가가 단기 이평 상단")
    else if (m20 < m60 && last.close < m20) lines.push("20<60 · 종가가 단기 이평 하단")
    else if (last.close >= m20 * 0.997 && last.close <= m20 * 1.007) lines.push("20일선 부근 · 지지·저항 확인")
    else lines.push("이평 혼합 · 방향 대기")
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
  const volRatio = avg > 0 ? lv / avg : null
  if (avg > 0 && lv >= avg * 1.35) {
    if (prev && Number.isFinite(prev.close) && last.close >= prev.close) lines.push("거래량 동반 상승")
    else lines.push("거래 급증 · 매물 소화 관찰")
  }
  if (prev && Number.isFinite(prev.close) && prev.close > 0 && last.close > prev.close * 1.04) {
    lines.push("단기 급등 · 과열 감시")
  }
  let dayChgPct = null
  if (Number.isFinite(prev.close) && prev.close > 0) {
    dayChgPct = ((last.close - prev.close) / prev.close) * 100
  }
  return { lines: lines.slice(0, 2), stance, tone, dayChgPct, volRatio }
}

/**
 * @param {Array<{ date?: string; open: number; high: number; low: number; close: number; volume?: number; ma20?: number | null; ma60?: number | null }>} bars
 */
function prepareChartData(bars) {
  const vols = bars.map((b) => b.volume ?? 0)
  /** @type {Array<{ time: string; value: number }>} */
  const closes = []
  /** @type {Array<{ time: string; value: number }>} */
  const ma20d = []
  /** @type {Array<{ time: string; value: number }>} */
  const ma60d = []
  /** @type {Array<{ time: string; value: number; color: string }>} */
  const hist = []
  /** @type {Map<string, { open: number; high: number; low: number; close: number; volume: number; changePct: number; dateLabel: string }>} */
  const meta = new Map()

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i]
    const t = ymdToTime(b.date)
    if (!t) continue
    closes.push({ time: t, value: b.close })
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
    let color = up ? "rgba(45,212,191,0.12)" : "rgba(244,63,94,0.12)"
    if (spike) color = up ? "rgba(45,212,191,0.28)" : "rgba(244,63,94,0.26)"
    hist.push({ time: t, value: v, color })

    const prevClose = i > 0 ? bars[i - 1].close : b.close
    const chg = prevClose ? ((b.close - prevClose) / prevClose) * 100 : 0
    meta.set(t, {
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: v,
      changePct: chg,
      dateLabel: formatDateLabel(b.date),
    })
  }

  return { closes, ma20: ma20d, ma60: ma60d, volume: hist, meta }
}

/**
 * 밸류체인 우측 패널 — 프리미엄 라인+영역(종가 추세) · MA 오버레이 · 최소 거래량 (lightweight-charts).
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

  const trendPack = useMemo(() => buildTrendSummary(normalizedBars), [normalizedBars])
  const trendLines = trendPack.lines
  const lastBar = normalizedBars[normalizedBars.length - 1]
  const lastClose = lastBar && Number.isFinite(lastBar.close) ? lastBar.close : null

  const chartPack = useMemo(() => prepareChartData(normalizedBars), [normalizedBars])

  useEffect(() => {
    metaRef.current = chartPack.meta
  }, [chartPack.meta])

  useEffect(() => {
    const el = wrapRef.current
    if (!el || chartPack.closes.length < 2) return undefined

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "#070a10" },
        textColor: "rgba(148,163,184,0.78)",
        fontSize: 11,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(255,255,255,0.028)" },
      },
      width: el.clientWidth,
      height: el.clientHeight || 380,
      rightPriceScale: {
        borderColor: "rgba(167,139,250,0.12)",
      },
      timeScale: {
        borderColor: "rgba(34,211,238,0.1)",
        timeVisible: false,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        barSpacing: 6,
        minBarSpacing: 4,
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: "rgba(167,139,250,0.55)",
          width: 1,
          style: 0,
          labelBackgroundColor: "rgba(15,23,42,0.92)",
        },
        horzLine: {
          color: "rgba(34,211,238,0.4)",
          width: 1,
          style: 0,
          labelBackgroundColor: "rgba(15,23,42,0.92)",
        },
      },
      localization: { locale: "ko-KR" },
    })

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
      base: 0,
    })

    const ma60Series = chart.addLineSeries({
      color: "rgba(148,163,184,0.22)",
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })

    const ma20Series = chart.addLineSeries({
      color: "rgba(56,189,248,0.28)",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })

    const priceSeries = chart.addAreaSeries({
      lineColor: "#5eead4",
      topColor: "rgba(94,234,212,0.42)",
      bottomColor: "rgba(7,10,16,0)",
      lineWidth: 2,
      lineType: LineType.Curved,
      lastPriceAnimation: LastPriceAnimationMode.Continuous,
      priceLineVisible: true,
      priceLineWidth: 1,
      priceLineColor: "rgba(45,212,191,0.85)",
      priceLineStyle: 2,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerBorderColor: "rgba(236,254,255,0.95)",
      crosshairMarkerBackgroundColor: "rgba(34,211,238,0.95)",
    })

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.94, bottom: 0 },
    })
    priceSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.06, bottom: 0.08 },
    })

    volumeSeries.setData(chartPack.volume)
    ma60Series.setData(chartPack.ma60)
    ma20Series.setData(chartPack.ma20)
    priceSeries.setData(chartPack.closes)

    const last = chartPack.closes[chartPack.closes.length - 1]
    if (last) {
      priceSeries.setMarkers([
        {
          time: last.time,
          position: "inBar",
          shape: "circle",
          color: "#ecfeff",
          size: 2.25,
          borderColor: "#22d3ee",
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
      const tkey = timeToKey(param.time)
      const extra = tkey ? metaRef.current.get(tkey) : null
      const changePct = extra?.changePct ?? 0
      setTooltip({
        x: param.point.x,
        y: param.point.y,
        dateLabel: extra?.dateLabel ?? String(param.time),
        open: extra?.open,
        high: extra?.high,
        low: extra?.low,
        close: data.value,
        changePct,
        volume: extra?.volume ?? 0,
      })
    }

    chart.subscribeCrosshairMove(onCrosshair)
    chart.timeScale().fitContent()

    chartRef.current = chart

    let lastW = Math.max(1, Math.floor(el.clientWidth))
    let lastH = Math.max(1, Math.floor(el.clientHeight || 380))
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

  const accentStripe =
    trendPack.tone === "up"
      ? "border-l-emerald-400/75 shadow-[inset_3px_0_0_rgba(52,211,153,0.35)]"
      : trendPack.tone === "down"
        ? "border-l-rose-400/70 shadow-[inset_3px_0_0_rgba(251,113,133,0.32)]"
        : "border-l-cyan-400/50 shadow-[inset_3px_0_0_rgba(34,211,238,0.22)]"

  return (
    <div
      className={`relative w-full min-w-0 overflow-hidden rounded-xl border border-white/[0.09] bg-[#070a10] ring-1 ring-violet-500/[0.08] ${className}`}
      style={{
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 0 48px rgba(0,0,0,0.45)",
      }}
    >
      <div
        className={`flex flex-col gap-2 border-b border-white/[0.06] bg-gradient-to-br from-white/[0.04] via-transparent to-violet-950/[0.06] px-3 py-3 md:flex-row md:items-center md:justify-between md:px-4 md:py-3.5 ${accentStripe} border-l-[3px]`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-500">Signal</span>
            <span
              className={
                trendPack.tone === "up"
                  ? "text-[15px] font-semibold tracking-tight text-emerald-200/95 md:text-base"
                  : trendPack.tone === "down"
                    ? "text-[15px] font-semibold tracking-tight text-rose-200/95 md:text-base"
                    : "text-[15px] font-semibold tracking-tight text-cyan-100/90 md:text-base"
              }
            >
              {trendPack.stance}
            </span>
            {trendPack.dayChgPct != null && Number.isFinite(trendPack.dayChgPct) ? (
              <span
                className={`font-mono text-sm font-semibold tabular-nums md:text-[15px] ${
                  trendPack.dayChgPct >= 0 ? "text-emerald-300/95" : "text-rose-300/95"
                }`}
              >
                {trendPack.dayChgPct >= 0 ? "+" : ""}
                {trendPack.dayChgPct.toFixed(2)}%
                <span className="ml-1 text-[10px] font-medium text-slate-500">1D</span>
              </span>
            ) : null}
          </div>
          {trendLines[0] ? (
            <p className="m-0 mt-1 text-[11px] leading-snug text-slate-400 md:text-[12px]">{trendLines[0]}</p>
          ) : null}
          {trendLines[1] ? (
            <p className="m-0 mt-0.5 text-[10px] leading-snug text-slate-600">{trendLines[1]}</p>
          ) : null}
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-[9px] text-slate-500 md:justify-end">
          <span className="inline-flex items-center gap-1.5 text-slate-600">
            <span className="inline-block h-2 w-5 rounded-full bg-gradient-to-r from-teal-400/90 to-cyan-300/80 shadow-[0_0_10px_rgba(45,212,191,0.45)]" />
            종가 흐름
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-sky-400/50 shadow-[0_0_6px_rgba(56,189,248,0.35)]" />
            MA20
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-px w-4 bg-slate-500/80" />
            MA60
          </span>
          {trendPack.volRatio != null && Number.isFinite(trendPack.volRatio) ? (
            <span className="font-mono text-slate-400">
              Vol <span className="text-violet-200/90">{trendPack.volRatio.toFixed(2)}×</span> vs 20d
            </span>
          ) : (
            <span className="text-slate-600">Vol · 20일 대비</span>
          )}
        </div>
      </div>

      <div className="relative h-[min(440px,58vh)] w-full min-h-[300px] sm:min-h-[360px]">
        <div ref={wrapRef} className="absolute inset-0 h-full w-full" />

        {lastClose != null ? (
          <div className="pointer-events-none absolute right-2 top-2 z-[15] text-right sm:right-3 sm:top-3">
            <div className="rounded-lg border border-cyan-400/35 bg-[rgba(7,10,16,0.88)] px-2.5 py-1.5 shadow-[0_0_24px_rgba(167,139,250,0.15),0_0_20px_rgba(34,211,238,0.12),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md sm:px-3 sm:py-2">
              <p className="m-0 font-mono text-[8px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Last</p>
              <p className="m-0 mt-0.5 font-mono text-lg font-semibold tabular-nums leading-none text-slate-50 sm:text-xl">
                {fmtPrice(lastClose)}
              </p>
              {trendPack.dayChgPct != null && Number.isFinite(trendPack.dayChgPct) ? (
                <p
                  className={`m-0 mt-1 font-mono text-[11px] font-semibold tabular-nums ${
                    trendPack.dayChgPct >= 0 ? "text-emerald-300/95" : "text-rose-300/95"
                  }`}
                >
                  {trendPack.dayChgPct >= 0 ? "▲" : "▼"} {Math.abs(trendPack.dayChgPct).toFixed(2)}%
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {tooltip ? (
          <div
            className="pointer-events-none absolute z-20 min-w-[210px] rounded-lg border border-violet-400/25 bg-[rgba(6,9,16,0.96)] px-3 py-2.5 shadow-[0_16px_44px_rgba(0,0,0,0.6)] backdrop-blur-md"
            style={{
              left: Math.min(Math.max(tooltip.x + 14, 8), (wrapRef.current?.clientWidth ?? 360) - 220),
              top: Math.min(Math.max(tooltip.y + 8, 8), (wrapRef.current?.clientHeight ?? 400) - 150),
            }}
          >
            <p className="m-0 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-300/85">
              {tooltip.dateLabel}
            </p>
            <p className="m-0 mt-1.5 font-mono text-xl font-semibold tabular-nums leading-none text-slate-50">
              {fmtPrice(tooltip.close)}
            </p>
            <p
              className={`m-0 mt-1 font-mono text-[12px] font-semibold tabular-nums ${
                tooltip.changePct >= 0 ? "text-emerald-300/95" : "text-rose-300/95"
              }`}
            >
              {tooltip.changePct >= 0 ? "+" : ""}
              {tooltip.changePct.toFixed(2)}% <span className="text-[10px] font-medium text-slate-500">vs 전일</span>
            </p>
            {tooltip.high != null && tooltip.low != null ? (
              <p className="m-0 mt-2 border-t border-white/[0.06] pt-2 font-mono text-[10px] text-slate-500">
                Range {fmtPrice(tooltip.high)} — {fmtPrice(tooltip.low)}
              </p>
            ) : null}
            <p className="m-0 mt-1.5 font-mono text-[10px] text-slate-500">
              Vol <span className="text-violet-200/90">{fmtVol(tooltip.volume)}</span>
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
