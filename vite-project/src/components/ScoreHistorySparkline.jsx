/**
 * 최근 패닉 점수 스냅샷 라인 차트 (SVG, 최대 30개).
 */
export default function ScoreHistorySparkline({ history }) {
  const h = Array.isArray(history) ? history : []
  const w = 320
  const hgt = 72
  const padX = 8
  const padY = 6
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
      : scores
          .map((_, i) => `${i === 0 ? "M" : "L"} ${xs[i].toFixed(1)} ${ys[i].toFixed(1)}`)
          .join(" ")

  const areaD =
    n === 1
      ? ""
      : `M ${xs[0].toFixed(1)} ${padY + innerH} ${scores
          .map((_, i) => `L ${xs[i].toFixed(1)} ${ys[i].toFixed(1)}`)
          .join(" ")} L ${xs[n - 1].toFixed(1)} ${padY + innerH} Z`

  return (
    <div className="mt-4 w-full">
      <p className="mb-1.5 text-left text-xs font-medium text-gray-400">최근 점수 추이 (스냅샷 최대 30개)</p>
      <div className="overflow-hidden rounded-lg border border-gray-800 bg-[#0b1222]">
        <svg
          viewBox={`0 0 ${w} ${hgt}`}
          className="h-[88px] w-full max-w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="최근 패닉 점수 라인 차트"
        >
          <defs>
            <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(139, 92, 246)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="rgb(139, 92, 246)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = padY + innerH * (1 - t)
            return (
              <line
                key={t}
                x1={padX}
                y1={y}
                x2={w - padX}
                y2={y}
                stroke="rgb(55,65,81)"
                strokeWidth="0.5"
                strokeDasharray="3 4"
              />
            )
          })}
          {areaD ? <path d={areaD} fill="url(#sparkFill)" /> : null}
          <path
            d={lineD}
            fill="none"
            stroke="rgb(167, 139, 250)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {scores.map((_, i) => (
            <circle key={`pt-${i}`} cx={xs[i]} cy={ys[i]} r="3" fill="rgb(196, 181, 253)" />
          ))}
        </svg>
        <div className="flex justify-between border-t border-gray-800/90 px-2 py-1 text-[10px] text-gray-500">
          <span>
            {formatShort(h[0]?.date)} — {formatShort(h[h.length - 1]?.date)}
          </span>
          <span className="font-mono text-gray-400">
            {scores[scores.length - 1]} / 100 (최신)
          </span>
        </div>
      </div>
    </div>
  )
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
