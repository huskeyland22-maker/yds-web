import { useId } from "react"

function Gauge({ score }) {
  const radius = 80
  const circumference = Math.PI * radius
  const offset = circumference * (1 - score / 100)

  const rawId = useId().replace(/:/g, "")
  const gradientId = `gaugeGradient-${rawId}`

  return (
    <div className="relative mx-auto h-[120px] w-[200px]">
      <svg viewBox="0 0 200 120" className="h-full w-full">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="50%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#86efac" />
          </linearGradient>
        </defs>

        {/* 배경 반원 */}
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke="#1f2937"
          strokeWidth="12"
        />

        {/* 진행 반원 */}
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transition: "stroke-dashoffset 0.8s ease-out",
            filter: "drop-shadow(0 0 8px rgba(34,197,94,0.6))",
          }}
        />
      </svg>

      {/* 중앙 숫자 */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-3xl font-bold text-white">
        {score}
      </div>
    </div>
  )
}

export default Gauge
