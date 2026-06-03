import { useMemo } from "react"
import { panicDataFromCycleRow } from "../../utils/cycleHistoryUtils.js"
import { formatMetric } from "../../trading-zone/ydsHistoricalEventTypes.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildPrecursorEnginePhase10Report,
  PRECURSOR_ENGINE_PHASE10_LABEL,
  REGIME_STATES,
  REGIME_SEQUENCE_LABEL_KO,
} from "../../trading-zone/ydsPrecursorEnginePhase10.js"

function fmt(v, d = 0) {
  if (v == null || !Number.isFinite(v)) return "—"
  return formatMetric(v, d)
}

function DeltaCell({ value }) {
  if (value == null || !Number.isFinite(value)) return <span>—</span>
  const cls =
    value > 0
      ? "yds-precursor-engine-p10__delta-up"
      : value < 0
        ? "yds-precursor-engine-p10__delta-down"
        : ""
  const sign = value > 0 ? "+" : ""
  return (
    <span className={cls}>
      {sign}
      {value}
    </span>
  )
}

/**
 * @param {{
 *   events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[]
 *   latestCycleRow?: Record<string, unknown> | null
 *   latestPanic?: Record<string, unknown> | null
 * }} props
 */
export default function YdsPrecursorEnginePhase10Section({
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
    () => buildPrecursorEnginePhase10Report(events, { latestSnapshot }),
    [events, latestSnapshot],
  )

  const { live, deltas30Display, replays, replaySummary, notes } = report
  const regime = live.regime

  return (
    <section
      className="panic-validation-panel yds-precursor-engine-p10"
      aria-labelledby="yds-precursor-engine-p10-title"
    >
      <h2 id="yds-precursor-engine-p10-title" className="panic-validation-panel__h2">
        {PRECURSOR_ENGINE_PHASE10_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        30일 변화율 기반 체제 변화 탐지 · 리먼/코로나/관세 Replay 검증 · 검증 전용
      </p>

      <article
        className={`yds-precursor-engine-p10__regime yds-precursor-engine-p10__regime--${regime.id}`}
        aria-label="현재 체제"
      >
        <span className="yds-precursor-engine-p10__regime-emoji">{regime.emoji}</span>
        <div>
          <p className="m-0 yds-precursor-engine-p10__regime-label">{regime.label}</p>
          <p className="m-0 yds-precursor-engine-p10__regime-reason">{regime.reason}</p>
          {live.current ? (
            <p className="m-0 yds-precursor-engine-p10__regime-metrics font-mono tabular-nums">
              YDS {fmt(live.current.ydsScore)} · PRI-A {fmt(live.current.priA)} · PRI-B{" "}
              {fmt(live.current.priB)}
              {live.past ? ` · 30일 전 ${live.past.date}` : ""}
            </p>
          ) : null}
        </div>
      </article>

      <article className="yds-precursor-engine-p10__block" aria-label="30일 변화율 입력">
        <p className="m-0 panic-validation-panel__h3">30일 변화율 (판정 우선)</p>
        <table className="panic-validation-year-table yds-precursor-engine-p10__delta-table">
          <thead>
            <tr>
              <th scope="col">지표</th>
              <th scope="col">30일 Δ</th>
              <th scope="col">현재</th>
              <th scope="col">30일 전</th>
            </tr>
          </thead>
          <tbody>
            {deltas30Display.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                <td className="font-mono tabular-nums">
                  <DeltaCell value={row.value} />
                </td>
                <td className="font-mono tabular-nums">
                  {fmt(live.current?.[row.key])}
                </td>
                <td className="font-mono tabular-nums">{fmt(live.past?.[row.key])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article className="yds-precursor-engine-p10__block" aria-label="Replay 검증">
        <div className="yds-precursor-engine-p10__replay-head">
          <p className="m-0 panic-validation-panel__h3">Replay 검증</p>
          <span
            className={
              replaySummary.allPassed
                ? "yds-precursor-engine-p10__replay-badge yds-precursor-engine-p10__replay-badge--pass"
                : "yds-precursor-engine-p10__replay-badge"
            }
          >
            {replaySummary.passed}/{replaySummary.total} 통과
          </span>
        </div>
        <p className="panic-validation-panel__note m-0">
          {REGIME_SEQUENCE_LABEL_KO} 단조 진행 검증
        </p>

        {replays.map((replay) => (
          <div key={replay.id} className="yds-precursor-engine-p10__replay-card">
            <div className="yds-precursor-engine-p10__replay-title-row">
              <p className="m-0 yds-precursor-engine-p10__replay-title">{replay.label}</p>
              <span
                className={
                  replay.validation?.passed
                    ? "yds-precursor-engine-p10__replay-status yds-precursor-engine-p10__replay-status--pass"
                    : "yds-precursor-engine-p10__replay-status"
                }
              >
                {replay.validation?.passed ? "PASS" : "FAIL"}
              </span>
            </div>
            {replay.found ? (
              <>
                <p className="m-0 yds-precursor-engine-p10__replay-seq">
                  {replay.validation.sequenceSummary || "—"}
                </p>
                <p className="m-0 yds-precursor-engine-p10__replay-meta">
                  {replay.eventName} · 단조 {replay.validation.monotonic ? "✓" : "✗"} · 경계{" "}
                  {replay.validation.reachedRisk ? "✓" : "✗"} · 위기{" "}
                  {replay.validation.reachedPanic ? "✓" : "✗"}
                  {replay.validation.backwardSteps > 0
                    ? ` · 역행 ${replay.validation.backwardSteps}회`
                    : ""}
                </p>
                <table className="panic-validation-year-table yds-precursor-engine-p10__replay-table">
                  <thead>
                    <tr>
                      <th scope="col">시점</th>
                      <th scope="col">체제</th>
                      <th scope="col">PRI-A</th>
                      <th scope="col">패닉유사 Δ30</th>
                      <th scope="col">YDS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {replay.timeline.map((step) => (
                      <tr key={step.offsetLabel}>
                        <td className="font-mono tabular-nums">{step.offsetLabel}</td>
                        <td>
                          <span title={step.regime.reason}>
                            {step.regime.emoji} {step.regime.label}
                          </span>
                        </td>
                        <td className="font-mono tabular-nums">{fmt(step.priA)}</td>
                        <td className="font-mono tabular-nums">
                          <DeltaCell value={step.deltas30?.panicSimilarityAvg} />
                        </td>
                        <td className="font-mono tabular-nums">{fmt(step.ydsScore)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <p className="m-0 text-slate-500">이벤트 데이터 없음</p>
            )}
          </div>
        ))}
      </article>

      <article className="yds-precursor-engine-p10__block" aria-label="체제 정의">
        <p className="m-0 panic-validation-panel__h3">체제 정의 (30일 Δ 우선)</p>
        <ul className="yds-precursor-engine-p10__regime-legend">
          {REGIME_STATES.map((s) => (
            <li key={s.id} className="yds-precursor-engine-p10__regime-legend-item">
              <span className="yds-precursor-engine-p10__regime-legend-head">
                {s.emoji} <strong>{s.label}</strong>
              </span>
              {s.hints?.length ? (
                <ul className="yds-precursor-engine-p10__regime-hints">
                  {s.hints.map((hint) => (
                    <li key={hint}>{hint}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </article>

      <ul className="panic-validation-panel__notes">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </section>
  )
}
