import { useMemo } from "react"
import { getRecommendedStocks } from "../utils/stockRecommendations.js"

const RING = {
  up: "border-emerald-500/50 bg-emerald-500/[0.06] ring-1 ring-emerald-500/25",
  neutral: "border-amber-500/45 bg-amber-500/[0.06] ring-1 ring-amber-500/25",
  defensive: "border-amber-500/45 bg-amber-500/[0.06] ring-1 ring-amber-500/25",
  danger: "border-red-500/45 bg-red-500/[0.07] ring-1 ring-red-500/25",
}

const TITLE = {
  up: "text-emerald-300",
  neutral: "text-amber-200",
  defensive: "text-amber-200",
  danger: "text-red-300",
}

const RANK = {
  up: "text-emerald-400/90",
  neutral: "text-amber-400/90",
  defensive: "text-amber-400/90",
  danger: "text-red-400/90",
}

export default function StockRecommendCard({ score }) {
  const { regime, picks } = useMemo(() => getRecommendedStocks(score), [score])
  const tone = regime.tone
  const ring = RING[tone] ?? RING.neutral
  const titleC = TITLE[tone] ?? TITLE.neutral
  const rankC = RANK[tone] ?? RANK.neutral

  return (
    <article className={`rounded-2xl border px-5 py-5 shadow-lg shadow-black/20 ${ring}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className={`text-lg font-bold ${titleC}`}>🔥 추천 종목 TOP5</h3>
        <p className="text-xs text-gray-500">
          점수 <span className="font-mono text-gray-300">{Math.round(Number(score) || 0)}</span>
          <span className="mx-1">·</span>
          {regime.label}
        </p>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-gray-400">{regime.headline}</p>

      <ol className="mt-4 space-y-3 text-left">
        {picks.map((s, i) => (
          <li
            key={`${s.ticker}-${i}`}
            className="rounded-xl border border-gray-800/80 bg-[#0f172a]/70 px-3 py-2.5"
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <span className={`w-6 shrink-0 text-sm font-bold ${rankC}`}>{i + 1}.</span>
              <span className="font-medium text-gray-100">{s.name}</span>
              <span className="font-mono text-xs text-gray-500">({s.ticker})</span>
              <span className="text-xs text-purple-300/90">· {s.theme}</span>
            </div>
            <p className="mt-1.5 pl-8 text-[11px] leading-relaxed text-gray-500">{s.reason}</p>
          </li>
        ))}
      </ol>

      <p className="mt-4 text-[10px] leading-relaxed text-gray-600">
        참고용 추천이며 매수 권유가 아닙니다. 실제 매매 전 반드시 별도 검증이 필요합니다.
      </p>
    </article>
  )
}
