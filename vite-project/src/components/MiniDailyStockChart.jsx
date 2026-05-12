import { useId, useMemo, useState } from "react"
import {
  Area,
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

const VOL_UP = "rgba(34, 211, 238, 0.55)"
const VOL_DOWN = "rgba(71, 85, 105, 0.55)"
const VOL_NEUTRAL = "rgba(100, 116, 139, 0.35)"

/**
 * 세로 crosshair — ComposedChart는 `points`, BarChart는 밴드 `x,y,width,height`로 전달됨.
 * @param {Record<string, unknown>} props
 */
function SyncedCrosshair(props) {
  const points = /** @type {{ x: number; y: number }[] | undefined} */ (props.points)
  if (Array.isArray(points) && points.length >= 2 && points[0] && points[1]) {
    const { x: x1, y: y1 } = points[0]
    const { x: x2, y: y2 } = points[1]
    return (
      <g className="pointer-events-none">
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(34,211,238,0.12)" strokeWidth={6} strokeLinecap="round" />
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(34,211,238,0.75)" strokeWidth={1} strokeDasharray="3 3" />
      </g>
    )
  }
  const x = /** @type {number | undefined} */ (props.x)
  const y = /** @type {number | undefined} */ (props.y)
  const w = /** @type {number | undefined} */ (props.width)
  const h = /** @type {number | undefined} */ (props.height)
  if (x != null && y != null && w != null && h != null && Number.isFinite(x + w / 2)) {
    const cx = x + w / 2
    const y2 = y + h
    return (
      <g className="pointer-events-none">
        <line x1={cx} y1={y} x2={cx} y2={y2} stroke="rgba(34,211,238,0.12)" strokeWidth={6} strokeLinecap="round" />
        <line x1={cx} y1={y} x2={cx} y2={y2} stroke="rgba(34,211,238,0.75)" strokeWidth={1} strokeDasharray="3 3" />
      </g>
    )
  }
  return null
}

/**
 * @param {{ active?: boolean; payload?: Array<{ payload?: Record<string, unknown> }> }} props
 */
function MiniChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row || typeof row !== "object") return null
  const dateRaw = /** @type {string} */ (row.dateRaw)
  const fmt = (n) => {
    if (n == null || !Number.isFinite(Number(n))) return "—"
    const v = Number(n)
    const opts = v >= 1000 && v % 1 === 0 ? { maximumFractionDigits: 0 } : { maximumFractionDigits: 2 }
    return v.toLocaleString("ko-KR", opts)
  }
  const dateStr =
    dateRaw && dateRaw.length === 8
      ? `${dateRaw.slice(0, 4)}.${dateRaw.slice(4, 6)}.${dateRaw.slice(6, 8)}`
      : "날짜 미상"

  return (
    <div
      className="pointer-events-none min-w-[260px] max-w-[min(100vw-2rem,320px)] rounded-2xl border border-cyan-400/25 bg-[rgba(5,10,18,0.92)] px-5 py-5 backdrop-blur-xl"
      style={{
        boxShadow:
          "0 0 0 1px rgba(34,211,238,0.1), 0 0 40px rgba(34,211,238,0.12), 0 24px 56px rgba(0,0,0,0.6)",
      }}
    >
      <p className="m-0 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200/90">{dateStr}</p>
      <p className="m-0 mt-3 font-['Playfair_Display',Georgia,serif] text-[2.1rem] font-semibold leading-none tabular-nums tracking-tight text-slate-50 sm:text-[2.35rem]">
        {fmt(row.close)}
      </p>
      <p className="m-0 mt-2 text-sm text-slate-500">종가 (원)</p>
      <dl className="m-0 mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-base tabular-nums leading-snug">
        <dt className="m-0 text-slate-500">거래량</dt>
        <dd className="m-0 text-right font-semibold text-slate-100">{fmt(row.volume)}</dd>
        <dt className="m-0 text-slate-500">20MA</dt>
        <dd className="m-0 text-right font-semibold text-cyan-200">{fmt(row.ma20)}</dd>
        <dt className="m-0 text-slate-500">60MA</dt>
        <dd className="m-0 text-right font-semibold text-slate-400">{fmt(row.ma60)}</dd>
      </dl>
    </div>
  )
}

