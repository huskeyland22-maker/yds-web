import { useMemo } from "react"
import { Link } from "react-router-dom"
import { useAppDataStore } from "../store/appDataStore.js"
import { panicDataFromCycleRow, mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../trading-zone/ydsHistoricalValidationEvents.js"
import { buildPrecursorDashboardBetaReport } from "../trading-zone/ydsPrecursorEnginePhase12.js"

/**
 * @param {number | null} value
 * @param {number} [warnAt]
 */
function metricToneClass(value, warnAt = 50) {
  if (value == null || !Number.isFinite(value)) return ""
  if (value >= warnAt + 20) return "yds-precursor-dashboard__metric-val--high"
  if (value >= warnAt) return "yds-precursor-dashboard__metric-val--mid"
  return "yds-precursor-dashboard__metric-val--low"
}

export default function PrecursorDashboardBetaPage() {
  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)
  const history = useMemo(
    () => resolveCycleHistoryRows(mergeCycleRows(storeRows ?? [], [])),
    [storeRows],
  )
  const latestCycleRow = history[history.length - 1] ?? null

  const latestSnapshot = useMemo(() => {
    if (!latestCycleRow) return null
    const panic = panicDataFromCycleRow(latestCycleRow)
    if (panic) return { ...latestCycleRow, ...panic, date: latestCycleRow.date ?? panic.updatedAt }
    return latestCycleRow
  }, [latestCycleRow])

  const report = useMemo(
    () =>
      buildPrecursorDashboardBetaReport(YDS_VALIDATION_EVENT_DATASET, {
        latestSnapshot,
        extraRows: history,
      }),
    [latestSnapshot, history],
  )

  const { cards, asOf, meta, notes } = report
  const regime = cards.regime

  return (
    <div className="yds-precursor-dashboard">
      <header className="yds-precursor-dashboard__header">
        <div>
          <p className="yds-precursor-dashboard__badge">Beta</p>
          <h1 className="yds-precursor-dashboard__title">시장 대시보드</h1>
          <p className="yds-precursor-dashboard__sub">
            5초 스캔 · {asOf ? `기준 ${String(asOf).slice(0, 10)}` : "데이터 준비 중"}
          </p>
        </div>
        <Link to="/panic-validation" className="yds-precursor-dashboard__link">
          검증 상세
        </Link>
      </header>

      <section
        className={`yds-precursor-dashboard__hero yds-precursor-dashboard__hero--${regime.regimeId}`}
        aria-label="현재 국면"
      >
        <span className="yds-precursor-dashboard__hero-emoji" aria-hidden>
          {regime.emoji}
        </span>
        <div className="yds-precursor-dashboard__hero-body">
          <p className="m-0 yds-precursor-dashboard__hero-label">{regime.label}</p>
          <p className="m-0 yds-precursor-dashboard__hero-duration">{regime.durationLabel}</p>
        </div>
      </section>

      <div className="yds-precursor-dashboard__grid" aria-label="핵심 지표">
        <article className="yds-precursor-dashboard__card yds-precursor-dashboard__card--yds">
          <p className="yds-precursor-dashboard__card-label">{cards.yds.title}</p>
          <p
            className={[
              "yds-precursor-dashboard__metric-val font-mono tabular-nums",
              metricToneClass(cards.yds.value, 55),
            ].join(" ")}
          >
            {cards.yds.display}
          </p>
          <p className="yds-precursor-dashboard__card-sub">{cards.yds.sub}</p>
        </article>
        <article className="yds-precursor-dashboard__card">
          <p className="yds-precursor-dashboard__card-label">{cards.priA.title}</p>
          <p
            className={[
              "yds-precursor-dashboard__metric-val font-mono tabular-nums",
              metricToneClass(cards.priA.value, 30),
            ].join(" ")}
          >
            {cards.priA.display}
          </p>
          <p className="yds-precursor-dashboard__card-sub">{cards.priA.sub}</p>
        </article>
        <article className="yds-precursor-dashboard__card">
          <p className="yds-precursor-dashboard__card-label">{cards.priB.title}</p>
          <p
            className={[
              "yds-precursor-dashboard__metric-val font-mono tabular-nums",
              metricToneClass(cards.priB.value, 30),
            ].join(" ")}
          >
            {cards.priB.display}
          </p>
          <p className="yds-precursor-dashboard__card-sub">{cards.priB.sub}</p>
        </article>
        <article className="yds-precursor-dashboard__card yds-precursor-dashboard__card--pattern">
          <p className="yds-precursor-dashboard__card-label">{cards.pattern.title}</p>
          <p className="yds-precursor-dashboard__pattern-name">{cards.pattern.label}</p>
          <p className="yds-precursor-dashboard__metric-val font-mono tabular-nums">
            {cards.pattern.similarity != null ? `${Math.round(cards.pattern.similarity)}%` : "—"}
            <span className="yds-precursor-dashboard__card-sub-inline"> 유사</span>
          </p>
        </article>
      </div>

      <article className="yds-precursor-dashboard__interpret" aria-label="시장 해석">
        <div className="yds-precursor-dashboard__interpret-head">
          <p className="m-0 yds-precursor-dashboard__card-label">{cards.interpretation.title}</p>
          {cards.interpretation.radarAlert ? (
            <span
              className={`yds-precursor-dashboard__alert yds-precursor-dashboard__alert--${cards.interpretation.radarAlert.id}`}
            >
              {cards.interpretation.radarAlert.emoji} {cards.interpretation.radarAlert.label}
            </span>
          ) : null}
        </div>
        <p className="m-0 yds-precursor-dashboard__interpret-text">{cards.interpretation.text}</p>
      </article>

      <p className="yds-precursor-dashboard__meta">
        {meta.dataSource} · {meta.historyPoints}시점
        {latestCycleRow ? "" : " · 사이클 히스토리 없음 — 입력·동기화 후 갱신"}
      </p>

      <ul className="yds-precursor-dashboard__notes">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  )
}
