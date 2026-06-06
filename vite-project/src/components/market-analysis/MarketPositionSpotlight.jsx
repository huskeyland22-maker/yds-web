import { useMemo } from "react"
import { MACRO_V1_STATUS_BANDS, resolveMacroV1Status } from "../../panic-v2/panicMacroV1Status.js"
import { getFinalScore } from "../../utils/tradingScores.js"

const STAGE_SHORT = {
  overheated: "과열",
  neutral: "중립",
  interest: "관심",
  dca: "분할매수",
  panicBuy: "패닉매수",
}

/**
 * 1초 시장 위치 — 핵심지수 아래 · 패닉 차트 위
 * @param {{ panicData?: object | null }} props
 */
export default function MarketPositionSpotlight({ panicData = null }) {
  const model = useMemo(() => {
    if (!panicData) return null
    const raw = getFinalScore(panicData)
    if (!Number.isFinite(raw)) return null
    const score = Math.max(0, Math.min(100, Math.round(raw)))
    const stage = resolveMacroV1Status(score)
    if (!stage) return null
    return {
      score,
      scoreDisplay: `${score} / 100`,
      stageId: stage.id,
      stageLabel: stage.label,
      stageEmoji: stage.emoji,
      stageColor: stage.color,
      markerPct: score,
    }
  }, [panicData])

  if (!model) {
    return (
      <section className="yds-market-spotlight yds-market-spotlight--empty trading-card-shell" aria-label="현재 시장 위치">
        <h2 className="yds-market-spotlight__title">📍 현재 시장 위치</h2>
        <p className="yds-market-spotlight__empty">시장 데이터를 불러오는 중…</p>
      </section>
    )
  }

  return (
    <section
      className="yds-market-spotlight trading-card-shell panic-v2-section"
      aria-labelledby="market-spotlight-title"
    >
      <h2 id="market-spotlight-title" className="yds-market-spotlight__title">
        📍 현재 시장 위치
      </h2>

      <div className="yds-market-spotlight__hero">
        <p className="yds-market-spotlight__kicker">시장 위치</p>
        <p className="yds-market-spotlight__score font-mono tabular-nums">{model.scoreDisplay}</p>
        <p
          className="yds-market-spotlight__stage"
          style={{ "--spotlight-stage-color": model.stageColor }}
        >
          <span aria-hidden>{model.stageEmoji}</span> {model.stageLabel}
        </p>
      </div>

      <div className="yds-market-spotlight__rail-wrap" aria-hidden={false}>
        <div className="yds-market-spotlight__rail" role="img" aria-label={`YDS ${model.scoreDisplay} · ${model.stageLabel}`}>
          {MACRO_V1_STATUS_BANDS.map((band) => {
            const active = band.id === model.stageId
            return (
              <div
                key={band.id}
                className={[
                  "yds-market-spotlight__segment",
                  active ? "is-active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-stage={band.id}
                style={{ "--segment-color": band.color }}
              >
                <span className="yds-market-spotlight__segment-emoji">{band.emoji}</span>
                <span className="yds-market-spotlight__segment-label">
                  {STAGE_SHORT[band.id] ?? band.label}
                </span>
              </div>
            )
          })}
        </div>

        <div
          className="yds-market-spotlight__marker"
          style={{
            left: `${model.markerPct}%`,
            "--marker-color": model.stageColor,
          }}
        >
          <span className="yds-market-spotlight__marker-arrow" aria-hidden>
            ▲
          </span>
          <span className="yds-market-spotlight__marker-score font-mono tabular-nums">
            {model.scoreDisplay}
          </span>
          <span className="yds-market-spotlight__marker-stage">{model.stageLabel}</span>
        </div>
      </div>
    </section>
  )
}
