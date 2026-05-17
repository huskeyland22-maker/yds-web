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
/** 플롯 시작 여백 (차트 너비 대비) */
const PLOT_LEADING_FRAC = 0.08
/** 우측 Y축·라벨 예약 (px) */
const PRICE_SCALE_RESERVE_PX = 52
/** 날짜축 라벨 잘림 방지 (px) */
const TIMESCALE_BOTTOM_PAD_PX = 32
const CYAN_CORE = "#22d3ee"

/**
 * 데이터 포인트를 플롯 전체 너비에 균등 배치 (우측 몰림·좌측 대공백 방지)
 * @param {import("lightweight-charts").IChartApi} chart
 * @param {HTMLElement} el
 * @param {number} pointCount
 * @param {{ showTimeLabels?: boolean }} [opts]
 */
function applyFullWidthTimeScale(chart, el, pointCount, opts = {}) {
  const { showTimeLabels = true } = opts
  const n = Math.max(2, pointCount)
  const w = Math.max(1, el.clientWidth)
  const leadingPad = Math.round(w * PLOT_LEADING_FRAC)
  const trailingPad = PLOT_END_INSET_PX
  const usable = Math.max(56, w - leadingPad - trailingPad - PRICE_SCALE_RESERVE_PX)
  const spacing = usable / (n - 1)

  chart.applyOptions({
    layout: {
      padding: { left: leadingPad, right: trailingPad, bottom: TIMESCALE_BOTTOM_PAD_PX },
    },
    timeScale: {
      fixLeftEdge: true,
      fixRightEdge: false,
      rightOffset: 2,
      barSpacing: spacing,
      minBarSpacing: Math.max(4, spacing * 0.45),
      timeVisible: showTimeLabels,
    },
  })

  try {
    chart.timeScale().setVisibleLogicalRange({ from: 0, to: n - 1 })
  } catch {
    /* ignore */
  }
}
const VOL_UP = "rgba(34,197,94,0.62)"
const VOL_DOWN = "rgba(239,68,68,0.58)"
const VOL_MULT = 1.7

/** @param {FlowRegime} regime */
function regimeLabelKo(regime) {
  if (regime === "riskOn") return "위험 선호 시그널"
  if (regime === "riskOff") return "위험 회피 시그널"
  return "중립 시그널"
}

/** @param {FlowRegime} regime @param {number} changePct */
function signalStatusLabel(regime, changePct) {
  if (Number.isFinite(changePct) && changePct >= 1.2) return "상승 압력 확대"
  if (Number.isFinite(changePct) && changePct <= -1.2) return "하락 압력 확대"
  if (regime === "riskOn") return "위험 선호 국면"
  if (regime === "riskOff") return "위험 회피 국면"
  return "박스권·관망"
}

/**
 * @param {import("lightweight-charts").ISeriesApi<"Line">} series
 * @param {unknown[]} data
 * @param {number} [durationMs]
 */
function animateSeriesDraw(series, data, durationMs = 720) {
  if (!data.length) return
  const start = performance.now()
  const tick = (now) => {
    const t = Math.min(1, (now - start) / durationMs)
    const eased = 1 - (1 - t) ** 2.2
    const count = Math.max(2, Math.ceil(data.length * eased))
    series.setData(data.slice(0, count))
    if (t < 1) requestAnimationFrame(tick)
    else series.setData(data)
  }
  requestAnimationFrame(tick)
}

/** @param {string} metricKey @param {FlowRegime} regime @param {number} dayChg */
function metricSubtitle(metricKey, regime, dayChg) {
  if (metricKey === "vix") {
    if (Number.isFinite(dayChg) && dayChg < -0.15) return "변동성 압력 완화 진행"
    if (Number.isFinite(dayChg) && dayChg > 0.15) return "변동성 압력 확대 진행"
    return "변동성 국면 관망"
  }
  if (regime === "riskOn") return "위험 자산 선호 확대"
  if (regime === "riskOff") return "방어·현금 선호 강화"
  return "매크로 박스권 조정"
}

