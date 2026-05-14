/**
 * 최근 패닉 점수 — 프리미엄 라인·영역 스파크 (스냅샷 최대 30개).
 */
export default function ScoreHistorySparkline({ history }) {
  const h = Array.isArray(history) ? history : []
  const w = 360
  const hgt = 96
  const padX = 10
  const padY = 8
  const innerW = w - padX * 2
  const innerH = hgt - padY * 2

  if (h.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-gray-700/80 bg-[#0f172a]/40 py-6 text-center text-xs text-gray-500">
        스냅샷이 쌓이면 점수 추이 그래프가 표시됩니다.
      </div>
    )
  }

  const scores = h.map((e) => clamp(Number(e.score), 0, 100))
  const n = scores.length
  const xs = scores.map((_, i) => padX + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW))
  const ys = scores.map((s) => padY + innerH - (s / 100) * innerH)

  const lineD =
    n === 1
      ? `M ${xs[0] - 4} ${ys[0]} L ${xs[0] + 4} ${ys[0]}`
      : smoothPath(xs, ys)

  const baseY = padY + innerH
  const areaD =
    n === 1
      ? ""
      : `${lineD} L${xs[n - 1].toFixed(2)},${baseY.toFixed(2)} L${xs[0].toFixed(2)},${baseY.toFixed(2)} Z`

  const last = scores[n - 1]
  const prev = n >= 2 ? scores[n - 2] : last
  const dayChg = n >= 2 && Number.isFinite(prev) ? last - prev : null

  return (
    <div className="mt-4 w-full">
      <p className="mb-1.5 text-left text-xs font-medium text-slate-500">최근 점수 흐름 (스냅샷 최대 30)</p>
      <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#070a10] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <svg
          viewBox={`0 0 ${w} ${hgt}`}
          className="h-[104px] w-full max-w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="최근 패닉 점수 라인 차트"
        >
          <defs>
            <linearGradient id="panicSparkFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(45,212,191)" stopOpacity="0.28" />
              <stop offset="55%" stopColor="rgb(34,211,238)" stopOpacity="0.08" />
              <stop offset="100%" stopColor="rgb(7,10,16)" stopOpacity="0" />
            </linearGradient>
            <filter id="panicSparkGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {[0.5, 1].map((t) => {
            const y = padY + innerH * (1 - t)
            return (
              <line
                key={t}
                x1={padX}
                y1={y}
                x2={w - padX}
                y2={y}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="1"
              />
            )
          })}
          {areaD ? <path d={areaD} fill="url(#panicSparkFill)" /> : null}
          <path
            d={lineD}
            fill="none"
            stroke="rgba(94,234,212,0.95)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#panicSparkGlow)"
          />
          <path
            d={lineD}
            fill="none"
            stroke="rgb(204,251,241)"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.95"
          />
          <g transform={`translate(${xs[n - 1]}, ${ys[n - 1]})`}>
            <circle r="5" fill="rgba(34,211,238,0.25)" className="animate-ping" style={{ animationDuration: "2.2s" }} />
            <circle r="3.2" fill="#ecfeff" stroke="rgb(45,212,191)" strokeWidth="1.5" />
          </g>
        </svg>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.05] px-2.5 py-1.5 text-[10px] text-slate-600">
          <span>
            {formatShort(h[0]?.date)} — {formatShort(h[h.length - 1]?.date)}
          </span>
          <span className="flex items-center gap-2 font-mono tabular-nums">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-cyan-500/80">Now</span>
            <span className="text-slate-100">{last}</span>
            <span className="text-slate-600">/ 100</span>
            {dayChg != null && Number.isFinite(dayChg) ? (
              <span className={dayChg >= 0 ? "text-emerald-400/95" : "text-rose-400/95"}>
                {dayChg >= 0 ? "+" : ""}
                {dayChg.toFixed(1)} pts
              </span>
            ) : null}
          </span>
        </div>
      </div>
    </div>
  )
}

function smoothPath(xs, ys) {
  let d = `M ${xs[0].toFixed(2)} ${ys[0].toFixed(2)}`
  for (let i = 1; i < xs.length; i++) {
    const prev = { x: xs[i - 1], y: ys[i - 1] }
    const curr = { x: xs[i], y: ys[i] }
    const c1x = prev.x + (curr.x - prev.x) * 0.35
    const c2x = prev.x + (curr.x - prev.x) * 0.65
    d += ` C${c1x.toFixed(2)},${prev.y.toFixed(2)} ${c2x.toFixed(2)},${curr.y.toFixed(2)} ${curr.x.toFixed(2)},${curr.y.toFixed(2)}`
  }
  return d
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

function formatShort(iso) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}
