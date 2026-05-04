import Gauge from "./Gauge.jsx"

function scoreStatus(score) {
  if (score <= 30) {
    return { label: "과열 구간", className: "text-[#ef4444]" }
  }
  if (score < 70) {
    return { label: "중립 구간", className: "text-[#f59e0b]" }
  }
  return { label: "매수 구간", className: "text-[#22c55e]" }
}

export default function SignalCard({ title, score, description }) {
  const { label, className } = scoreStatus(score)

  return (
    <article className="relative z-0 rounded-2xl bg-[#111827] p-6 text-center shadow-lg shadow-black/20 transition duration-200 ease-out hover:z-10 hover:scale-105 hover:shadow-xl">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <div className="mt-4">
        <Gauge score={score} />
        <p className="mt-1 text-sm text-gray-500">
          <span className="font-mono text-gray-300">{score}</span>
          <span className="text-gray-500"> / 100</span>
        </p>
      </div>
      <p className={`mt-4 text-sm font-semibold ${className}`}>{label}</p>
      <p className="mt-2 text-xs leading-relaxed text-gray-400">{description}</p>
    </article>
  )
}
