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

/** 구간 중심 tick (0–100) */
const ZONE_TICKS = [
  { pct: 10, band: MACRO_V1_STATUS_BANDS[0] },
  { pct: 30, band: MACRO_V1_STATUS_BANDS[1] },
  { pct: 50, band: MACRO_V1_STATUS_BANDS[2] },
  { pct: 70, band: MACRO_V1_STATUS_BANDS[3] },
  { pct: 90, band: MACRO_V1_STATUS_BANDS[4] },
]

/**
 * 1초 시장 위치 — 연속 사이클 트랙 (기관형)
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
      <section
        className="yds-market-spotlight yds-market-spotlight--empty trading-card-shell"
        aria-label="현재 시장 위치"
      >
        <p className="yds-market-spotlight__eyebrow">Market Position</p>
        <h2 className="yds-market-spotlight__title">현재 시장 위치</h2>
        <p className="yds-market-spotlight__empty">시장 데이터를 불러오는 중…</p>
      </section>
    )
  }

  return (
    <section
      className="yds-market-spotlight trading-card-shell panic-v2-section"
      aria-labelledby="market-spotlight-title"
    >
      <p className="yds-market-spotlight__eyebrow">Market Position</p>
      <h2 id="market-spotlight-title" className="yds-market-spotlight__title">
        현재 시장 위치
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

      <div
        className="yds-market-spotlight__track"
        role="img"
        aria-label={`YDS ${model.scoreDisplay} · ${model.stageLabel}`}
      >
        <div className="yds-market-spotlight__axis">
          <span className="yds-market-spotlight__axis-end font-mono tabular-nums">0</span>

          <div className="yds-market-spotlight__bar-column">
            <div className="yds-market-spotlight__bar-shell">
              <div className="yds-market-spotlight__bar-gradient" aria-hidden />
              {MACRO_V1_STATUS_BANDS.slice(1).map((band, i) => {
                const boundary = (i + 1) * 20
                return (
                  <span
                    key={band.id}
                    className="yds-market-spotlight__bar-tick"
                    style={{ left: `${boundary}%` }}
                    aria-hidden
                  />
                )
              })}
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

            <div
              className="yds-market-spotlight__callout"
              style={{
                left: `${model.markerPct}%`,
                "--callout-color": model.stageColor,
              }}
            >
              <span className="yds-market-spotlight__callout-arrow" aria-hidden>
                ▲
              </span>
              <span className="yds-market-spotlight__callout-score font-mono tabular-nums">
                {model.scoreDisplay}
              </span>
            </div>

            <div className="yds-market-spotlight__zone-rail" aria-hidden>
              {ZONE_TICKS.map(({ pct, band }) => (
                <span
                  key={band.id}
                  className={[
                    "yds-market-spotlight__zone-label",
                    band.id === model.stageId ? "is-current" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ left: `${pct}%`, "--zone-color": band.color }}
                >
                  <span className="yds-market-spotlight__zone-emoji">{band.emoji}</span>
                  <span className="yds-market-spotlight__zone-name">
                    {STAGE_SHORT[band.id] ?? band.label}
                  </span>
                </span>
              ))}
            </div>
          </div>

          <span className="yds-market-spotlight__axis-end font-mono tabular-nums">100</span>
        </div>
      </div>
    </section>
  )
}