/**
 * @param {object[]} rows
 * @param {{ key: string; name?: string }} primarySeries
 */
export function getChartDeskLabels(rows, primarySeries) {
  const pack = buildLwPack(rows, primarySeries?.key)
  const name = primarySeries?.name ?? primarySeries?.key ?? "Metric"
  if (!pack) return { title: name, subtitle: "데이터 수신 대기" }
  return {
    title: `${name} · ${regimeLabelKo(pack.regime)}`,
    subtitle: metricSubtitle(pack.primaryKey, pack.regime, pack.stats.dayChg),
  }
}

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
 * 단일 시계열(일별) → 종가 라인용 포인트 + MA20/60 + 메타.
 * @param {object[]} rows
 * @param {string} primaryKey
 * @param {{ includeVolume?: boolean }} [opts]
 */
function buildLwPack(rows, primaryKey, opts = {}) {
  const { includeVolume = false } = opts
  const sorted = [...(rows || [])]
    .filter((r) => rowDay(r) && Number.isFinite(Number(r[primaryKey])))
    .sort((a, b) => String(rowDay(a)).localeCompare(String(rowDay(b))))
    .slice(-120)

  if (sorted.length < 2) return null

  /** @type {{ time: string; close: number; open?: number; _v?: number }[]} */
  const raw = []
  for (let i = 0; i < sorted.length; i++) {
    const close = Number(sorted[i][primaryKey])
    const open = i > 0 ? Number(sorted[i - 1][primaryKey]) : close
    const row = { time: rowDay(sorted[i]), close }
    if (includeVolume) {
      const rng = Math.abs(close - open)
      row.open = open
      row._v = rng * 1e6 + Math.abs(close) * 2e3 + 50
    }
    raw.push(row)
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

  /** @type {{ time: string; value: number; color?: string }[] | null} */
  let volume = null
  if (includeVolume) {
    const vols = raw.map((r) => r._v)
    volume = raw.map((r, i) => {
      const up = r.close >= r.open
      let sum = 0
      let c = 0
      for (let j = Math.max(0, i - 19); j < i; j++) {
        sum += vols[j]
        c += 1
      }
      const avg = c > 0 ? sum / c : vols[i]
      const spike = avg > 0 && r._v >= avg * 1.3
      let color = up ? VOL_UP : VOL_DOWN
      if (spike) color = up ? "rgba(34,197,94,0.78)" : "rgba(239,68,68,0.74)"
      return { time: r.time, value: r._v * VOL_MULT, color }
    })
  }

  /** @type {Map<string, { close: number; volume?: number; changePct: number }>} */
  const meta = new Map()
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i]
    const prevClose = i > 0 ? raw[i - 1].close : r.close
    const chg = prevClose ? ((r.close - prevClose) / Math.abs(prevClose)) * 100 : 0
    meta.set(r.time, {
      close: r.close,
      changePct: chg,
      ...(includeVolume ? { volume: r._v } : {}),
    })
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

  const closesOnly = raw.map((r) => r.close)
  const high = Math.max(...closesOnly)
  const low = Math.min(...closesOnly)
  const tail3 = closesOnly.slice(-3)
  const avg3 = tail3.length ? tail3.reduce((a, b) => a + b, 0) / tail3.length : last

  return {
    closes,
    ma20,
    ma60,
    volume,
    meta,
    regime,
    primaryKey,
    stats: { last, high, low, avg3, dayChg },
  }
}

/** @param {FlowRegime} regime */
function regimeAreaStyle(regime) {
  if (regime === "riskOn") {
    return {
      line: "#5eead4",
      top: "rgba(94,234,212,0.12)",
      bottom: "rgba(7,10,16,0)",
      priceLine: "rgba(52,211,153,0.45)",
    }
  }
  if (regime === "riskOff") {
    return {
      line: "#fcd34d",
      top: "rgba(252,211,77,0.1)",
      bottom: "rgba(7,10,16,0)",
      priceLine: "rgba(251,191,36,0.45)",
    }
  }
  return {
    line: "#38bdf8",
    top: "rgba(56,189,248,0.1)",
    bottom: "rgba(7,10,16,0)",
    priceLine: "rgba(34,211,238,0.45)",
  }
}

