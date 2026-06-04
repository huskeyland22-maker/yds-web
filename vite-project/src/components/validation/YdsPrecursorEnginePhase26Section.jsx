import { useMemo } from "react"
import { panicDataFromCycleRow } from "../../utils/cycleHistoryUtils.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildPrecursorEnginePhase26Report,
  formatStockRadarScore,
  PRECURSOR_ENGINE_PHASE26_LABEL,
  STOCK_RADAR_MARKET_FILTERS,
  STOCK_RADAR_PIPELINE,
  STOCK_RADAR_SCORE_WEIGHTS,
} from "../../trading-zone/ydsPrecursorEnginePhase26.js"

/**
 * @param {{
 *   events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[]
 *   latestCycleRow?: Record<string, unknown> | null
 *   historyRows?: object[]
 * }} props
 */
export default function YdsPrecursorEnginePhase26Section({
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
      buildPrecursorEnginePhase26Report(events, {
        latestSnapshot,
        extraRows: historyRows,
      }),
    [events, latestSnapshot, historyRows],
  )

  const { available, asOf, scoreWeightsDisplay, topBuys, byMarket, inputs, exportForTradeCandidates, notes } =
    report

  return (
    <section
      className="panic-validation-panel yds-precursor-engine-p26"
      aria-labelledby="yds-precursor-engine-p26-title"
    >
      <h2 id="yds-precursor-engine-p26-title" className="panic-validation-panel__h2">
        {PRECURSOR_ENGINE_PHASE26_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        Sector Radar → 매수 후보 Top 10 · Phase 12·6·25 읽기 전용
      </p>
      <p className="yds-precursor-engine-p26__weights">{scoreWeightsDisplay}</p>

      {asOf ? (
        <p className="yds-precursor-engine-p26__asof">기준일 {String(asOf).slice(0, 10)}</p>
      ) : null}

      {!available ? (
        <p className="yds-precursor-engine-p26__empty">Sector Radar 또는 시장 데이터가 없어 산출할 수 없습니다.</p>
      ) : (
        <>
          <dl className="yds-precursor-engine-p26__inputs">
            <div>
              <dt>YDS</dt>
              <dd>{inputs.ydsDisplay}</dd>
            </div>
            <div>
              <dt>PRI-A / B</dt>
              <dd>
                {inputs.priADisplay} / {inputs.priBDisplay}
              </dd>
            </div>
            <div>
              <dt>국면</dt>
              <dd>{inputs.regimeLabel}</dd>
            </div>
            <div>
              <dt>충격감지</dt>
              <dd>{inputs.radarAlertLabel}</dd>
            </div>
            <div>
              <dt>패턴</dt>
              <dd>{inputs.dominantPattern ?? "—"}</dd>
            </div>
          </dl>

          <div className="yds-precursor-engine-p26__block">
            <h3 className="yds-precursor-engine-p26__h3">매수 후보 TOP 10</h3>
            <ol className="yds-precursor-engine-p26__rank-list">
              {topBuys.map((s) => (
                <li key={s.id}>
                  <span className="yds-precursor-engine-p26__rank">{s.rank}.</span>
                  <span className="yds-precursor-engine-p26__name">{s.name}</span>
                  <span className="yds-precursor-engine-p26__score">점수 {formatStockRadarScore(s.score)}</span>
                  <span className="yds-precursor-engine-p26__status">{s.status.display}</span>
                  <span className="yds-precursor-engine-p26__meta">
                    {s.marketLabel}
                    {s.tradingStage ? ` · ${s.tradingStage}` : ""}
                  </span>
                  <span className="yds-precursor-engine-p26__breakdown">
                    시장 {formatStockRadarScore(s.scoreBreakdown.marketFit)} · 섹터{" "}
                    {formatStockRadarScore(s.scoreBreakdown.sectorStrength)} · 추세{" "}
                    {formatStockRadarScore(s.scoreBreakdown.technicalTrend)} · 거래량{" "}
                    {formatStockRadarScore(s.scoreBreakdown.volume)}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="yds-precursor-engine-p26__block">
            <h3 className="yds-precursor-engine-p26__h3">필터</h3>
            <div className="yds-precursor-engine-p26__filters">
              <div>
                <span className="yds-precursor-engine-p26__filter-market">🇺🇸 미국</span>
                <span className="yds-precursor-engine-p26__filter-tags">
                  {STOCK_RADAR_MARKET_FILTERS.us.filters.map((f) => f.label).join(" · ")}
                </span>
              </div>
              <div>
                <span className="yds-precursor-engine-p26__filter-market">🇰🇷 한국</span>
                <span className="yds-precursor-engine-p26__filter-tags">
                  {STOCK_RADAR_MARKET_FILTERS.kr.filters.map((f) => f.label).join(" · ")}
                </span>
              </div>
            </div>
            <div className="yds-precursor-engine-p26__market-split">
              <article>
                <h4 className="yds-precursor-engine-p26__h4">미국 Top</h4>
                <ul>
                  {byMarket.us.slice(0, 5).map((s) => (
                    <li key={s.id}>
                      {s.name} · {formatStockRadarScore(s.score)} · {s.status.emoji}
                    </li>
                  ))}
                </ul>
              </article>
              <article>
                <h4 className="yds-precursor-engine-p26__h4">한국 Top</h4>
                <ul>
                  {byMarket.kr.slice(0, 5).map((s) => (
                    <li key={s.id}>
                      {s.name} · {formatStockRadarScore(s.score)} · {s.status.emoji}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </div>

          <div className="yds-precursor-engine-p26__block">
            <h3 className="yds-precursor-engine-p26__h3">향후 연결</h3>
            <ol className="yds-precursor-engine-p26__pipeline">
              {STOCK_RADAR_PIPELINE.map((step, i) => (
                <li key={step.id}>
                  <span>{step.label}</span>
                  <span
                    className={
                      step.status === "active"
                        ? "yds-precursor-engine-p26__pipe--active"
                        : "yds-precursor-engine-p26__pipe--planned"
                    }
                  >
                    {step.status === "active" ? "활성" : "예정"}
                  </span>
                  {i < STOCK_RADAR_PIPELINE.length - 1 ? (
                    <span className="yds-precursor-engine-p26__pipe-arrow" aria-hidden>
                      ↓
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
            <p className="yds-precursor-engine-p26__weight-note">
              가중치: 시장 {STOCK_RADAR_SCORE_WEIGHTS.marketFit * 100}% · 섹터{" "}
              {STOCK_RADAR_SCORE_WEIGHTS.sectorStrength * 100}% · 추세{" "}
              {STOCK_RADAR_SCORE_WEIGHTS.technicalTrend * 100}% · 거래량{" "}
              {STOCK_RADAR_SCORE_WEIGHTS.volume * 100}%
            </p>
            <pre className="yds-precursor-engine-p26__export-json">
              {JSON.stringify(exportForTradeCandidates, null, 2)}
            </pre>
          </div>
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
