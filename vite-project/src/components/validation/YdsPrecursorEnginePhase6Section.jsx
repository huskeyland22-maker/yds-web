import { useMemo } from "react"
import { panicDataFromCycleRow } from "../../utils/cycleHistoryUtils.js"
import { formatMetric } from "../../trading-zone/ydsHistoricalEventTypes.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildPrecursorEnginePhase6Report,
  PRECURSOR_ENGINE_PHASE6_LABEL,
  RADAR_INPUT_LABELS,
} from "../../trading-zone/ydsPrecursorEnginePhase6.js"
import { getPrecursorMetricDisplay } from "../../trading-zone/ydsPrecursorMetricDisplay.js"
import YdsRiskPatternLabel from "./YdsRiskPatternLabel.jsx"

function fmt(v, d = 1) {
  if (v == null || !Number.isFinite(v)) return "—"
  return formatMetric(v, d)
}

/**
 * @param {{
 *   events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[]
 *   latestCycleRow?: Record<string, unknown> | null
 *   latestPanic?: Record<string, unknown> | null
 * }} props
 */
export default function YdsPrecursorEnginePhase6Section({
  events = YDS_VALIDATION_EVENT_DATASET,
  latestCycleRow = null,
  latestPanic = null,
}) {
  const latestSnapshot = useMemo(() => {
    if (latestPanic && typeof latestPanic === "object") {
      return {
        vix: latestPanic.vix,
        fearGreed: latestPanic.fearGreed,
        cnn: latestPanic.fearGreed,
        bofa: latestPanic.bofa,
        putCall: latestPanic.putCall,
        highYield: latestPanic.highYield,
        date: latestPanic.tradeDate ?? latestPanic.updatedAt ?? null,
      }
    }
    if (latestCycleRow) {
      const panic = panicDataFromCycleRow(latestCycleRow)
      if (panic) return { ...latestCycleRow, ...panic }
    }
    return null
  }, [latestCycleRow, latestPanic])

  const report = useMemo(
    () => buildPrecursorEnginePhase6Report(events, { latestSnapshot }),
    [events, latestSnapshot],
  )

  const { inputs, patternSimilarity, top3, radarAlert, interpretation, notes } = report
  const m = getPrecursorMetricDisplay

  return (
    <section
      className="panic-validation-panel yds-precursor-engine-p6"
      aria-labelledby="yds-precursor-engine-p6-title"
    >
      <h2 id="yds-precursor-engine-p6-title" className="panic-validation-panel__h2">
        {PRECURSOR_ENGINE_PHASE6_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        현재 시장 vs 역사적 5패턴 · 실시간 레이더 · 검증 전용
      </p>

      <div className="yds-precursor-engine-p6__radar-header">
        <div
          className={`yds-precursor-engine-p6__alert yds-precursor-engine-p6__alert--${radarAlert.id}`}
          aria-label="C. Radar Alert"
        >
          <span className="yds-precursor-engine-p6__alert-emoji">{radarAlert.emoji}</span>
          <span className="yds-precursor-engine-p6__alert-label">{radarAlert.label}</span>
        </div>
        <p className="m-0 yds-precursor-engine-p6__interpretation" aria-label="D. 현재 시장 해석">
          {interpretation}
        </p>
      </div>

      <article className="yds-precursor-engine-p6__block" aria-label="입력 지표">
        <p className="m-0 panic-validation-panel__h3">입력 (기준일 {inputs.asOf ?? "—"})</p>
        <div className="yds-precursor-engine-p6__inputs">
          {[
            ["cnn", inputs.cnn],
            ["highYield", inputs.highYield],
            ["move", inputs.move],
            ["bofa", inputs.bofa],
            ["vix", inputs.vix],
            ["putCall", inputs.putCall],
            ["priA", inputs.priA],
            ["priB", inputs.priB],
          ].map(([key, val]) => (
            <div key={key} className="yds-precursor-engine-p6__input-chip">
              <span className="yds-precursor-engine-p6__input-key">{RADAR_INPUT_LABELS[key]}</span>
              <span className="font-mono tabular-nums">
                {fmt(val, key === "priA" || key === "priB" ? 0 : 1)}
                {key === "move" && inputs.moveEstimated ? "*" : ""}
              </span>
            </div>
          ))}
        </div>
      </article>

      <article className="yds-precursor-engine-p6__block" aria-label={`A. ${m("pattern").label} 유사도`}>
        <p className="m-0 panic-validation-panel__h3">A. {m("pattern").label} 유사도</p>
        <ul className="yds-precursor-engine-p6__similarity-list">
          {patternSimilarity.map((row) => (
            <li key={row.patternId} className="yds-precursor-engine-p6__similarity-row">
              <span className="yds-precursor-engine-p6__pattern-name">
                <YdsRiskPatternLabel patternId={row.patternId} patternLabel={row.patternLabel} />
              </span>
              <div className="yds-precursor-engine-p6__bar-track">
                <div
                  className={`yds-precursor-engine-p6__bar-fill yds-precursor-engine-p6__bar-fill--${row.patternId}`}
                  style={{ width: `${row.similarity}%` }}
                />
              </div>
              <span className="font-mono tabular-nums yds-precursor-engine-p6__pct">
                {row.similarity}%
              </span>
            </li>
          ))}
        </ul>
      </article>

      <article className="yds-precursor-engine-p6__block" aria-label="B. Top 3 패턴">
        <p className="m-0 panic-validation-panel__h3">B. Top 3 패턴</p>
        <table className="panic-validation-year-table yds-precursor-engine-p6__top3-table">
          <thead>
            <tr>
              <th scope="col">순위</th>
              <th scope="col">패턴</th>
              <th scope="col">유사도</th>
            </tr>
          </thead>
          <tbody>
            {top3.map((row) => (
              <tr key={row.patternId} className={row.rank === 1 ? "yds-precursor-engine-p6__row-top" : ""}>
                <td className="font-mono tabular-nums">{row.rank}</td>
                <td>
                  <YdsRiskPatternLabel patternId={row.patternId} patternLabel={row.patternLabel} />
                </td>
                <td className="font-mono tabular-nums">{row.similarity}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <ul className="yds-engine-candidate__notes">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </section>
  )
}