/**
 * 코리아 밸류체인 종목 패널 — 압축 실전 흐름 차트 (종가·이평·거래량).
 * @param {{ bars: Array<{ date?: string | null; close: number; volume: number; ma20?: number | null; ma60?: number | null }>; className?: string }} props
 */
export default function MiniDailyStockChart({ bars, className = "" }) {
  const uid = useId().replace(/:/g, "")
  const gradId = `miniPriceFill-${uid}`
  const dotGlowUpId = `dotGlowUp-${uid}`
  const dotGlowDownId = `dotGlowDown-${uid}`
  const syncId = `mini-stock-${uid}`
  const [hoverCard, setHoverCard] = useState(false)

  const data = useMemo(() => {
    if (!Array.isArray(bars) || bars.length === 0) return []
    return bars.map((b, idx) => {
      const prev = idx > 0 ? bars[idx - 1] : null
      const prevVol = prev && Number.isFinite(prev.volume) ? prev.volume : null
      const volUp = prevVol != null && b.volume >= prevVol
      return {
        x: idx,
        dateRaw: b.date ?? "",
        close: b.close,
        volume: Math.max(0, b.volume ?? 0),
        ma20: b.ma20 ?? null,
        ma60: b.ma60 ?? null,
        volUp,
      }
    })
  }, [bars])

  const tickStep = useMemo(() => Math.max(1, Math.floor(data.length / 5)), [data.length])

  const lastRow = data[data.length - 1]
  const prevRow = data.length > 1 ? data[data.length - 2] : null
  const lastUp = prevRow != null && lastRow != null && lastRow.close >= prevRow.close

  const fmtShort = (n) => {
    if (n == null || !Number.isFinite(Number(n))) return "—"
    return Number(n).toLocaleString("ko-KR", { maximumFractionDigits: 0 })
  }

  if (data.length < 3) return null

  const xTickFmt = (x) => {
    const xi = Number(x)
    if (!Number.isFinite(xi)) return ""
    const r = data[xi]
    if (!r?.dateRaw || r.dateRaw.length !== 8) return ""
    if (xi !== 0 && xi !== data.length - 1 && xi % tickStep !== 0) return ""
    return `${r.dateRaw.slice(2, 4)}/${r.dateRaw.slice(4, 6)}`
  }

  const chartMargins = { left: 4, right: 52 }
  const lastIdx = data.length - 1
  const crosshairEl = <SyncedCrosshair />

  return (
    <div
      className={`group/chartcard relative w-full min-w-0 overflow-hidden rounded-xl border bg-[rgba(6,10,18,0.62)] px-3 pb-3 pt-4 transition-[box-shadow,border-color] duration-300 sm:px-4 sm:pb-4 sm:pt-5 ${
        hoverCard
          ? "border-cyan-400/35 shadow-[0_0_0_1px_rgba(34,211,238,0.12),0_0_36px_rgba(34,211,238,0.14)]"
          : "border-white/[0.08] shadow-[inset_0_1px_0_rgba(34,211,238,0.07),0_0_40px_rgba(34,211,238,0.05)]"
      } ${className}`}
      onMouseEnter={() => setHoverCard(true)}
      onMouseLeave={() => setHoverCard(false)}
      onFocus={() => setHoverCard(true)}
      onBlur={() => setHoverCard(false)}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-100"
        style={{
          background:
            "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(34,211,238,0.11), transparent 52%), radial-gradient(ellipse 70% 45% at 100% 100%, rgba(56,189,248,0.06), transparent 50%)",
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.15),transparent_40%)]" aria-hidden />

      <div className="relative flex flex-col gap-1">
        <div className="relative h-[172px] w-full min-w-0 sm:h-[180px]">
          <div
            className={`pointer-events-none absolute right-1 top-1/2 z-10 max-w-[4.5rem] -translate-y-1/2 rounded-lg border px-2 py-1.5 text-right transition-opacity duration-300 ${
              lastUp
                ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.25)]"
                : "border-rose-500/20 bg-rose-950/40 text-rose-100/95 shadow-[0_0_16px_rgba(244,63,94,0.15)]"
            }`}
          >
            <p className="m-0 text-[9px] font-medium uppercase tracking-wider text-slate-500">종가</p>
            <p className="m-0 mt-0.5 text-xs font-semibold tabular-nums leading-tight text-slate-50">{fmtShort(lastRow?.close)}</p>
          </div>

          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              syncId={syncId}
              margin={{ top: 10, right: chartMargins.right, left: chartMargins.left, bottom: 2 }}
              isAnimationActive
              animationDuration={520}
              animationEasing="ease-out"
            >
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(34,211,238,0.32)" />
                  <stop offset="55%" stopColor="rgba(34,211,238,0.08)" />
                  <stop offset="100%" stopColor="rgba(34,211,238,0)" />
                </linearGradient>
                <filter id={dotGlowUpId} x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="2.2" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id={dotGlowDownId} x="-80%" y="-80%" width="260%" height="260%">
                  <feGaussianBlur stdDeviation="2" result="b2" />
                  <feMerge>
                    <feMergeNode in="b2" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <XAxis dataKey="x" type="category" hide allowDuplicatedCategory />
              <YAxis domain={["auto", "auto"]} hide width={0} />
              <Tooltip
                content={<MiniChartTooltip />}
                cursor={crosshairEl}
                isAnimationActive={false}
                shared
              />
              <Line
                type="monotone"
                dataKey="ma60"
                stroke="rgba(148, 163, 184, 0.55)"
                strokeWidth={1.15}
                dot={false}
                connectNulls={false}
                isAnimationActive
                animationDuration={480}
                animationEasing="ease-out"
                animationBegin={40}
              />
              <Line
                type="monotone"
                dataKey="ma20"
                stroke="rgba(34, 211, 238, 0.92)"
                strokeWidth={1.85}
                dot={false}
                connectNulls={false}
                isAnimationActive
                animationDuration={500}
                animationEasing="ease-out"
                animationBegin={80}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke="#22d3ee"
                strokeWidth={2}
                fill={`url(#${gradId})`}
                dot={false}
                activeDot={{ r: 4, fill: "#ecfeff", stroke: "rgba(34,211,238,0.95)", strokeWidth: 1.5 }}
                isAnimationActive
                animationDuration={560}
                animationEasing="ease-out"
                animationBegin={120}
              />
              {lastRow != null && Number.isFinite(lastRow.close) ? (
                <ReferenceDot
                  x={lastIdx}
                  y={lastRow.close}
                  isFront
                  shape={(dotProps) => {
                    const { cx, cy } = dotProps
                    if (cx == null || cy == null) return null
                    const fid = lastUp ? dotGlowUpId : dotGlowDownId
                    return (
                      <g filter={`url(#${fid})`}>
                        <circle cx={cx} cy={cy} r={9} fill={lastUp ? "rgba(34,211,238,0.22)" : "rgba(244,63,94,0.14)"} />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={5}
                          fill={lastUp ? "#ecfeff" : "#ffe4e6"}
                          stroke={lastUp ? "rgba(34,211,238,1)" : "rgba(251,113,133,0.95)"}
                          strokeWidth={2}
                        />
                      </g>
                    )
                  }}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="relative h-[56px] w-full min-w-0 border-t border-white/[0.07] pt-1 sm:h-[60px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              syncId={syncId}
              margin={{ top: 4, right: chartMargins.right, left: chartMargins.left, bottom: 4 }}
              barCategoryGap="14%"
              isAnimationActive
              animationDuration={440}
              animationEasing="ease-out"
            >
              <XAxis
                dataKey="x"
                type="category"
                allowDuplicatedCategory
                tick={{ fill: "rgba(148,163,184,0.48)", fontSize: 10 }}
                tickFormatter={xTickFmt}
                axisLine={{ stroke: "rgba(148,163,184,0.12)" }}
                tickLine={false}
                height={20}
              />
              <YAxis hide domain={[0, "auto"]} width={0} />
              <Tooltip
                content={<MiniChartTooltip />}
                cursor={crosshairEl}
                isAnimationActive={false}
                shared
              />
              <Bar dataKey="volume" radius={[2, 2, 0, 0]} maxBarSize={6} isAnimationActive animationDuration={420}>
                {data.map((entry, i) => (
                  <Cell
                    key={`v-${entry.x}`}
                    fill={i === 0 ? VOL_NEUTRAL : entry.volUp ? VOL_UP : VOL_DOWN}
                    fillOpacity={i === 0 ? 0.65 : entry.volUp ? 0.85 : 0.75}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
