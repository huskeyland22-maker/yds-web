import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  buildLaneGeometry,
  formatMetricValue,
  pickXAxisLabels,
  resolveSeriesColor,
} from "./macroCycleChartUtils.js"

const VIEW_W = 720
const PAD_X = 36
const LANE_H = 58
const LANE_GAP = 14
const PAD_Y = 8
const X_AXIS_H = 22
const FOOT_H = 14

/**
 * @param {{
 *   rows: object[]
 *   series: { key: string; name?: string; color?: string }[]
 *   resolveInsight?: (key: string, raw: unknown) => string
 * }} props
 */
export default function MacroCycleChart({ rows, series, resolveInsight }) {
  const uid = useId().replace(/:/g, "")
  const wrapRef = useRef(null)
  const pathRefs = useRef({})
  const [tooltip, setTooltip] = useState(null)
  const [mounted, setMounted] = useState(false)

  const validRows = useMemo(() => {
    return (Array.isArray(rows) ? rows : [])
      .filter((r) => series.some((s) => Number.isFinite(Number(r?.[s.key]))))
      .slice(-120)
  }, [rows, series])

  const chartRows = useMemo(() => validRows, [validRows])

  const { lanes, chartHeight, padX, innerW } = useMemo(
    () => buildLaneGeometry(chartRows, series, LANE_H, LANE_GAP, PAD_Y, VIEW_W, PAD_X),
    [chartRows, series],
  )

  const totalH = chartHeight + X_AXIS_H + FOOT_H
  const xLabels = useMemo(() => pickXAxisLabels(chartRows, 4, VIEW_W, PAD_X), [chartRows])

  useLayoutEffect(() => {
    if (validRows.length < 2) return
    const run = () => {
      series.forEach((s) => {
        const el = pathRefs.current[s.key]
        if (!el || typeof el.getTotalLength !== "function") return
        const len = el.getTotalLength()
        el.style.transition = "none"
        el.style.strokeDasharray = `${len}`
        el.style.strokeDashoffset = `${len}`
        requestAnimationFrame(() => {
          el.style.transition = "stroke-dashoffset 1s cubic-bezier(0.33, 1, 0.68, 1)"
          el.style.strokeDashoffset = "0"
        })
      })
    }
    const t = requestAnimationFrame(run)
    const done = setTimeout(() => setMounted(true), 1100)
    return () => {
      cancelAnimationFrame(t)
      clearTimeout(done)
    }
  }, [validRows.length, series])

  const updateHover = useCallback(
    (clientX) => {
      const rect = wrapRef.current?.getBoundingClientRect()
      if (!rect || chartRows.length < 2) return
      const px = clientX - rect.left
      const ratio = Math.max(0, Math.min(1, px / rect.width))
      const idx = Math.round(ratio * Math.max(0, chartRows.length - 1))
      const row = chartRows[idx]
      const iso = row?.ts ? String(row.ts).slice(0, 10) : ""
      const crossX = padX + (idx / Math.max(1, chartRows.length - 1)) * innerW
      setTooltip({
        idx,
        iso,
        pxPct: ratio * 100,
        clientX: px,
        crossX,
        row,
      })
    },
    [chartRows, padX, innerW],
  )

  if (validRows.length < 2) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-slate-700/40 bg-[#060a10]/95 px-4">
        <p className="m-0 text-[11px] font-medium tracking-wide text-slate-500">흐름 데이터 수집 중 · 매크로 시계열 로딩</p>
      </div>
    )
  }

  return (
    <div
      ref={wrapRef}
      className="group relative w-full min-h-[240px] overflow-visible sm:min-h-[260px]"
      onMouseMove={(e) => updateHover(e.clientX)}
      onMouseLeave={() => setTooltip(null)}
      onTouchStart={(e) => {
        const x = e.touches[0]?.clientX
        if (x != null) updateHover(x)
      }}
      onTouchMove={(e) => {
        const x = e.touches[0]?.clientX
        if (x != null) updateHover(x)
      }}
      onTouchEnd={() => setTooltip(null)}
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${totalH}`}
        className="block h-[260px] w-full min-h-[240px] sm:h-[280px] sm:min-h-[260px]"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="매크로 지표 시계열"
      >
        <defs>
          <filter id={`glow-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {series.map((s) => {
            const c = resolveSeriesColor(s)
            return (
              <linearGradient key={`g-${s.key}`} id={`area-${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c} stopOpacity="0.2" />
                <stop offset="55%" stopColor={c} stopOpacity="0.07" />
                <stop offset="100%" stopColor={c} stopOpacity="0.02" />
              </linearGradient>
            )
          })}
        </defs>

        {lanes.map((lane, idx) => {
          const s = series[idx]
          const c = resolveSeriesColor(s)
          const laneTop = idx * (LANE_H + LANE_GAP)
          return (
            <g key={s.key}>
              {[0.33, 0.66].map((r) => (
                <line
                  key={`h-${r}`}
                  x1={padX}
                  y1={laneTop + LANE_H * r}
                  x2={VIEW_W - padX}
                  y2={laneTop + LANE_H * r}
                  stroke="rgba(148,163,184,0.1)"
                  strokeWidth="1"
                  strokeDasharray="4 8"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <line
                x1={padX}
                y1={laneTop + LANE_H}
                x2={VIEW_W - padX}
                y2={laneTop + LANE_H}
                stroke="rgba(71,85,105,0.28)"
                strokeWidth="1"
              />
              {lane.areaD ? (
                <path d={lane.areaD} fill={`url(#area-${uid}-${s.key})`} stroke="none" opacity={mounted ? 1 : 0.88} />
              ) : null}
              {lane.lineD ? (
                <path
                  ref={(el) => {
                    pathRefs.current[s.key] = el
                  }}
                  d={lane.lineD}
                  fill="none"
                  stroke={c}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter={`url(#glow-${uid})`}
                  style={{ opacity: 0.94 }}
                />
              ) : null}
              {lane.lastPt ? (
                <g>
                  <circle cx={lane.lastPt.x} cy={lane.lastPt.y} r="7" fill={c} opacity="0.12">
                    <animate attributeName="r" values="6;10;6" dur="2.6s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.1;0.2;0.1" dur="2.6s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={lane.lastPt.x} cy={lane.lastPt.y} r="3.5" fill={c} stroke="rgba(15,23,42,0.95)" strokeWidth="1.4" />
                </g>
              ) : null}
            </g>
          )
        })}

        {tooltip?.crossX != null ? (
          <line
            x1={tooltip.crossX}
            y1="0"
            x2={tooltip.crossX}
            y2={chartHeight}
            stroke="rgba(226,232,240,0.18)"
            strokeWidth="1"
            strokeDasharray="2 6"
          />
        ) : null}

        {xLabels.map((m, i) => (
          <g key={`x-${i}`}>
            <text
              x={m.x}
              y={chartHeight + 14}
              fill="#64748b"
              fontSize="10"
              fontFamily="ui-monospace, monospace"
              textAnchor="middle"
              style={{ letterSpacing: "0.04em" }}
            >
              {m.label}
            </text>
          </g>
        ))}

        <text
          x={VIEW_W - padX}
          y={totalH - 3}
          fill="rgba(148,163,184,0.28)"
          fontSize="8.5"
          fontFamily="ui-sans-serif, system-ui"
          textAnchor="end"
          fontWeight="500"
          letterSpacing="0.14em"
        >
          Y&apos;ds Macro Cycle Engine
        </text>
      </svg>

      {tooltip && tooltip.row ? (
        <div
          className="pointer-events-none absolute z-30 max-w-[min(92vw,340px)] rounded-md border border-white/[0.1] bg-[#070b12]/92 px-3.5 py-3 shadow-[0_20px_56px_rgba(0,0,0,0.65)] backdrop-blur-md"
          style={{
            left: `${tooltip.pxPct}%`,
            top: "4px",
            transform: "translateX(-50%)",
          }}
        >
          <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.06] pb-2">
            <p className="m-0 font-mono text-[10px] font-semibold tracking-wider text-slate-400">{tooltip.iso}</p>
            <p className="m-0 text-[9px] font-medium uppercase tracking-widest text-slate-600">Crosshair</p>
          </div>
          <div className="mt-2.5 space-y-2.5">
            {series.map((s) => {
              const raw = tooltip.row[s.key]
              const v = Number(raw)
              const val = formatMetricValue(s.key, v)
              const insight = resolveInsight?.(s.key, raw) ?? "—"
              const c = resolveSeriesColor(s)
              return (
                <div key={s.key} className="border-b border-white/[0.05] pb-2.5 last:border-0 last:pb-0">
                  <p className="m-0 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: c }}>
                    {s.name ?? s.key}
                  </p>
                  <p className="m-0 mt-1 font-mono text-2xl font-semibold tabular-nums leading-none text-slate-50">{val}</p>
                  <p className="m-0 mt-1.5 text-[11px] leading-snug text-slate-400">{insight}</p>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
