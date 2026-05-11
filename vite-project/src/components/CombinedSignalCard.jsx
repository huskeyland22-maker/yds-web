import { useEffect, useState } from "react"
import Gauge from "./Gauge.jsx"
import {
  combinedSignalColorClass,
  getSignal,
} from "../utils/getCombinedSignal.js"

export default function CombinedSignalCard({
  shortScore,
  midScore,
  description,
}) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false,
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  const combined = getSignal(shortScore, midScore)
  const colorClass = combinedSignalColorClass[combined.color]
  const gaugeScore = Math.round((shortScore + midScore) / 2)

  return (
    <article
      className="relative z-0 min-h-[320px] min-w-0 w-full rounded-2xl bg-[#111827] text-center shadow-lg shadow-black/20 transition duration-200 ease-out hover:z-10 hover:scale-105 hover:shadow-xl"
      style={{
        padding: isMobile ? "12px" : "24px",
      }}
    >
      <h3 className="text-lg font-semibold text-white">결합 시그널</h3>
      <p className="mt-1 text-xs text-gray-500">
        단기 <span className="font-mono text-gray-300">{shortScore}</span>
        <span className="mx-1 text-gray-600">·</span>
        중기 <span className="font-mono text-gray-300">{midScore}</span>
      </p>
      <div className="mt-4">
        <Gauge score={gaugeScore} width={isMobile ? 180 : 280} height={isMobile ? 110 : 160} />
        <p className="mt-1 text-sm text-gray-500">
          <span className="font-mono text-gray-300">{gaugeScore}</span>
          <span className="text-gray-500"> / 100</span>
          <span className="ml-2 text-xs text-gray-600">(평균)</span>
        </p>
      </div>
      <p className={`mt-4 text-sm font-semibold ${colorClass}`}>{combined.label}</p>
      <p className={`mt-1 text-xs font-medium ${colorClass} opacity-90`}>
        {combined.action}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-gray-400">{description}</p>
    </article>
  )
}
