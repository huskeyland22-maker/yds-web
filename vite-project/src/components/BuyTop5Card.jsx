import { useEffect, useState } from "react"

const ROWS = [
  { rank: 1, name: "삼성전자", tag: "(KR)", score: 82, change: "+2.3%", up: true },
  { rank: 2, name: "SK하이닉스", tag: "", score: 79, change: "+1.1%", up: true },
  { rank: 3, name: "엔비디아", tag: "", score: 76, change: "-0.4%", up: false },
  { rank: 4, name: "테슬라", tag: "", score: 74, change: "+0.9%", up: true },
  { rank: 5, name: "LG에너지", tag: "", score: 71, change: "+0.2%", up: true },
]

export default function BuyTop5Card() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false,
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  return (
    <article
      className="rounded-2xl bg-[#111827] text-center shadow-lg shadow-black/20 transition duration-200 ease-out hover:shadow-xl"
      style={{ padding: isMobile ? "10px" : "18px" }}
    >
      <h3 className="text-lg font-semibold text-white">매수 TOP5</h3>
      <p className="mt-1 text-xs text-gray-500">모멘텀·시그널 종합 스냅샷</p>
      <ul className="mt-6 space-y-0 text-left">
        {ROWS.map((row) => (
          <li
            key={row.rank}
            className="flex flex-row items-center justify-between gap-4 border-b border-gray-800/90 py-3 transition-colors first:pt-0 last:border-b-0 hover:rounded-lg hover:bg-gray-800/50"
          >
            <div className="flex min-w-0 flex-1 items-baseline gap-2">
              <span className="w-6 shrink-0 text-sm font-bold text-purple-400">{row.rank}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-100" style={{ wordBreak: "keep-all", overflowWrap: "break-word" }}>
                  {row.name}
                  {row.tag ? (
                    <span className="ml-1 text-xs font-normal text-gray-500">{row.tag}</span>
                  ) : null}
                </p>
                <p className="text-xs text-gray-500">
                  점수: <span className="font-mono text-gray-300">{row.score}</span>
                </p>
              </div>
            </div>
            <span
              className={
                row.up
                  ? "shrink-0 text-sm font-semibold text-green-400"
                  : "shrink-0 text-sm font-semibold text-red-400"
              }
            >
              {row.up ? "상승 " : "하락 "}
              {row.change}
            </span>
          </li>
        ))}
      </ul>
    </article>
  )
}
