import { useMemo } from "react"
import { MACRO_V1_STATUS_BANDS, resolveMacroV1Status } from "../../panic-v2/panicMacroV1Status.js"
import {
  getStagePhilosophy,
  YDS_CYCLE_TAGLINE,
  YDS_STAGE_INTRO_LIST,
  YDS_STAGE_PHILOSOPHY,
} from "../../content/ydsCyclePhilosophy.js"
import { getFinalScore } from "../../utils/tradingScores.js"

const STAGE_SHORT = {
  overheated: "과열",
  neutral: "중립",
  interest: "관심",
  dca: "분할매수",
  panicBuy: "패닉매수",
}

/**
 * YDS 총점 — CNN F&G 스타일 컴팩트
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
    const philosophy = getStagePhilosophy(stage.id)
    return {
      score,
      stageId: stage.id,
      stageLabel: stage.label,
      stageEmoji: stage.emoji,
      stageColor: stage.color,
      markerPct: score,
      philosophy,
    }
  }, [panicData])

  if (!model) {
    return (
      <section className="yds-market-spotlight yds-market-spotlight--empty" aria-label="YDS 총점">
        <p className="yds-market-spotlight__empty">YDS 총점 불러오는 중…</p>
      </section>
    )
  }

  return (
    <section
      className="yds-market-spotlight"
      aria-label={`YDS 총점 ${model.score} · ${model.stageLabel}`}
    >
      <div className="yds-market-spotlight__head">
        <p className="yds-market-spotlight__label">YDS 총점</p>
        <p className="yds-market-spotlight__score font-mono tabular-nums">{model.score}</p>
        <p
          className="yds-market-spotlight__stage"
          style={{ "--spotlight-stage-color": model.stageColor }}
        >
          <span aria-hidden>{model.stageEmoji}</span> {model.stageLabel}
        </p>
        <p className="yds-market-spotlight__philosophy-hint">
          {model.philosophy.role} · {model.philosophy.hint}
        </p>
      </div>

      <div className="yds-market-spotlight__track" role="presentation">
        <div className="yds-market-spotlight__bar-column">
          <div className="yds-market-spotlight__bar-shell">
            <div className="yds-market-spotlight__bar-track" aria-hidden />
            <div
              className="yds-market-spotlight__bar-fill"
              style={{
                width: `${model.markerPct}%`,
                "--fill-color": model.stageColor,
              }}
              aria-hidden
            />
            <div
              className="yds-market-spotlight__pin"
              style={{
                left: `${model.markerPct}%`,
                "--pin-color": model.stageColor,
              }}
            >
              <span className="yds-market-spotlight__pin-dot" aria-hidden />
            </div>
          </div>

          <div className="yds-market-spotlight__zone-rail" aria-hidden>
            {MACRO_V1_STATUS_BANDS.map((band) => {
              const zonePhilosophy = YDS_STAGE_PHILOSOPHY[band.id]
              const isCurrent = band.id === model.stageId
              return (
                <span
                  key={band.id}
                  className={[
                    "yds-market-spotlight__zone-label",
                    isCurrent ? "is-current" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ "--zone-color": band.color }}
                >
                  <span className="yds-market-spotlight__zone-emoji">{band.emoji}</span>
                  <span className="yds-market-spotlight__zone-name">
                    {STAGE_SHORT[band.id] ?? band.label}
                  </span>
                  {isCurrent ? (
                    <span className="yds-market-spotlight__zone-role">{zonePhilosophy.role}</span>
                  ) : null}
                </span>
              )
            })}
          </div>
        </div>
      </div>

      <details className="yds-market-spotlight__cycle-guide">
        <summary>5단계 사이클 안내</summary>
        <p className="yds-market-spotlight__cycle-tagline">{YDS_CYCLE_TAGLINE}</p>
        <ul className="yds-market-spotlight__cycle-list">
          {YDS_STAGE_INTRO_LIST.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
    </section>
  )
}
