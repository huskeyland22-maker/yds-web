import { useMemo } from "react"
import { buildPanicScoreCompositionReport } from "../../content/ydsPanicScoreComposition.js"
import {
  getPanicScoreV2,
  resolvePanicIndexStatus,
} from "../../utils/tradingScores.js"

/** @param {number} score */
function resolvePanicAccentTier(score) {
  if (score >= 80) return "critical"
  if (score >= 60) return "high"
  if (score >= 40) return "mid"
  return "warm"
}

/**
 * 시장 공포·패닉 — Panic Index V2 (VIX · CNN · Cboe Total P/C)
 * @param {{
 *   panicData?: object | null
 *   historyRows?: object[]
 *   etfContext?: object | null
 *   className?: string
 *   embedded?: boolean
 * }} props
 */
export default function YdsMarketPanicSecondaryPanel({
  panicData = null,
  historyRows: _historyRows = [],
  etfContext: _etfContext = null,
  className = "",
  embedded = false,
}) {
  const score = useMemo(() => getPanicScoreV2(panicData), [panicData])
  const status = useMemo(() => resolvePanicIndexStatus(score), [score])
  const composition = useMemo(() => buildPanicScoreCompositionReport(panicData), [panicData])

  const accentTier = score != null ? resolvePanicAccentTier(score) : "overheat"

  const card = (
    <div
      className={[
        "yds-market-panic-secondary",
        "yds-market-panic-secondary--v7",
        "yds-market-panic-secondary--interpret",
        "yds-market-panic-secondary--core3",
        `yds-market-panic-secondary--accent-${accentTier}`,
      ].join(" ")}
    >
      <div className="yds-market-panic-secondary__title-row">
        <p className="yds-market-panic-secondary__title">시장 공포·패닉</p>
      </div>

      <div className="yds-market-panic-secondary__body">
        {score != null ? (
          <>
            <p className="yds-market-panic-secondary__score-label">Panic Index</p>
            <p className="yds-market-panic-secondary__score font-mono tabular-nums">
              {score}
              <span className="yds-market-panic-secondary__score-unit">점</span>
            </p>
            {status ? (
              <div className="yds-market-panic-secondary__stage" aria-label="패닉 심리 상태">
                <p
                  className="yds-market-panic-secondary__stage-current yds-market-panic-secondary__state-only"
                  style={{ "--legend-color": status.color }}
                >
                  {status.label}
                  <span className="yds-market-panic-secondary__band-hint">
                    {" "}
                    ({status.min}~{status.max})
                  </span>
                </p>
              </div>
            ) : null}
            <ul className="yds-market-panic-secondary__band-list" aria-label="Panic Index 구간">
              <li>0~19 평온</li>
              <li>20~39 경계</li>
              <li>40~59 공포</li>
              <li>60~79 강한 공포</li>
              <li>80~100 극심한 패닉</li>
            </ul>
          </>
        ) : (
          <div className="yds-market-panic-secondary__incomplete" role="status">
            <p className="yds-market-panic-secondary__incomplete-title">데이터 입력 필요</p>
            <p className="yds-market-panic-secondary__incomplete-body">
              일부 지표 데이터가 없어 Panic Index를 계산할 수 없습니다.
            </p>
            <p className="yds-market-panic-secondary__incomplete-hint">
              VIX · CNN Fear &amp; Greed · Cboe Total P/C를 모두 입력해 주세요.
            </p>
          </div>
        )}
      </div>

      {composition.visible ? (
        <section className="yds-panic-composition yds-market-panic-secondary__composition" aria-label="Panic Index 계산 근거">
          <p className="yds-panic-composition__title">계산 근거</p>
          <ul className="yds-panic-composition__list">
            {composition.lines.map((line) => (
              <li key={line.id} className="yds-panic-composition__row">
                <span className="yds-panic-composition__label">
                  {line.label}
                  {line.source ? (
                    <span className="yds-panic-composition__source"> · {line.source}</span>
                  ) : null}
                </span>
                <span
                  className={[
                    "yds-panic-composition__value",
                    "font-mono",
                    "tabular-nums",
                    line.missing ? "yds-panic-composition__value--missing" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {line.display}
                </span>
              </li>
            ))}
          </ul>
          <div className="yds-panic-composition__divider" aria-hidden />
          <div className="yds-panic-composition__total">
            <span className="yds-panic-composition__total-label">Panic Index</span>
            <strong className="yds-panic-composition__total-value font-mono tabular-nums">
              {composition.totalScore != null ? composition.totalScore : "—"}
            </strong>
          </div>
          {composition.asOfDate ? (
            <p className="yds-panic-composition__updated">기준일: {composition.asOfDate}</p>
          ) : null}
        </section>
      ) : null}
    </div>
  )

  if (embedded) return card

  return (
    <section className={["yds-market-panic-secondary-wrap", className].filter(Boolean).join(" ")}>
      {card}
    </section>
  )
}
