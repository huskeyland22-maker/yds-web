import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  dayKeyToUtcMs,
  formatHistoryTimeAxisTick,
  pickEvenTimeAxisTicks,
  resolveHistoryDefaultBrushIndex,
} from "../../utils/chartDateFormat.js"
import {
  PANIC_SPX_VALIDATION_SERIES_URL,
  mergeLiveHistoryIntoPanicSpxSeries,
  resolveBottomWindowDomain,
} from "../../content/ydsPanicSpxValidationSeries.js"
import { useIsMobileLayout } from "../../hooks/useIsMobileLayout.js"

const CHART_HEIGHT_DESKTOP = 320
const CHART_HEIGHT_MOBILE = 248
const MARGIN_DESKTOP = { top: 12, right: 48, left: 8, bottom: 8 }
const MARGIN_MOBILE = { top: 8, right: 22, left: 0, bottom: 4 }
/** Default-view X label density (data points unchanged). */
const X_TICK_TARGET_DESKTOP = 6
const X_TICK_TARGET_MOBILE = 5
/** 첫 화면 기본 zoom — 끝날짜 기준 최근 개월 (전체 데이터는 Brush로 탐색). */
const DEFAULT_ZOOM_MONTHS = 17

/** @param {{ active?: boolean; payload?: object[] }} props */
function ValidationTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null
  return (
    <div className="yds-panic-spx-val__tooltip">
      <p className="yds-panic-spx-val__tooltip-date">{row.date}</p>
      <p className="yds-panic-spx-val__tooltip-row font-mono tabular-nums">
        Panic {row.panic != null ? row.panic : "—"}
      </p>
      <p className="yds-panic-spx-val__tooltip-row font-mono tabular-nums">
        SPX {row.spx != null ? Number(row.spx).toLocaleString("en-US") : "—"}
      </p>
      {row.isBottom ? (
        <p className="yds-panic-spx-val__tooltip-mark">SPX 저점</p>
      ) : null}
    </div>
  )
}

/**
 * Panic Index History — Panic V2 × S&P500 (시장 소스 재계산 시계열)
 * X축: timestamp 시간축 · 첫 화면은 최근 ~17개월 zoom · 전체 데이터는 Brush로 유지
 * @param {{ historyRows?: object[] }} [props]
 */
