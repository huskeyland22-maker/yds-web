import { useMemo } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { panicDataFromCycleRow } from "../../utils/cycleHistoryUtils.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildPrecursorEnginePhase22Report,
  formatComparisonPct,
  PRECURSOR_ENGINE_PHASE22_LABEL,
} from "../../trading-zone/ydsPrecursorEnginePhase22.js"

const DNA_COLORS = {
  tariff: "#f97316",
  lehman: "#ef4444",
  svb: "#a855f7",
  covid: "#3b82f6",
}

/**
 * @param {{
 *   events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[]
 *   latestCycleRow?: Record<string, unknown> | null
 * }} props
 */
export default function YdsPrecursorEnginePhase22Section({
  events = YDS_VALIDATION_EVENT_DATASET,
  latestCycleRow = null,
}) {
  const latestSnapshot = useMemo(() => {
    if (!latestCycleRow) return null
    const panic = panicDataFromCycleRow(latestCycleRow)
    if (panic) return { ...latestCycleRow, ...panic, date: latestCycleRow.date ?? panic.updatedAt }
    return latestCycleRow
  }, [latestCycleRow])

  const report = useMemo(
    () => buildPrecursorEnginePhase22Report(events, { latestSnapshot }),
    [events, latestSnapshot],
  )

  const {
    meta,
    liveState,
    topSimilarEvents,
    currentPosition,
    historicalOutcomes,
    marketDna,
    notes,
  } = report

  const dnaChartData = marketDna.map((d) => ({
    name: d.label,
    similarity: d.similarity,
    patternId: d.patternId,
  }))

  return (
    <section
      className="panic-validation-panel yds-precursor-engine-p22"
      aria-labelledby="yds-precursor-engine-p22-title"
    >
      <h2 id="yds-precursor-engine-p22-title" className="panic-validation-panel__h2">
        {PRECURSOR_ENGINE_PHASE22_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        현재 시장 vs 8대 위기 이벤트 · T-28~T-0 위치 매핑 · Phase 2·6·20 읽기 전용
      </p>

      {!meta.hasLive ? (
        <p className="yds-precursor-engine-p22__empty">
          실시간 cycle 히스토리가 없습니다. 패닉 허브 동기화 후 비교가 가능합니다.
        </p>
      ) : (
        <p className="yds-precursor-engine-p22__asof">
          기준일 {liveState.asOf ?? "—"} · YDS {liveState.ydsScore ?? "—"} · PRI-A{" "}
          {liveState.priA ?? "—"} · PRI-B {liveState.priB ?? "—"}
        </p>
      )}

      <div className="yds-precursor-engine-p22__block">
        <h3 className="yds-precursor-engine-p22__h3">1. Top Similar Events</h3>
        <ol className="yds-precursor-engine-p22__top-list">
          {topSimilarEvents.map((ev) => (
            <li key={ev.eventId}>
              <span className="yds-precursor-engine-p22__medal" aria-hidden>
                {ev.medal}
              </span>
              <span className="yds-precursor-engine-p22__top-label">
                {ev.emoji} {ev.shortLabel}
              </span>
              <span className="yds-precursor-engine-p22__top-sim">{formatComparisonPct(ev.similarity)}</span>
              <span className="yds-precursor-engine-p22__top-sub">
                {ev.mappedOffsetLabel} 구간 최적 매칭
              </span>
            </li>
          ))}
        </ol>
      </div>

      {currentPosition ? (
        <div className="yds-precursor-engine-p22__block">
          <h3 className="yds-precursor-engine-p22__h3">2. Current Position Mapping</h3>
          <div className="yds-precursor-engine-p22__position-card">
            <div className="yds-precursor-engine-p22__position-main">
              <span className="yds-precursor-engine-p22__position-label">Current Position</span>
              <strong>{currentPosition.offsetLabel}</strong>
              <span>Similarity {formatComparisonPct(currentPosition.similarity)}</span>
              <span className="yds-precursor-engine-p22__position-event">
                {currentPosition.eventEmoji} {currentPosition.eventLabel} 타임라인
              </span>
            </div>
            <div className="yds-precursor-engine-p22__timeline" role="list" aria-label="T-offset timeline">
              {currentPosition.timeline.map((step) => (
                <span
                  key={step.offsetDays}
                  role="listitem"
                  className={[
                    "yds-precursor-engine-p22__timeline-step",
                    step.active ? "yds-precursor-engine-p22__timeline-step--active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {step.offsetLabel}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="yds-precursor-engine-p22__block">
        <h3 className="yds-precursor-engine-p22__h3">3. Historical Outcome Panel</h3>
        <p className="yds-precursor-engine-p22__sub">
          Top 3 유사 이벤트 · 해당 T-offset 이후 역사적 S&P500 성과 추정
        </p>
        <div className="yds-precursor-engine-p22__outcome-grid">
          {historicalOutcomes.map((h) => (
            <div key={h.horizon} className="yds-precursor-engine-p22__outcome-card">
              <span className="yds-precursor-engine-p22__outcome-horizon">{h.label}</span>
              <div className="yds-precursor-engine-p22__outcome-row">
                <span>평균 수익률</span>
                <strong>{formatComparisonPct(h.avgReturn)}</strong>
              </div>
              <div className="yds-precursor-engine-p22__outcome-row">
                <span>승률</span>
                <strong>{formatComparisonPct(h.winRate)}</strong>
              </div>
              <div className="yds-precursor-engine-p22__outcome-row">
                <span>최대 MDD</span>
                <strong>{formatComparisonPct(h.maxMdd)}</strong>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="yds-precursor-engine-p22__block">
        <h3 className="yds-precursor-engine-p22__h3">4. Market DNA Chart</h3>
        <div className="yds-precursor-engine-p22__dna-chart">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dnaChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 10 }} unit="%" />
              <Tooltip
                formatter={(v) => [`${v}%`, "유사도"]}
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid rgba(148,163,184,0.25)",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="similarity" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {dnaChartData.map((entry) => (
                  <Cell key={entry.patternId} fill={DNA_COLORS[entry.patternId] ?? "#64748b"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ul className="yds-precursor-engine-p22__dna-bars">
          {marketDna.map((d) => (
            <li key={d.patternId} className="yds-precursor-engine-p22__dna-row">
              <span>{d.label}</span>
              <div className="yds-precursor-engine-p22__dna-track">
                <div
                  className="yds-precursor-engine-p22__dna-fill"
                  style={{
                    width: `${Math.min(100, d.similarity)}%`,
                    background: DNA_COLORS[d.patternId] ?? "#64748b",
                  }}
                />
              </div>
              <span>{formatComparisonPct(d.similarity)}</span>
            </li>
          ))}
        </ul>
      </div>

      <ul className="panic-validation-panel__notes">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </section>
  )
}
