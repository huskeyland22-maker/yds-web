import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  buildLaneGeometry,
  formatMetricValue,
  pickXAxisLabels,
  resolveSeriesColor,
} from "./macroCycleChartUtils.js"

const VIEW_W = 720
const LANE_H = 38
const LANE_GAP = 12
const PAD_Y = 6
const X_AXIS_H = 22
const FOOT_H = 18

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

  const { lanes, chartHeight } = useMemo(
    () => buildLaneGeometry(chartRows, series, LANE_H, LANE_GAP, PAD_Y, VIEW_W),
    [chartRows, series],
  )

  const totalH = chartHeight + X_AXIS_H + FOOT_H
  const xLabels = useMemo(() => pickXAxisLabels(chartRows, 4), [chartRows])

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
          el.style.transition = "stroke-dashoffset 0.8s cubic-bezier(0.33, 1, 0.68, 1)"
          el.style.strokeDashoffset = "0"
        })
      })
    }
    const t = requestAnimationFrame(run)
    const done = setTimeout(() => setMounted(true), 900)
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
      setTooltip({
        idx,
        iso,
        pxPct: ratio * 100,
        clientX: px,
        row,
      })
    },
    [chartRows],
  )

  if (validRows.length < 2) {
    return (
      <div className="rounded-lg border border-slate-700/50 bg-[#080c12]/90 px-4 py-8 text-center">
        <p className="m-0 text-xs font-medium tracking-wide text-slate-500">흐름 데이터 수집 중 · 매크로 시계열 로딩</p>
      </div>
    )
  }

  return (
    <div
      ref={wrapRef}
      className="group relative w-full min-h-[180px] overflow-visible sm:min-h-[220px]"
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
        className="h-auto w-full max-h-[min(52vh,320px)] sm:max-h-[340px]"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="매크로 지표 미니 시계열"
      >
        <defs>
          <filter id={`glow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {series.map((s) => {
            const c = resolveSeriesColor(s)
            return (
              <linearGradient key={`g-${s.key}`} id={`area-${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c} stopOpacity="0.11" />
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
                  x1="0"
                  y1={laneTop + LANE_H * r}
                  x2={VIEW_W}
                  y2={laneTop + LANE_H * r}
                  stroke="rgba(148,163,184,0.09)"
                  strokeWidth="1"
                  strokeDasharray="4 7"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <line
                x1="0"
                y1={laneTop + LANE_H}
                x2={VIEW_W}
                y2={laneTop + LANE_H}
                stroke="rgba(71,85,105,0.22)"
                strokeWidth="1"
              />
              {lane.areaD ? (
                <path d={lane.areaD} fill={`url(#area-${uid}-${s.key})`} stroke="none" opacity={mounted ? 1 : 0.85} />
              ) : null}
              {lane.lineD ? (
                <path
                  ref={(el) => {
                    pathRefs.current[s.key] = el
                  }}
                  d={lane.lineD}
                  fill="none"
                  stroke={c}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter={`url(#glow-${uid})`}
                  style={{ opacity: 0.92 }}
                />
              ) : null}
              {lane.lastPt ? (
                <g>
                  <circle cx={lane.lastPt.x} cy={lane.lastPt.y} r="6" fill={c} opacity="0.15">
                    <animate attributeName="r" values="5;8;5" dur="2.8s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.12;0.22;0.12" dur="2.8s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={lane.lastPt.x} cy={lane.lastPt.y} r="3.2" fill={c} stroke="rgba(15,23,42,0.9)" strokeWidth="1.2" />
                </g>
              ) : null}
            </g>
          )
        })}

        {tooltip?.clientX != null ? (
          <line
            x1={(tooltip.idx / Math.max(1, chartRows.length - 1)) * VIEW_W}
            y1="0"
            x2={(tooltip.idx / Math.max(1, chartRows.length - 1)) * VIEW_W}
            y2={chartHeight}
            stroke="rgba(148,163,184,0.22)"
            strokeWidth="1"
            strokeDasharray="3 5"
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
          x={VIEW_W - 8}
          y={totalH - 4}
          fill="rgba(148,163,184,0.22)"
          fontSize="9"
          fontFamily="ui-sans-serif, system-ui"
          textAnchor="end"
          fontWeight="500"
          letterSpacing="0.12em"
        >
          Y&apos;ds Macro Cycle Engine
        </text>
      </svg>

      {tooltip && tooltip.row ? (
        <div
          className="pointer-events-none absolute z-30 max-w-[min(92vw,320px)] rounded-lg border border-white/[0.08] bg-slate-950/78 px-3.5 py-3 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-md"
          style={{
            left: `${tooltip.pxPct}%`,
            top: "6px",
            transform: "translateX(-50%)",
          }}
        >
          <p className="m-0 font-mono text-[10px] font-medium tracking-wider text-slate-500">{tooltip.iso}</p>
          <div className="mt-2 space-y-2">
            {series.map((s) => {
              const raw = tooltip.row[s.key]
              const v = Number(raw)
              const val = formatMetricValue(s.key, v)
              const insight = resolveInsight?.(s.key, raw) ?? "—"
              const c = resolveSeriesColor(s)
              return (
                <div key={s.key} className="border-b border-white/[0.05] pb-2 last:border-0 last:pb-0">
                  <p className="m-0 text-[11px] font-semibold uppercase tracking-wide" style={{ color: c }}>
                    {s.name ?? s.key}
                  </p>
                  <p className="m-0 mt-0.5 font-mono text-xl font-semibold tabular-nums text-slate-100">{val}</p>
                  <p className="m-0 mt-1 text-[11px] leading-snug text-slate-400">{insight}</p>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
