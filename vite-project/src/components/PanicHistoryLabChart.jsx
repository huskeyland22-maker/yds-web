import { useMemo } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useChartPinchZoom } from "../hooks/useChartPinchZoom.js"
import { computeCompositeYDomain, LAB_METRICS, PANIC_STAGE_BANDS } from "../utils/panicHistoryLab.js"
import { formatMetricValue } from "./macroCycleChartUtils.js"

const CHART_HEIGHT_DEFAULT = 360
const CHART_MARGIN = { top: 28, right: 12, left: 4, bottom: 24 }
const PX_PER_POINT = 14

function fmtChg(pct) {
  if (pct == null || !Number.isFinite(pct)) return "—"
  const sign = pct >= 0 ? "+" : ""
  return `${sign}${pct.toFixed(1)}%`
}

/**
 * @param {{ active?: boolean; payload?: object[]; label?: string }} props
 */
function LabTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null

  return (
    <div className="max-w-[min(92vw,320px)] rounded-lg border border-white/15 bg-[#070a10]/98 px-3 py-2.5 text-[11px] shadow-xl">
      <p className="m-0 font-semibold text-slate-200">{label ?? row.date}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 border-b border-white/[0.08] pb-1.5">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ backgroundColor: `${row.stageColor}33`, color: row.stageColor }}
        >
          {row.stageLabel}
        </span>
        <span className="font-mono tabular-nums text-slate-100">
          복합 {row.composite != null ? Math.round(row.composite) : "—"}
          <span className="ml-1 text-slate-500">({fmtChg(row.compositeChg)})</span>
        </span>
      </div>
      <ul className="m-0 mt-1.5 max-h-[200px] list-none space-y-1 overflow-y-auto p-0">
        {LAB_METRICS.map((m) => {
          const raw = row[`${m.key}Raw`]
          const chg = row[`${m.key}Chg`]
          if (raw == null && chg == null) return null
          return (
            <li key={m.key} className="flex items-baseline justify-between gap-3">
              <span className="text-slate-500">{m.label}</span>
              <span className="text-right font-mono tabular-nums text-slate-100">
                {raw != null ? formatMetricValue(m.key, raw) : "—"}
                <span className="ml-1 text-[10px] text-slate-500">{fmtChg(chg)}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * @param {{
 *   data: object[]
 *   visibleKeys: Record<string, boolean>
 *   defaultWindow?: number
 *   height?: number
 *   compositeYScale?: "auto" | "full"
 * }} props
 */
export default function PanicHistoryLabChart({
  data,
  visibleKeys,
  defaultWindow = 126,
  height = CHART_HEIGHT_DEFAULT,
  compositeYScale = "auto",
}) {
  const zoom = useChartPinchZoom(data.length, { defaultWindow })
  const visibleData = useMemo(
    () => zoom.visibleSlice(data),
    [data, zoom.visibleSlice, zoom.startIndex, zoom.windowSize],
  )

  const chartMinWidth = useMemo(
    () => Math.max(320, visibleData.length * PX_PER_POINT),
    [visibleData.length],
  )

  const showComposite = visibleKeys.composite !== false

  const compositeValues = useMemo(
    () =>
      visibleData
        .map((d) => d.composite)
        .filter((v) => typeof v === "number" && Number.isFinite(v)),
    [visibleData],
  )

  const yDomain = useMemo(() => {
    if (!showComposite) return [0, 100]
    return computeCompositeYDomain(compositeValues, compositeYScale)
  }, [showComposite, compositeValues, compositeYScale])

  const compositeValueRange = useMemo(() => {
    if (compositeValues.length < 2) return 0
    return Math.max(...compositeValues) - Math.min(...compositeValues)
  }, [compositeValues])

  const tightComposite = showComposite && compositeValueRange <= 3

  if (!data?.length) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-white/[0.06] bg-black/30 text-[11px] text-slate-500"
        style={{ height }}
      >
        panic_index_history 데이터 없음
      </div>
    )
  }

  return (
    <div className="panic-history-lab-chart">
      <div
        className="overflow-x-auto overflow-y-hidden overscroll-x-contain touch-pan-x"
        style={{ WebkitOverflowScrolling: "touch" }}
        onWheel={zoom.onWheel}
        onTouchStart={zoom.onTouchStart}
        onTouchMove={zoom.onTouchMove}
      >
        <div style={{ minWidth: chartMinWidth, height }}>
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={visibleData} margin={CHART_MARGIN}>
              {compositeYScale === "full"
                ? PANIC_STAGE_BANDS.map((band) => (
                    <ReferenceArea
                      key={band.id}
                      y1={band.min}
                      y2={band.max}
                      fill={band.color}
                      fillOpacity={0.06}
                      strokeOpacity={0}
                      ifOverflow="hidden"
                    />
                  ))
                : null}
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="axisLabel"
                stroke="#64748b"
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "rgba(148,163,184,0.25)" }}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                domain={yDomain}
                tickCount={6}
                tickFormatter={(v) => String(Math.round(v))}
                allowDataOverflow
                stroke="#64748b"
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "rgba(148,163,184,0.25)" }}
                width={32}
              />
              <Tooltip content={<LabTooltip />} />
              {showComposite ? (
                <Line
                  type="monotone"
                  dataKey="composite"
                  name="복합 패닉"
                  stroke="#f8fafc"
                  strokeWidth={tightComposite ? 3 : 2.5}
                  dot={
                    tightComposite
                      ? { r: 4, fill: "#f8fafc", stroke: "#0b0e14", strokeWidth: 1 }
                      : false
                  }
                  activeDot={{ r: 5, strokeWidth: 2, fill: "#f8fafc" }}
                  connectNulls
                  isAnimationActive={false}
                />
              ) : null}
              {LAB_METRICS.map((m) =>
                visibleKeys[m.key] ? (
                  <Line
                    key={m.key}
                    type="monotone"
                    dataKey={`${m.key}N`}
                    name={m.label}
                    stroke={m.accent}
                    strokeWidth={1.6}
                    strokeOpacity={0.85}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 1, fill: m.accent }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ) : null,
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[9px] text-slate-500">
        <span>
          {showComposite && compositeYScale === "auto"
            ? `Y축 자동 ${Math.round(yDomain[0])}–${Math.round(yDomain[1])} · 핀치/스크롤`
            : "모바일: 가로 스크롤 · 핀치 줌"}
        </span>
        <button
          type="button"
          onClick={zoom.resetZoom}
          className="rounded border border-white/10 px-2 py-0.5 text-slate-400 hover:text-slate-200"
        >
          줌 리셋
        </button>
      </div>
    </div>
  )
}
