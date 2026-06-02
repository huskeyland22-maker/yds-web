import { useMemo } from "react"
import { resolveMacroV1Status } from "../panic-v2/panicMacroV1Status.js"
import { getFinalScore } from "../utils/tradingScores.js"

/**
 * @param {{ panicData?: object | null; historyRows?: object[] }} props
 */
export default function YdsCompositeHero({ panicData = null, historyRows = [] }) {
  const view = useMemo(() => {
    if (!panicData) return null
    const score = getFinalScore(panicData)
    if (!Number.isFinite(score)) return null
    const stage = resolveMacroV1Status(score)
    const flow = (historyRows ?? [])
      .slice(-3)
      .map((row) => getFinalScore(row))
      .filter(Number.isFinite)
      .map((n) => Math.round(n))
    const trendLine = [...flow, Math.round(score)].slice(-4).join(" → ")
    const actionGuide =
      stage?.id === "panicBuy"
        ? "분할매수 실행 · 현금 우선 투입"
        : stage?.id === "dca"
          ? "분할 진입 확대 · 우량주 우선"
          : stage?.id === "interest"
            ? "관심 종목 선별 · 눌림 대기"
            : stage?.id === "overheated"
              ? "추격 제한 · 현금 비중 확대"
              : "종목 탐색 우선 · 추격매수 제한"
    return {
      score: Math.round(score),
      stageLabel: stage?.label ?? "중립구간",
      stageEmoji: stage?.emoji ?? "⚪",
      trendLine: trendLine || "—",
      actionGuide,
    }
  }, [panicData, historyRows])

  if (!view) return null

  return (
    <section className="yds-composite-hero trading-card-shell panic-v2-section" aria-label="YDS 종합점수">
      <div className="yds-composite-hero__head">
        <p className="m-0 yds-composite-hero__title">YDS 종합점수</p>
        <p className="m-0 yds-composite-hero__score font-mono tabular-nums">{view.score}점</p>
      </div>
      <p className="m-0 yds-composite-hero__stage">
        {view.stageEmoji} {view.stageLabel}
      </p>
      <p className="m-0 yds-composite-hero__trend">최근 흐름 {view.trendLine}</p>
      <p className="m-0 yds-composite-hero__guide">현재 행동 가이드 · {view.actionGuide}</p>
    </section>
  )
}
