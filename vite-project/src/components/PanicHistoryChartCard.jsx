import { useMemo, useState } from "react"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

const RANGES = [
  { key: "1M", days: 30 },
  { key: "3M", days: 90 },
  { key: "6M", days: 180 },
  { key: "1Y", days: 365 },
  { key: "5Y", days: 1825 },
]

function formatLabel(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "-"
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function PanicHistoryChartCard({ history = [], analysisLines = [] }) {
  const [rangeKey, setRangeKey] = useState("1M")
  const days = RANGES.find((r) => r.key === rangeKey)?.days ?? 30

  const rows = useMemo(() => {
    const now = Date.now()
    const cutoff = now - days * 24 * 60 * 60 * 1000
    const filtered = history.filter((r) => {
      const t = new Date(r.date).getTime()
      return Number.isFinite(t) && t >= cutoff
    })
    return filtered.map((r) => ({
      ...r,
      label: formatLabel(r.date),
      sentimentScore: Number(r.sentimentScore ?? r.totalScore),
      vix: Number.isFinite(Number(r.vix)) ? Number(r.vix) : null,
      fearGreed: Number.isFinite(Number(r.fearGreed)) ? Number(r.fearGreed) : null,
      highYield: Number.isFinite(Number(r.highYield)) ? Number(r.highYield) : null,
    }))
  }, [history, days])

  return (
    <section className="rounded-2xl border border-slate-700/70 bg-[#0f172a]/85 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="m-0 text-xs font-semibold tracking-wide text-cyan-300">PANIC HISTORY</p>
          <h3 className="m-0 mt-1 text-lg font-bold text-white">패닉지수 장기 흐름</h3>
        </div>
        <div className="flex gap-1 rounded-lg border border-gray-700/80 bg-[#0b1222]/80 p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRangeKey(r.key)}
              className={`rounded-md px-2 py-1 text-xs transition ${
                rangeKey === r.key ? "bg-cyan-500/20 text-cyan-200" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {r.key}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 h-[260px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis stroke="#64748b" tick={{ fill: "#94a3b8", fontSize: 11 }} width={34} />
            <Tooltip
              contentStyle={{ backgroundColor: "#0b1222", border: "1px solid #334155", borderRadius: "8px" }}
              labelStyle={{ color: "#e2e8f0" }}
            />
            <Line type="monotone" dataKey="sentimentScore" stroke="#22d3ee" strokeWidth={2.3} dot={false} name="통합 점수" />
            <Line type="monotone" dataKey="fearGreed" stroke="#a78bfa" strokeWidth={1.6} dot={false} name="Fear&Greed" />
            <Line type="monotone" dataKey="vix" stroke="#f97316" strokeWidth={1.6} dot={false} name="VIX" />
            <Line type="monotone" dataKey="highYield" stroke="#f43f5e" strokeWidth={1.6} dot={false} name="하이일드" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 grid gap-1">
        <p className="m-0 text-xs font-semibold tracking-wide text-cyan-300">AI 사이클 해석</p>
        {(analysisLines.length ? analysisLines : ["데이터 누적 중"]).map((line) => (
          <p key={line} className="m-0 text-sm text-gray-300">
            - {line}
          </p>
        ))}
      </div>
    </section>
  )
}
