import { useMemo } from "react"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildPrecursorEnginePhase8Report,
  PHASE8_GOALS,
  PRECURSOR_ENGINE_PHASE8_LABEL,
} from "../../trading-zone/ydsPrecursorEnginePhase8.js"

function DeltaBadge({ value, suffix = "", invert = false }) {
  if (value == null || !Number.isFinite(value)) return <span>—</span>
  const good = invert ? value < 0 : value > 0
  const sign = value > 0 ? "+" : ""
  return (
    <span className={good ? "yds-precursor-engine-p8__delta-up" : "yds-precursor-engine-p8__delta-down"}>
      {sign}
      {value}
      {suffix}
    </span>
  )
}

/**
 * @param {{ events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[] }} props
 */
export default function YdsPrecursorEnginePhase8Section({
  events = YDS_VALIDATION_EVENT_DATASET,
}) {
  const report = useMemo(() => buildPrecursorEnginePhase8Report(events), [events])
  const { phase7Baseline, phase8, delta, featureMix, notes } = report

  return (
    <section
      className="panic-validation-panel yds-precursor-engine-p8"
      aria-labelledby="yds-precursor-engine-p8-title"
    >
      <h2 id="yds-precursor-engine-p8-title" className="panic-validation-panel__h2">
        {PRECURSOR_ENGINE_PHASE8_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        Level + 30일 Slope 혼합 · Bull↔Lehman 혼동 제거 · 검증 전용
      </p>

      <article className="yds-precursor-engine-p8__block" aria-label="Phase 7 vs 8 비교">
        <p className="m-0 panic-validation-panel__h3">Phase 7 → Phase 8 재측정</p>
        <table className="panic-validation-year-table yds-precursor-engine-p8__compare-table">
          <thead>
            <tr>
              <th scope="col">지표</th>
              <th scope="col">Phase 7</th>
              <th scope="col">Phase 8</th>
              <th scope="col">Δ</th>
              <th scope="col">목표</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Top-1 Accuracy</td>
              <td className="font-mono tabular-nums">{phase7Baseline.top1Accuracy}%</td>
              <td className="font-mono tabular-nums">{phase8.top1Accuracy}%</td>
              <td className="font-mono tabular-nums">
                <DeltaBadge value={delta.top1Accuracy} suffix="pp" />
              </td>
              <td>≥{PHASE8_GOALS.top1Min}%</td>
            </tr>
            <tr>
              <td>Top-3 Accuracy</td>
              <td className="font-mono tabular-nums">{phase7Baseline.top3Accuracy}%</td>
              <td className="font-mono tabular-nums">{phase8.top3Accuracy}%</td>
              <td className="font-mono tabular-nums">
                <DeltaBadge value={delta.top3Accuracy} suffix="pp" />
              </td>
              <td>—</td>
            </tr>
            <tr>
              <td>Avg Margin</td>
              <td className="font-mono tabular-nums">{phase7Baseline.avgMargin}pp</td>
              <td className="font-mono tabular-nums">{phase8.avgMargin}pp</td>
              <td className="font-mono tabular-nums">
                <DeltaBadge value={delta.avgMargin} suffix="pp" />
              </td>
              <td>—</td>
            </tr>
            <tr>
              <td>분리도</td>
              <td className="font-mono tabular-nums">{phase7Baseline.separationScore}</td>
              <td className="font-mono tabular-nums">{phase8.separationScore}</td>
              <td className="font-mono tabular-nums">
                <DeltaBadge value={delta.separationScore} />
              </td>
              <td>≥{PHASE8_GOALS.separationMin}</td>
            </tr>
            <tr className="yds-precursor-engine-p8__row-focus">
              <td>Bull ↔ Lehman</td>
              <td className="font-mono tabular-nums">{phase7Baseline.bullLehmanCount}건</td>
              <td className="font-mono tabular-nums">{phase8.bullLehmanCount}건</td>
              <td className="font-mono tabular-nums">
                <DeltaBadge value={delta.bullLehmanCount} suffix="건" invert />
              </td>
              <td>≤{PHASE8_GOALS.bullLehmanMax}건</td>
            </tr>
          </tbody>
        </table>
      </article>

      <article className="yds-precursor-engine-p8__block" aria-label="Slope Feature">
        <p className="m-0 panic-validation-panel__h3">추가 Slope Feature (T-{featureMix.slopeDays})</p>
        <p className="m-0 yds-event-detail__hint">
          유사도 = Level {featureMix.levelWeight * 100}% + Slope {featureMix.slopeWeight * 100}%
        </p>
        <ul className="yds-precursor-engine-p8__slope-list">
          {featureMix.slopeMetrics.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      </article>

      <article
        className={`yds-precursor-engine-p8__verdict yds-precursor-engine-p8__verdict--${phase8.verdict.id}`}
      >
        <p className="m-0 yds-precursor-engine-p8__verdict-title">
          {phase8.verdict.emoji} {phase8.verdict.label}
        </p>
        <ul className="yds-precursor-engine-p8__goal-checks">
          {phase8.verdict.checks.map((c) => (
            <li key={c.id} className={c.pass ? "yds-precursor-engine-p8__check-pass" : ""}>
              {c.pass ? "✓" : "✗"} {c.label} — {c.value}
            </li>
          ))}
        </ul>
      </article>

      {phase8.topConfusedPair ? (
        <p className="m-0 yds-event-detail__hint">
          Phase 8 최다 혼동: {phase8.topConfusedPair.pair} ({phase8.topConfusedPair.count}건)
          {phase7Baseline.topConfusedPair
            ? ` · Phase 7: ${phase7Baseline.topConfusedPair.pair} (${phase7Baseline.topConfusedPair.count}건)`
            : ""}
        </p>
      ) : null}

      <ul className="yds-engine-candidate__notes">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </section>
  )
}
