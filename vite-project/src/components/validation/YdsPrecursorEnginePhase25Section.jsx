import { useMemo } from "react"
import { panicDataFromCycleRow } from "../../utils/cycleHistoryUtils.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildPrecursorEnginePhase25Report,
  formatSectorRadarScore,
  PRECURSOR_ENGINE_PHASE25_LABEL,
  SECTOR_RADAR_PIPELINE,
} from "../../trading-zone/ydsPrecursorEnginePhase25.js"

/**
 * @param {{
 *   events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[]
 *   latestCycleRow?: Record<string, unknown> | null
 *   historyRows?: object[]
 * }} props
 */
export default function YdsPrecursorEnginePhase25Section({
  events = YDS_VALIDATION_EVENT_DATASET,
  latestCycleRow = null,
  historyRows = [],
}) {
  const latestSnapshot = useMemo(() => {
    if (!latestCycleRow) return null
    const panic = panicDataFromCycleRow(latestCycleRow)
    if (panic) return { ...latestCycleRow, ...panic, date: latestCycleRow.date ?? panic.updatedAt }
    return latestCycleRow
  }, [latestCycleRow])

  const report = useMemo(
    () =>
      buildPrecursorEnginePhase25Report(events, {
        latestSnapshot,
        extraRows: historyRows,
      }),
    [events, latestSnapshot, historyRows],
  )

  const {
    available,
    asOf,
    currentMarket,
    stagePolicy,
    topSectors,
    sectorStatus,
    stagePolicyTable,
    inputs,
    exportForStockRadar,
    notes,
  } = report

  return (
    <section
      className="panic-validation-panel yds-precursor-engine-p25"
      aria-labelledby="yds-precursor-engine-p25-title"
    >
      <h2 id="yds-precursor-engine-p25-title" className="panic-validation-panel__h2">
        {PRECURSOR_ENGINE_PHASE25_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        YDS 단계·국면·패턴·섹터 로테이션 읽기 전용 · Phase 12·6·10 집약
      </p>

      {asOf ? (
        <p className="yds-precursor-engine-p25__asof">기준일 {String(asOf).slice(0, 10)}</p>
      ) : null}

      {!available ? (
        <p className="yds-precursor-engine-p25__empty">YDS 점수가 없어 추천 섹터를 산출할 수 없습니다.</p>
      ) : (
        <>
          <div className="yds-precursor-engine-p25__market-row">
            <span className="yds-precursor-engine-p25__market-key">현재 시장</span>
            <strong className="yds-precursor-engine-p25__market-val">{currentMarket.display}</strong>
          </div>

          {stagePolicy ? (
            <p className="yds-precursor-engine-p25__policy-hint">{stagePolicy.display}</p>
          ) : null}

          <div className="yds-precursor-engine-p25__block">
            <h3 className="yds-precursor-engine-p25__h3">추천 섹터 Top 5</h3>
            <ol className="yds-precursor-engine-p25__rank-list">
              {topSectors.map((s) => (
                <li key={s.id}>
                  <span className="yds-precursor-engine-p25__rank">{s.rank}위</span>
                  <span className="yds-precursor-engine-p25__sector-label">{s.label}</span>
                  <span className="yds-precursor-engine-p25__score">
                    점수 {formatSectorRadarScore(s.score)}
                  </span>
                  {s.reasons.length ? (
                    <span className="yds-precursor-engine-p25__reasons">{s.reasons.join(" · ")}</span>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>

          <div className="yds-precursor-engine-p25__block">
            <h3 className="yds-precursor-engine-p25__h3">섹터 상태</h3>
            <div className="yds-precursor-engine-p25__status-grid">
              <article className="yds-precursor-engine-p25__status-card yds-precursor-engine-p25__status-card--strong">
                <span className="yds-precursor-engine-p25__status-head">
                  {sectorStatus.strong.emoji} {sectorStatus.strong.title}
                </span>
                <p className="yds-precursor-engine-p25__status-labels">
                  {sectorStatus.strong.labels.join(" · ") || "—"}
                </p>
              </article>
              <article className="yds-precursor-engine-p25__status-card yds-precursor-engine-p25__status-card--weak">
                <span className="yds-precursor-engine-p25__status-head">
                  {sectorStatus.weak.emoji} {sectorStatus.weak.title}
                </span>
                <p className="yds-precursor-engine-p25__status-labels">
                  {sectorStatus.weak.labels.join(" · ") || "—"}
                </p>
              </article>
            </div>
          </div>

          <div className="yds-precursor-engine-p25__block">
            <h3 className="yds-precursor-engine-p25__h3">시장 단계별 가중치</h3>
            <ul className="yds-precursor-engine-p25__stage-table">
              {stagePolicyTable.map((row) => (
                <li
                  key={row.stageId}
                  className={row.active ? "yds-precursor-engine-p25__stage-row--active" : ""}
                >
                  <span>
                    {row.emoji} {row.shortLabel}
                  </span>
                  <span>{row.hint}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="yds-precursor-engine-p25__block">
            <h3 className="yds-precursor-engine-p25__h3">향후 연결</h3>
            <ol className="yds-precursor-engine-p25__pipeline">
              {SECTOR_RADAR_PIPELINE.map((step, i) => (
                <li key={step.id}>
                  <span className="yds-precursor-engine-p25__pipe-label">{step.label}</span>
                  <span
                    className={[
                      "yds-precursor-engine-p25__pipe-status",
                      step.status === "active"
                        ? "yds-precursor-engine-p25__pipe-status--active"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {step.status === "active" ? "활성" : "예정"}
                  </span>
                  {i < SECTOR_RADAR_PIPELINE.length - 1 ? (
                    <span className="yds-precursor-engine-p25__pipe-arrow" aria-hidden>
                      ↓
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
            <pre className="yds-precursor-engine-p25__export-json">
              {JSON.stringify(exportForStockRadar, null, 2)}
            </pre>
          </div>

          <dl className="yds-precursor-engine-p25__inputs">
            <div>
              <dt>YDS</dt>
              <dd>{inputs.ydsScore ?? "—"}</dd>
            </div>
            <div>
              <dt>국면</dt>
              <dd>{inputs.regimeLabel ?? "—"}</dd>
            </div>
            <div>
              <dt>로테이션</dt>
              <dd>{inputs.rotationReady ? "반영" : "미반영"}</dd>
            </div>
            <div>
              <dt>우세 패턴</dt>
              <dd>{inputs.dominantPattern ?? "—"}</dd>
            </div>
          </dl>
        </>
      )}

      <ul className="panic-validation-panel__footnotes">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </section>
  )
}