/**
 * 메인 라인 시각 (Bloomberg / TradingView 시그널 데스크)
 * @param {NonNullable<ReturnType<typeof buildLwPack>>} pack
 */
function resolveMainLineVisuals(pack) {
  const base = regimeAreaStyle(pack.regime)
  const isVix = pack.primaryKey === "vix"
  const line = isVix ? CYAN_CORE : base.line

  return {
    line,
    priceLine: isVix ? "rgba(34,211,238,0.35)" : base.priceLine,
    lineWidth: 4,
    lineWidthHover: 4,
    crosshairRadius: 3,
    crosshairRadiusHover: 3,
  }
}

/**
 * @param {{
 *   rows: object[]
 *   primarySeries: { key: string; name?: string; color?: string }
 *   className?: string
 *   headerTitle?: string
 *   headerSubtitle?: string
 *   showVolume?: boolean
 * }} props
 */
export default function MacroCycleLwChart({
  rows,
  primarySeries,
  className = "",
  compact = false,
  headerTitle,
  headerSubtitle,
  showVolume = false,
}) {
  const isMobile = useIsMobileLayout()
  const wrapRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef(null)
  const visualsRef = useRef(null)
  const hoverLineRef = useRef(false)
  const metaRef = useRef(new Map())
  const [tooltip, setTooltip] = useState(null)
  const [chartIn, setChartIn] = useState(false)
  const [lastValueTopPx, setLastValueTopPx] = useState(null)
  const [lastPointPx, setLastPointPx] = useState(null)
  const pack = useMemo(() => {
    if (!primarySeries?.key) return null
    return buildLwPack(rows, primarySeries.key, { includeVolume: showVolume })
  }, [rows, primarySeries?.key, showVolume])

  const seriesName = primarySeries?.name ?? primarySeries?.key ?? "Metric"
  const accent = resolveSeriesColor(primarySeries)
  const deskLabels = useMemo(() => getChartDeskLabels(rows, primarySeries), [rows, primarySeries])
  const titleLine = headerTitle ?? deskLabels.title
  const subtitleLine = headerSubtitle ?? deskLabels.subtitle

  useEffect(() => {
    metaRef.current = pack?.meta ?? new Map()
  }, [pack?.meta])

  useEffect(() => {
    const el = wrapRef.current
    if (!el || !pack || pack.closes.length < 2) return undefined

    const vis = resolveMainLineVisuals(pack)
    visualsRef.current = vis

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "#06080d" },
        textColor: "rgba(203,213,225,0.78)",
        fontSize: 11,
        padding: { left: 0, right: PLOT_END_INSET_PX, bottom: TIMESCALE_BOTTOM_PAD_PX },
      },
      grid: {
        vertLines: { visible: true, color: "rgba(255,255,255,0.065)" },
        horzLines: { visible: true, color: "rgba(255,255,255,0.11)" },
      },
      width: el.clientWidth,
      height: el.clientHeight || 360,
      rightPriceScale: {
        visible: true,
        borderColor: "rgba(148,163,184,0.22)",
        textColor: "rgba(203,213,225,0.75)",
        scaleMargins: showVolume ? { top: 0.08, bottom: 0.14 } : { top: 0.04, bottom: 0.1 },
      },
      leftPriceScale: { visible: false },
      timeScale: {
        borderColor: "rgba(34,211,238,0.08)",
        timeVisible: !showVolume,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: false,
        rightOffset: 2,
        barSpacing: 9,
        minBarSpacing: 4,
        tickMarkFormatter: (time) => {
          const key = chartTimeToDayKey(time)
          return key ? formatChartAxisTick(key, { mobile: isMobile, compact }) : ""
        },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: "rgba(148,163,184,0.38)",
          width: 1,
          style: 0,
          labelBackgroundColor: "rgba(8,12,20,0.96)",
        },
        horzLine: {
          color: "rgba(34,211,238,0.55)",
          width: 1,
          style: 2,
          labelBackgroundColor: "rgba(8,12,20,0.96)",
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

    const priceSeries = chart.addLineSeries({
      color: vis.line,
      lineWidth: vis.lineWidth,
      lineType: LineType.Curved,
      lastPriceAnimation: LastPriceAnimationMode.Continuous,
      priceLineVisible: true,
      priceLineWidth: 1,
      priceLineColor: vis.priceLine,
      priceLineStyle: 2,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })

    seriesRef.current = { priceSeries }

    if (showVolume && pack.volume?.length) {
      const volumeSeries = chart.addHistogramSeries({
        priceFormat: { type: "volume" },
        priceScaleId: "",
        base: 0,
      })
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.78, bottom: 0 },
      })
      volumeSeries.setData(pack.volume)
    }

    priceSeries.priceScale().applyOptions({
      scaleMargins: showVolume ? { top: 0.06, bottom: 0.1 } : { top: 0.035, bottom: 0.08 },
    })

    const drawMs = 720
    animateSeriesDraw(priceSeries, pack.closes, drawMs)

    const applyHoverLine = (active) => {
      if (hoverLineRef.current === active) return
      hoverLineRef.current = active
      const v = visualsRef.current
      const s = seriesRef.current
      if (!v || !s) return
      const w = active ? v.lineWidthHover : v.lineWidth
      const r = active ? v.crosshairRadiusHover : v.crosshairRadius
      try {
        s.priceSeries.applyOptions({ lineWidth: w, crosshairMarkerRadius: r })
      } catch {
        /* ignore */
      }
    }

    const onCrosshair = (param) => {
      if (!param.point || param.time === undefined) {
        setTooltip(null)
        applyHoverLine(false)
        return
      }
      applyHoverLine(true)
      const data = param.seriesData.get(priceSeries)
      if (!data || typeof data !== "object" || data.value == null) {
        setTooltip(null)
        return
      }
      const tkey = chartTimeToDayKey(param.time)
      const extra = tkey ? metaRef.current.get(tkey) : null
      const chg = extra?.changePct ?? 0
      setTooltip({
        x: param.point.x,
        y: param.point.y,
        dateLabel: tkey ? formatChartTooltip(tkey) : String(param.time),
        value: data.value,
        volume: showVolume ? (extra?.volume ?? 0) : undefined,
        changePct: chg,
        status: signalStatusLabel(pack.regime, chg),
      })
    }

    const syncLastValueTop = () => {
      const last = pack.closes[pack.closes.length - 1]
      if (!last) {
        setLastValueTopPx(null)
        setLastPointPx(null)
        return
      }
      const y = priceSeries.priceToCoordinate(last.value)
      const x = chart.timeScale().timeToCoordinate(last.time)
      if (y == null || !Number.isFinite(Number(y))) {
        setLastValueTopPx(null)
        setLastPointPx(null)
        return
      }
      setLastValueTopPx(Number(y))
      if (x != null && Number.isFinite(Number(x))) {
        setLastPointPx({ x: Number(x), y: Number(y) })
      } else {
        setLastPointPx(null)
      }
    }

    chart.subscribeCrosshairMove(onCrosshair)
    chartRef.current = chart

    const n = pack.closes.length
    const layoutTimeScale = () => {
      applyFullWidthTimeScale(chart, el, n, { showTimeLabels: !showVolume })
      syncLastValueTop()
    }
    layoutTimeScale()
    requestAnimationFrame(layoutTimeScale)

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
        const c = chartRef.current
        if (!c) return
        c.applyOptions({ width: w, height: h })
        applyFullWidthTimeScale(c, el, pack.closes.length, { showTimeLabels: !showVolume })
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
      seriesRef.current = null
      visualsRef.current = null
      hoverLineRef.current = false
      setTooltip(null)
      setLastValueTopPx(null)
      setLastPointPx(null)
    }
  }, [pack, isMobile, compact, showVolume])

  useEffect(() => {
    if (!pack) {
      setChartIn(false)
      return undefined
    }
    setChartIn(false)
    const id = requestAnimationFrame(() => setChartIn(true))
    return () => cancelAnimationFrame(id)
  }, [pack])

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
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-white/[0.06] bg-gradient-to-r from-white/[0.03] to-transparent px-2.5 py-1.5 sm:px-3">
        <div className="min-w-0">
          <p className="m-0 text-[8px] font-bold tracking-[0.16em] text-cyan-400/80">TERMINAL</p>
          <p className="m-0 mt-0.5 truncate font-mono text-[13px] font-semibold tracking-tight text-slate-50 sm:text-[15px]">
            {titleLine}
          </p>
          <p className="m-0 mt-0.5 text-[10px] font-medium text-slate-400/95">{subtitleLine}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[9px]">
          <span className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-medium text-slate-200">
            <span
              className="inline-block h-0.5 w-4 rounded-full shadow-[0_0_6px_rgba(34,211,238,0.28)]"
              style={{ backgroundColor: accent }}
            />
            {seriesName}
          </span>
          {showVolume ? (
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-1 rounded-sm bg-emerald-500/60" />
              <span className="inline-block h-2 w-1 rounded-sm bg-rose-500/55" />
              Vol
            </span>
          ) : null}
        </div>
      </div>

      <div
        className={
          compact
            ? "relative h-[min(60vw,278px)] w-full min-h-[253px] sm:h-[329px] sm:min-h-[278px]"
            : "relative h-[414px] w-full min-h-[322px] sm:h-[460px] sm:min-h-[345px]"
        }
      >
        <div className="relative flex h-full w-full min-h-0">
          <div className="relative min-h-0 min-w-0 flex-1">
            <div ref={wrapRef} className="absolute inset-0 h-full w-full" />

            {lastPointPx ? (
              <div
                className="pointer-events-none absolute z-[4]"
                style={{
                  left: lastPointPx.x,
                  top: lastPointPx.y,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <span
                  className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/12 shadow-[0_0_8px_rgba(34,211,238,0.22)]"
                  aria-hidden
                />
                <span
                  className="relative block h-3 w-3 rounded-full border-2 border-white/95 bg-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.55)]"
                  aria-hidden
                />
              </div>
            ) : null}

            <div className="pointer-events-none absolute left-2 top-2 z-[2] min-w-[8.5rem] rounded-md border border-white/[0.1] bg-[rgba(6,9,16,0.88)] px-2 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:left-2.5 sm:top-2.5 sm:px-2.5 sm:py-2">
              <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 font-mono text-[9px] leading-tight sm:text-[10px]">
                <span className="text-slate-500">현재</span>
                <span className="text-right font-semibold tabular-nums text-slate-100">
                  {formatMetricValue(pack.primaryKey, pack.stats.last)}
                </span>
                <span className="text-slate-500">고점</span>
                <span className="text-right tabular-nums text-slate-300">
                  {formatMetricValue(pack.primaryKey, pack.stats.high)}
                </span>
                <span className="text-slate-500">저점</span>
                <span className="text-right tabular-nums text-slate-300">
                  {formatMetricValue(pack.primaryKey, pack.stats.low)}
                </span>
                <span className="text-slate-500">변동률</span>
                <span
                  className={`text-right font-semibold tabular-nums ${
                    pack.stats.dayChg >= 0 ? "text-emerald-300/95" : "text-rose-300/95"
                  }`}
                >
                  {pack.stats.dayChg >= 0 ? "+" : ""}
                  {pack.stats.dayChg.toFixed(2)}%
                </span>
                <span className="text-slate-500">3일 평균</span>
                <span className="text-right tabular-nums text-slate-300">
                  {formatMetricValue(pack.primaryKey, pack.stats.avg3)}
                </span>
              </div>
            </div>

            {tooltip ? (
              <div
                className="pointer-events-none absolute z-20 min-w-[220px] overflow-hidden rounded border border-slate-600/50 bg-[#0a0e16] shadow-[0_16px_40px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.06)]"
                style={{
                  left: Math.min(Math.max(tooltip.x + 12, 6), (wrapRef.current?.clientWidth ?? 280) - 230),
                  top: Math.min(Math.max(tooltip.y + 6, 6), (wrapRef.current?.clientHeight ?? 360) - 160),
                }}
              >
                <div className="border-b border-cyan-500/20 bg-[linear-gradient(90deg,rgba(34,211,238,0.12),transparent)] px-2.5 py-1.5">
                  <p className="m-0 text-[8px] font-bold tracking-[0.14em] text-cyan-400/90">TERMINAL</p>
                  <p className="m-0 mt-0.5 text-[10px] font-semibold text-slate-200">{tooltip.dateLabel}</p>
                </div>
                <div className="px-2.5 py-2">
                  <p className="m-0 text-[9px] font-medium uppercase tracking-wider text-slate-500">현재값</p>
                  <p className="m-0 mt-0.5 font-mono text-xl font-semibold tabular-nums leading-none text-slate-50">
                    {formatMetricValue(pack.primaryKey, tooltip.value)}
                  </p>
                  <div className="mt-2.5 space-y-1.5 border-t border-white/[0.08] pt-2 font-mono text-[10px]">
                    <p className="m-0 flex justify-between gap-4">
                      <span className="text-slate-500">전일 대비</span>
                      <span
                        className={`font-semibold tabular-nums ${
                          (tooltip.changePct ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300"
                        }`}
                      >
                        {(tooltip.changePct ?? 0) >= 0 ? "+" : ""}
                        {Number(tooltip.changePct ?? 0).toFixed(2)}%
                      </span>
                    </p>
                    <p className="m-0 flex justify-between gap-4">
                      <span className="text-slate-500">변화율</span>
                      <span
                        className={`font-semibold tabular-nums ${
                          (tooltip.changePct ?? 0) >= 0 ? "text-emerald-300/95" : "text-rose-300/95"
                        }`}
                      >
                        {(tooltip.changePct ?? 0) >= 0 ? "+" : ""}
                        {Number(tooltip.changePct ?? 0).toFixed(2)}%
                      </span>
                    </p>
                    <p className="m-0 flex justify-between gap-4">
                      <span className="text-slate-500">상태</span>
                      <span className="text-right text-[9px] font-medium text-cyan-200/90">{tooltip.status}</span>
                    </p>
                    {showVolume && tooltip.volume != null ? (
                      <p className="m-0 flex justify-between gap-4">
                        <span className="text-slate-500">거래량</span>
                        <span className="tabular-nums text-slate-300">{fmtVol(tooltip.volume)}</span>
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div
            className="relative h-full w-[80px] shrink-0 sm:w-[104px]"
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
              <p className="m-0 text-[7px] font-bold tracking-[0.14em] text-cyan-400/80">LIVE</p>
              <p className="m-0 mt-0.5 text-[8px] font-semibold tracking-[0.1em] text-slate-500">현재값</p>
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
              <div className="m-0 mt-2 space-y-1 border-t border-white/[0.08] pt-2 font-mono text-[8px] leading-snug">
                <p className="m-0 flex flex-col items-end gap-0.5">
                  <span className="text-[7px] font-bold tracking-[0.12em] text-slate-500">DAY HIGH</span>
                  <span className="tabular-nums text-[11px] text-slate-200">
                    {formatMetricValue(pack.primaryKey, pack.stats.high)}
                  </span>
                </p>
                <p className="m-0 flex flex-col items-end gap-0.5">
                  <span className="text-[7px] font-bold tracking-[0.12em] text-slate-500">DAY LOW</span>
                  <span className="tabular-nums text-[11px] text-slate-200">
                    {formatMetricValue(pack.primaryKey, pack.stats.low)}
                  </span>
                </p>
              </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