export default function YdsPanicSpxValidationChart({ historyRows = [] }) {
  const isMobile = useIsMobileLayout()
  const chartHeight = isMobile ? CHART_HEIGHT_MOBILE : CHART_HEIGHT_DESKTOP
  const chartMargin = isMobile ? MARGIN_MOBILE : MARGIN_DESKTOP
  const panicAxisWidth = isMobile ? 28 : 36
  const spxAxisWidth = isMobile ? 30 : 44

  const [baseSeries, setBaseSeries] = useState(
    /** @type {import("../../content/ydsPanicSpxValidationSeries.js").PanicSpxValidationSeries | null} */ (
      null
    ),
  )
  const [loadError, setLoadError] = useState(/** @type {string | null} */ (null))
  const [domain, setDomain] = useState(/** @type {[string, string] | null} */ (null))
  const [activeBottom, setActiveBottom] = useState(/** @type {string | null} */ (null))
  const [brushIndex, setBrushIndex] = useState(
    /** @type {{ startIndex: number; endIndex: number } | null} */ (null),
  )

  useEffect(() => {
    let cancelled = false
    fetch(PANIC_SPX_VALIDATION_SERIES_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => {
        if (cancelled) return
        setBaseSeries(json)
        setLoadError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err?.message ?? "load failed")
        setBaseSeries(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const series = useMemo(
    () => mergeLiveHistoryIntoPanicSpxSeries(baseSeries, historyRows),
    [baseSeries, historyRows],
  )

  const chartData = useMemo(() => {
    if (!series?.rows?.length) return []
    const bottomSet = new Set((series.bottoms ?? []).map((b) => b.d0))
    return series.rows.map((r) => {
      const ts = dayKeyToUtcMs(r.date)
      return {
        ...r,
        ts: ts ?? 0,
        isBottom: bottomSet.has(r.date),
      }
    })
  }, [series])

  const defaultBrushIndex = useMemo(
    () => resolveHistoryDefaultBrushIndex(chartData, DEFAULT_ZOOM_MONTHS),
    [chartData],
  )

  /** 활성 Brush 구간 — 미설정 시 기본 최근 N개월 */
  const activeBrushIndex = brushIndex ?? defaultBrushIndex

  const filteredData = useMemo(() => {
    if (!domain) return chartData
    const [lo, hi] = domain
    return chartData.filter((r) => r.date >= lo && r.date <= hi)
  }, [chartData, domain])

  /** Visible rows for axis domain/ticks only (Brush / bottom focus). */
  const visibleRows = useMemo(() => {
    if (!filteredData.length) return []
    if (!domain && activeBrushIndex) {
      const lo = Math.max(0, Math.min(activeBrushIndex.startIndex, filteredData.length - 1))
      const hi = Math.max(lo, Math.min(activeBrushIndex.endIndex, filteredData.length - 1))
      return filteredData.slice(lo, hi + 1)
    }
    return filteredData
  }, [filteredData, domain, activeBrushIndex])

  const xTimeDomain = useMemo(() => {
    if (visibleRows.length < 1) return /** @type {[number, number] | null} */ (null)
    const startMs = visibleRows[0].ts
    const endMs = visibleRows[visibleRows.length - 1].ts
    if (!(endMs >= startMs)) return null
    return /** @type {[number, number]} */ ([startMs, endMs])
  }, [visibleRows])

  const xAxisTicks = useMemo(() => {
    if (!xTimeDomain) return []
    const [startMs, endMs] = xTimeDomain
    const base = isMobile ? X_TICK_TARGET_MOBILE : X_TICK_TARGET_DESKTOP
    const maxT = isMobile ? 8 : 10
    const fullSpan = Math.max(
      1,
      (chartData[chartData.length - 1]?.ts ?? 0) - (chartData[0]?.ts ?? 0),
    )
    const visSpan = Math.max(1, endMs - startMs)
    const ratio = visSpan / fullSpan
    const zoomBoost = Math.round((1 - Math.min(1, ratio)) * (maxT - base) * 1.2)
    const target = Math.min(maxT, Math.max(base, base + zoomBoost))
    return pickEvenTimeAxisTicks(startMs, endMs, target)
  }, [xTimeDomain, chartData, isMobile])

  const xSpanMs = xTimeDomain ? xTimeDomain[1] - xTimeDomain[0] : 0

  const bottomMarkers = useMemo(() => {
    if (!series?.bottoms?.length) return []
    return series.bottoms
      .map((b) => {
        const row = chartData.find((r) => r.date === b.d0)
        if (!row) return null
        return { ...b, chartSpx: row.spx, chartPanic: row.panic, ts: row.ts }
      })
      .filter(Boolean)
  }, [series, chartData])

  const tierMarkers = useMemo(() => {
    if (!series?.bottoms?.length || !activeBottom) return []
    const b = series.bottoms.find((x) => x.d0 === activeBottom)
    if (!b) return []
    /** @type {{ key: string; date: string; ts: number; panic: number; label: string }[]} */
    const marks = []
    if (b.first50) {
      const ts = dayKeyToUtcMs(b.first50.date)
      if (ts != null)
        marks.push({
          key: "50",
          date: b.first50.date,
          ts,
          panic: b.first50.panic,
          label: "50",
        })
    }
    if (b.first60) {
      const ts = dayKeyToUtcMs(b.first60.date)
      if (ts != null)
        marks.push({
          key: "60",
          date: b.first60.date,
          ts,
          panic: b.first60.panic,
          label: "60",
        })
    }
    if (b.first70) {
      const ts = dayKeyToUtcMs(b.first70.date)
      if (ts != null)
        marks.push({
          key: "70",
          date: b.first70.date,
          ts,
          panic: b.first70.panic,
          label: "70",
        })
    }
    return marks
  }, [series, activeBottom])

  const focusBottom = useCallback(
    (d0) => {
      if (!series) return
      if (activeBottom === d0) {
        setActiveBottom(null)
        setDomain(null)
        setBrushIndex(defaultBrushIndex)
        return
      }
      const win = resolveBottomWindowDomain(series, d0, 20, 5)
      setActiveBottom(d0)
      setDomain(win)
      setBrushIndex(null)
    },
    [series, activeBottom, defaultBrushIndex],
  )

  const resetZoom = useCallback(() => {
    setActiveBottom(null)
    setDomain(null)
    setBrushIndex(defaultBrushIndex)
  }, [defaultBrushIndex])

  const onBrushChange = useCallback((range) => {
    if (
      range &&
      typeof range.startIndex === "number" &&
      typeof range.endIndex === "number"
    ) {
      setBrushIndex({ startIndex: range.startIndex, endIndex: range.endIndex })
    }
  }, [])

  const formatXTick = useCallback(
    (v) => formatHistoryTimeAxisTick(v, xSpanMs),
    [xSpanMs],
  )

  if (loadError) {
    return (
      <div className="yds-panic-spx-val yds-panic-spx-val--empty" role="status">
        <p className="yds-panic-spx-val__empty">히스토리 시계열을 불러오지 못했습니다.</p>
      </div>
    )
  }

  if (!series || chartData.length < 2 || !xTimeDomain) {
    return (
      <div className="yds-panic-spx-val yds-panic-spx-val--empty" role="status">
        <p className="yds-panic-spx-val__empty">히스토리 시계열 준비중…</p>
      </div>
    )
  }

  return (
    <div className="yds-panic-spx-val">
      <div className="yds-panic-spx-val__toolbar">
        <p className="yds-panic-spx-val__hint">
          저점 구간을 보려면 칩을 누르세요 · 최근 보기는 Reset
        </p>
        <button type="button" className="yds-panic-spx-val__reset" onClick={resetZoom}>
          Reset
        </button>
      </div>

      <div className="yds-panic-spx-val__chips" role="list" aria-label="SPX 주요 저점">
        {(series.bottoms ?? []).map((b) => (
          <button
            key={b.d0}
            type="button"
            role="listitem"
            className={[
              "yds-panic-spx-val__chip",
              activeBottom === b.d0 ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => focusBottom(b.d0)}
          >
            {b.d0.slice(2)}
          </button>
        ))}
      </div>

      <div className="yds-panic-spx-val__plot">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <ComposedChart data={filteredData} margin={chartMargin}>
            <CartesianGrid stroke="rgba(148,163,184,0.07)" vertical={false} />
            <XAxis
              dataKey="ts"
              type="number"
              scale="time"
              domain={xTimeDomain}
              ticks={xAxisTicks}
              interval={0}
              tickFormatter={formatXTick}
              tick={{ fill: "#4b5563", fontSize: isMobile ? 9 : 10 }}
              axisLine={{ stroke: "rgba(148,163,184,0.16)" }}
              tickLine={false}
            />
            <YAxis
              yAxisId="panic"
              domain={[0, 100]}
              ticks={[0, 20, 40, 50, 60, 70, 80, 100]}
              width={panicAxisWidth}
              tick={{ fill: "#6b7280", fontSize: isMobile ? 9 : 10 }}
              axisLine={false}
              tickLine={false}
              label={
                isMobile
                  ? undefined
                  : {
                      value: "Panic",
                      angle: -90,
                      position: "insideLeft",
                      offset: 4,
                      style: { fill: "#4b5563", fontSize: 10 },
                    }
              }
            />
            <YAxis
              yAxisId="spx"
              orientation="right"
              domain={["auto", "auto"]}
              width={spxAxisWidth}
              tick={{ fill: "#4b5563", fontSize: isMobile ? 9 : 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) =>
                Number(v) >= 1000 ? `${Math.round(Number(v) / 100) / 10}k` : String(v)
              }
              label={
                isMobile
                  ? undefined
                  : {
                      value: "SPX",
                      angle: 90,
                      position: "insideRight",
                      offset: 4,
                      style: { fill: "#4b5563", fontSize: 10 },
                    }
              }
            />
            <Tooltip content={<ValidationTooltip />} />
            <Legend
              verticalAlign="top"
              height={isMobile ? 18 : 22}
              wrapperStyle={{ fontSize: isMobile ? 10 : 11, color: "#94a3b8", paddingBottom: 4 }}
            />

            <ReferenceLine
              yAxisId="panic"
              y={50}
              stroke="#a16207"
              strokeDasharray="3 5"
              strokeWidth={1}
              strokeOpacity={0.55}
              label={{ value: "50", position: "insideTopLeft", fill: "#78716c", fontSize: 9 }}
            />
            <ReferenceLine
              yAxisId="panic"
              y={60}
              stroke="#c2410c"
              strokeDasharray="3 5"
              strokeWidth={1}
              strokeOpacity={0.55}
              label={{ value: "60", position: "insideTopLeft", fill: "#78716c", fontSize: 9 }}
            />
            <ReferenceLine
              yAxisId="panic"
              y={70}
              stroke="#b91c1c"
              strokeDasharray="3 5"
              strokeWidth={1}
              strokeOpacity={0.6}
              label={{ value: "70", position: "insideTopLeft", fill: "#78716c", fontSize: 9 }}
            />

            <Line
              yAxisId="spx"
              type="monotone"
              dataKey="spx"
              name="S&P500"
              stroke="#475569"
              strokeWidth={1.1}
              strokeOpacity={0.72}
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Line
              yAxisId="panic"
              type="monotone"
              dataKey="panic"
              name="Panic Index"
              stroke="#7dd3fc"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />

            {bottomMarkers.map((b) => (
              <ReferenceDot
                key={`bottom-${b.d0}`}
                yAxisId="spx"
                x={b.ts}
                y={b.chartSpx}
                r={activeBottom === b.d0 ? 5 : 3.5}
                fill="#f8fafc"
                stroke="#e2e8f0"
                strokeWidth={1.5}
                ifOverflow="hidden"
                label={
                  activeBottom === b.d0
                    ? {
                        value: "SPX 저점",
                        position: "top",
                        fill: "#cbd5e1",
                        fontSize: 9,
                      }
                    : undefined
                }
              />
            ))}

            {tierMarkers.map((m) => (
              <ReferenceDot
                key={`tier-${m.key}-${m.date}`}
                yAxisId="panic"
                x={m.ts}
                y={m.panic}
                r={4}
                fill={m.key === "70" ? "#ef4444" : m.key === "60" ? "#f97316" : "#eab308"}
                stroke="#0b0e14"
                strokeWidth={1}
                ifOverflow="hidden"
                label={{
                  value: m.label,
                  position: "bottom",
                  fill: "#94a3b8",
                  fontSize: 9,
                }}
              />
            ))}

            {!domain && activeBrushIndex ? (
              <Brush
                dataKey="ts"
                height={22}
                stroke="rgba(148,163,184,0.35)"
                fill="rgba(15,23,42,0.6)"
                tickFormatter={formatXTick}
                travellerWidth={8}
                startIndex={activeBrushIndex.startIndex}
                endIndex={activeBrushIndex.endIndex}
                onChange={onBrushChange}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
