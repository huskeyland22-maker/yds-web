import { useId, useMemo } from "react"

function heatRank(heat) {
  const h = String(heat || "").toUpperCase()
  if (h === "VERY HOT") return 3
  if (h === "HOT") return 2
  if (h === "WARM") return 1
  return 0
}

const NODES = [
  { label: "HBM", sectorIds: ["hbm-ai-semiconductor"] },
  { label: "첨단패키징", sectorIds: ["hbm-ai-semiconductor"] },
  { label: "유리기판", sectorIds: ["hbm-ai-semiconductor"] },
  { label: "전력기기", sectorIds: ["power-grid-hvdc"] },
  { label: "HVDC", sectorIds: ["power-grid-hvdc"] },
  { label: "액침냉각", sectorIds: ["ai-datacenter-infra"] },
  { label: "전력반도체", sectorIds: ["power-semiconductor-electronics"] },
  { label: "데이터센터", sectorIds: ["ai-datacenter-infra", "hbm-ai-semiconductor"] },
]

export default function AiBottleneckFlow({ sectors }) {
  const uid = useId().replace(/:/g, "")

  const heatById = useMemo(() => Object.fromEntries(sectors.map((s) => [s.id, s.heat])), [sectors])

  const enriched = useMemo(() => {
    return NODES.map((n) => {
      let r = 0
      for (const id of n.sectorIds) {
        r = Math.max(r, heatRank(heatById[id]))
      }
      const t = r / 3
      return { ...n, r, t }
    })
  }, [heatById])

  const cx = 360
  const y0 = 36
  const gap = 54

  return (
    <section
      id="ai-bottleneck-flow"
      className="relative z-[1] mx-auto mt-14 max-w-4xl scroll-mt-24 rounded-2xl border border-cyan-400/15 bg-[linear-gradient(180deg,rgba(8,18,32,0.92),rgba(6,10,20,0.96))] px-3 py-8 shadow-[inset_0_1px_0_rgba(34,211,238,0.06),0_24px_64px_rgba(0,0,0,0.35)] md:px-6 md:py-10"
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-50"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(34,211,238,0.14), transparent 55%)",
        }}
        aria-hidden
      />
      <header className="relative z-[1] mb-6 px-2 text-center md:mb-8">
        <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200/80 md:text-[11px]">AI infra bottleneck flow</p>
        <h2 className="m-0 mt-2 font-['Playfair_Display',Georgia,serif] text-xl font-semibold text-slate-50 md:text-2xl">시장 병목 흐름</h2>
        <p className="m-0 mt-2 text-xs text-slate-500 md:text-sm">AI 시대 · 병목 = 자금 밀도 (확인용 시각화)</p>
      </header>

      <div className="relative z-[1] mx-auto w-full max-w-[720px] overflow-x-auto">
        <svg viewBox="0 0 720 520" className="mx-auto min-w-[min(100%,720px)] h-auto w-full" aria-hidden>
          <defs>
            <filter id={`bf-glow-${uid}`} x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id={`bf-edge-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(34,211,238,0.15)" />
              <stop offset="50%" stopColor="rgba(125,211,252,0.55)" />
              <stop offset="100%" stopColor="rgba(34,211,238,0.2)" />
            </linearGradient>
          </defs>

          {enriched.map((n, i) => {
            if (i === 0) return null
            const y1 = y0 + (i - 1) * gap + 18
            const y2 = y0 + i * gap - 18
            const prev = enriched[i - 1]
            const flow = Math.min(prev.t, n.t) * 0.85 + 0.15
            return (
              <line
                key={`e-${i}`}
                x1={cx}
                y1={y1}
                x2={cx}
                y2={y2}
                stroke={`url(#bf-edge-${uid})`}
                strokeWidth={1.4 + flow * 3.5}
                strokeOpacity={0.35 + flow * 0.45}
                strokeLinecap="round"
              >
                <animate attributeName="stroke-opacity" values={`${0.25 + flow * 0.35};${0.45 + flow * 0.45};${0.25 + flow * 0.35}`} dur={`${2.8 + i * 0.15}s`} repeatCount="indefinite" />
              </line>
            )
          })}

          {enriched.map((n, i) => {
            const y = y0 + i * gap
            const w = 118 + n.t * 52
            const h = 34 + n.t * 8
            const strong = n.r >= 3
            const fill = n.r >= 3 ? "rgba(34,211,238,0.42)" : n.r >= 2 ? "rgba(99,102,241,0.32)" : "rgba(51,65,85,0.45)"
            const stroke = n.r >= 3 ? "rgba(186,230,253,0.55)" : n.r >= 2 ? "rgba(129,140,248,0.45)" : "rgba(100,116,139,0.4)"
            return (
              <g key={n.label} filter={strong ? `url(#bf-glow-${uid})` : undefined}>
                {strong ? (
                  <rect
                    x={cx - w / 2 - 12}
                    y={y - h / 2 - 8}
                    width={w + 24}
                    height={h + 16}
                    rx={18}
                    fill="rgba(34,211,238,0.1)"
                    stroke="none"
                  >
                    <animate attributeName="opacity" values="0.45;0.9;0.45" dur="2.4s" repeatCount="indefinite" />
                  </rect>
                ) : null}
                <rect x={cx - w / 2} y={y - h / 2} width={w} height={h} rx={14} fill={fill} stroke={stroke} strokeWidth={strong ? 1.8 : 1.2} />
                <text x={cx} y={y + 5} textAnchor="middle" fill={n.r >= 2 ? "#f1f5f9" : "#94a3b8"} fontSize={n.r >= 3 ? 14 : 13} fontWeight="600" style={{ fontFamily: '"Noto Sans KR",sans-serif' }}>
                  {n.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </section>
  )
}
