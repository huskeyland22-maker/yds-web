import { useId, useMemo } from "react"
import {
  Area,
  Bar,
  BarChart,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

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
      className="pointer-events-none min-w-[200px] rounded-2xl border border-cyan-400/[0.18] bg-[rgba(6,11,20,0.88)] px-4 py-3.5 backdrop-blur-xl"
      style={{
        boxShadow:
          "0 0 0 1px rgba(34,211,238,0.06), 0 0 28px rgba(34,211,238,0.08), 0 20px 48px rgba(0,0,0,0.55)",
      }}
    >
      <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200/80">{dateStr}</p>
      <p className="m-0 mt-2 font-['Playfair_Display',Georgia,serif] text-[26px] font-semibold leading-none tabular-nums tracking-tight text-slate-50">
        {fmt(row.close)}
      </p>
      <p className="m-0 mt-1 text-[11px] text-slate-500">종가 (원)</p>
      <dl className="m-0 mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[12px] tabular-nums">
        <dt className="m-0 text-slate-500">거래량</dt>
        <dd className="m-0 text-right font-medium text-slate-200">{fmt(row.volume)}</dd>
        <dt className="m-0 text-slate-500">20MA</dt>
        <dd className="m-0 text-right font-medium text-sky-200/90">{fmt(row.ma20)}</dd>
        <dt className="m-0 text-slate-500">60MA</dt>
        <dd className="m-0 text-right font-medium text-slate-400">{fmt(row.ma60)}</dd>
      </dl>
    </div>
  )
}

/**
 * 코리아 밸류체인 종목 패널용 미니멀 일봉 차트 (종가·20/60 이평 + 하단 거래량).
 * @param {{ bars: Array<{ date?: string | null; close: number; volume: number; ma20?: number | null; ma60?: number | null }>; className?: string }} props
 */
export default function MiniDailyStockChart({ bars, className = "" }) {
  const uid = useId().replace(/:/g, "")
  const gradId = `miniPriceFill-${uid}`

  const data = useMemo(() => {
    if (!Array.isArray(bars) || bars.length === 0) return []
    return bars.map((b, idx) => ({
      x: idx,
      dateRaw: b.date ?? "",
      close: b.close,
      volume: Math.max(0, b.volume ?? 0),
      ma20: b.ma20 ?? null,
      ma60: b.ma60 ?? null,
    }))
  }, [bars])

  const tickStep = useMemo(() => Math.max(1, Math.floor(data.length / 5)), [data.length])

  if (data.length < 3) return null

  const xTickFmt = (x) => {
    const xi = Number(x)
    if (!Number.isFinite(xi)) return ""
    const r = data[xi]
    if (!r?.dateRaw || r.dateRaw.length !== 8) return ""
    if (xi !== 0 && xi !== data.length - 1 && xi % tickStep !== 0) return ""
    return `${r.dateRaw.slice(2, 4)}/${r.dateRaw.slice(4, 6)}`
  }

  const chartMargins = { left: 2, right: 6 }

  return (
    <div
      className={`relative w-full min-w-0 overflow-hidden rounded-xl border border-white/[0.07] bg-[rgba(6,10,18,0.55)] ${className}`}
      style={{
        boxShadow: "inset 0 1px 0 rgba(34,211,238,0.06), 0 0 48px rgba(34,211,238,0.04)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(34,211,238,0.08),transparent_55%)]" aria-hidden />
      <div className="relative flex flex-col">
        <div className="relative h-[158px] w-full min-w-0 px-1 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 6, right: chartMargins.right, left: chartMargins.left, bottom: 0 }}
              isAnimationActive
              animationDuration={420}
              animationEasing="ease-out"
            >
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(34,211,238,0.28)" />
                  <stop offset="100%" stopColor="rgba(34,211,238,0)" />
                </linearGradient>
              </defs>
              <XAxis dataKey="x" type="category" hide allowDuplicatedCategory />
              <YAxis domain={["auto", "auto"]} hide width={0} />
              <Tooltip
                content={<MiniChartTooltip />}
                cursor={{ stroke: "rgba(34,211,238,0.35)", strokeWidth: 1, strokeDasharray: "4 4" }}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke="#22d3ee"
                strokeWidth={1.65}
                fill={`url(#${gradId})`}
                dot={false}
                activeDot={{ r: 3, fill: "#ecfeff", stroke: "rgba(34,211,238,0.9)", strokeWidth: 1 }}
              />
              <Line
                type="monotone"
                dataKey="ma20"
                stroke="rgba(125,211,252,0.88)"
                strokeWidth={1}
                dot={false}
                connectNulls={false}
                isAnimationActive
                animationDuration={400}
              />
              <Line
                type="monotone"
                dataKey="ma60"
                stroke="rgba(148,163,184,0.5)"
                strokeWidth={1}
                dot={false}
                connectNulls={false}
                isAnimationActive
                animationDuration={400}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="relative h-[52px] w-full min-w-0 border-t border-white/[0.05] px-1 pb-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 2, right: chartMargins.right, left: chartMargins.left, bottom: 2 }}
              barCategoryGap="12%"
            >
              <XAxis
                dataKey="x"
                type="category"
                allowDuplicatedCategory
                tick={{ fill: "rgba(148,163,184,0.42)", fontSize: 9 }}
                tickFormatter={xTickFmt}
                axisLine={{ stroke: "rgba(148,163,184,0.1)" }}
                tickLine={false}
                height={18}
              />
              <YAxis hide domain={[0, "auto"]} width={0} />
              <Tooltip
                content={<MiniChartTooltip />}
                cursor={{ fill: "rgba(34,211,238,0.06)" }}
                isAnimationActive={false}
              />
              <Bar dataKey="volume" fill="rgba(34,211,238,0.2)" maxBarSize={5} radius={[1, 1, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
