import { useMemo } from "react"
import { buildTodayMarketMemo } from "../../content/ydsTodayMarketMemo.js"

/**
 * 오늘의 해석 — 시장 위치 + 패닉 강도 종합
 * @param {{ panicData?: object | null; className?: string }} props
 */
export default function YdsTodayMarketInterpretation({ panicData = null, className = "" }) {
  const memo = useMemo(() => buildTodayMarketMemo(panicData), [panicData])
  if (!memo?.lines?.length) return null

  return (
    <section
      className={["yds-market-desk__interpretation", className].filter(Boolean).join(" ")}
      aria-label={memo.title}
    >
      <h2 className="yds-market-desk__interpretation-title">{memo.title}</h2>
      <div className="yds-market-desk__interpretation-body">
        {memo.lines.map((line) => (
          <p key={line} className="yds-market-desk__interpretation-line">
            {line}
          </p>
        ))}
      </div>
    </section>
  )
}
