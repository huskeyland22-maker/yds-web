import { useMemo, useState } from "react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { panicDataFromCycleRow } from "../../utils/cycleHistoryUtils.js"
import { formatMetric } from "../../trading-zone/ydsHistoricalEventTypes.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildPrecursorEnginePhase9Report,
  HISTORY_WINDOWS,
  PATTERN_HISTORY_KEYS,
  PRECURSOR_ENGINE_PHASE9_LABEL,
} from "../../trading-zone/ydsPrecursorEnginePhase9.js"

function fmt(v, d = 0) {
  if (v == null || !Number.isFinite(v)) return "—"
  return formatMetric(v, d)
}

function shortDate(iso) {
  if (!iso) return ""
  const s = String(iso).slice(0, 10)
  return s.length >= 10 ? s.slice(5) : s
}

function DeltaCell({ value }) {
  if (value == null || !Number.isFinite(value)) return <span>—</span>
  const cls =
    value > 0
      ? "yds-precursor-engine-p9__delta-up"
      : value < 0
        ? "yds-precursor-engine-p9__delta-down"
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
export default function YdsPrecursorEnginePhase9Section({
  events = YDS_VALIDATION_EVENT_DATASET,
  latestCycleRow = null,
  latestPanic = null,
}) {
  const [windowDays, setWindowDays] = useState(90)

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
    () => buildPrecursorEnginePhase9Report(events, { latestSnapshot }),
    [events, latestSnapshot],
  )

  const chartData = useMemo(() => {
    const rows = report.windows[windowDays] ?? []
    return rows.map((r) => ({
      ...r,
      label: shortDate(r.date),
    }))
  }, [report.windows, windowDays])

  const { summary, regime, patternRotation, similarityTrends, storeMeta, notes } = report

  return (
    <section
      className="panic-validation-panel yds-precursor-engine-p9"
      aria-labelledby="yds-precursor-engine-p9-title"
    >
      <h2 id="yds-precursor-engine-p9-title" className="panic-validation-panel__h2">
        {PRECURSOR_ENGINE_PHASE9_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        Phase 6 스냅샷 → 시계열 · 패턴 유사도·PRI 추적 · 체제 판정 · 검증 전용
      </p>

      {summary ? (
        <article className="yds-precursor-engine-p9__summary" aria-label="Summary Card">
          <div className="yds-precursor-engine-p9__summary-grid">
            <div className="yds-precursor-engine-p9__summary-card">
              <p className="yds-precursor-engine-p9__summary-label">우세 패턴</p>
              <p className="yds-precursor-engine-p9__summary-value">
                {summary.dominantPattern}{" "}
                <span className="font-mono tabular-nums">{fmt(summary.dominantSimilarity)}%</span>
              </p>
            </div>
            <div className="yds-precursor-engine-p9__summary-card">
              <p className="yds-precursor-engine-p9__summary-label">2위 패턴</p>
              <p className="yds-precursor-engine-p9__summary-value">
                {summary.secondPattern}{" "}
                <span className="font-mono tabular-nums">{fmt(summary.secondSimilarity)}%</span>
              </p>
            </div>
            <div className="yds-precursor-engine-p9__summary-card">
              <p className="yds-precursor-engine-p9__summary-label">PRI-A / B (현재)</p>
              <p className="yds-precursor-engine-p9__summary-value font-mono tabular-nums">
                {fmt(summary.priA)} / {fmt(summary.priB)}
              </p>
              <p className="yds-precursor-engine-p9__summary-sub">
                30일 PRI-A Δ {summary.priAChange30d}
              </p>
            </div>
            <div className="yds-precursor-engine-p9__summary-card">
              <p className="yds-precursor-engine-p9__summary-label">체제 변화</p>
              <p className="yds-precursor-engine-p9__summary-value">
                {summary.regimeChanged ? "있음" : "없음"}
              </p>
              <p className="yds-precursor-engine-p9__summary-sub">{summary.topRotation}</p>
            </div>
          </div>
          <p className="m-0 yds-precursor-engine-p9__as-of">기준일 {summary.asOf ?? "—"}</p>
        </article>
      ) : null}

      <article
        className={`yds-precursor-engine-p9__regime yds-precursor-engine-p9__regime--${regime.id}`}
        aria-label="Regime Tracker"
      >
        <span className="yds-precursor-engine-p9__regime-emoji">{regime.emoji}</span>
        <div>
          <p className="m-0 yds-precursor-engine-p9__regime-label">{regime.label}</p>
          <p className="m-0 yds-precursor-engine-p9__regime-reason">{regime.reason}</p>
        </div>
      </article>

      <article className="yds-precursor-engine-p9__block" aria-label="Pattern History">
        <div className="yds-precursor-engine-p9__block-head">
          <p className="m-0 panic-validation-panel__h3">Pattern History</p>
          <div className="yds-precursor-engine-p9__window-tabs" role="tablist">
            {HISTORY_WINDOWS.map((w) => (
              <button
                key={w.id}
                type="button"
                role="tab"
                aria-selected={windowDays === w.id}
                className={
                  windowDays === w.id
                    ? "yds-precursor-engine-p9__window-tab yds-precursor-engine-p9__window-tab--active"
                    : "yds-precursor-engine-p9__window-tab"
                }
                onClick={() => setWindowDays(w.id)}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
        <p className="panic-validation-panel__note m-0">
          {storeMeta.windowPoints}개 시점 · 전체 {storeMeta.historyPoints}점
        </p>
        <div className="yds-precursor-engine-p9__chart">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(148,163,184,0.16)" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fill: "rgba(148,163,184,0.9)", fontSize: 10 }} />
              <YAxis
                yAxisId="sim"
                domain={[0, 100]}
                tick={{ fill: "rgba(148,163,184,0.9)", fontSize: 10 }}
                width={36}
              />
              <YAxis
                yAxisId="pri"
                orientation="right"
                domain={[0, 100]}
                tick={{ fill: "rgba(148,163,184,0.7)", fontSize: 10 }}
                width={36}
              />
              <Tooltip
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.date ? `일자 ${payload[0].payload.date}` : ""
                }
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {PATTERN_HISTORY_KEYS.map(({ key, label, color }) => (
                <Line
                  key={key}
                  yAxisId="sim"
                  type="monotone"
                  dataKey={key}
                  name={label}
                  stroke={color}
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                />
              ))}
              <Line
                yAxisId="pri"
                type="monotone"
                dataKey="priA"
                name="PRI-A"
                stroke="#38bdf8"
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={false}
                connectNulls
              />
              <Line
                yAxisId="pri"
                type="monotone"
                dataKey="priB"
                name="PRI-B"
                stroke="#a78bfa"
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="yds-precursor-engine-p9__block" aria-label="Similarity Trend">
        <p className="m-0 panic-validation-panel__h3">Similarity Trend (Δ)</p>
        <table className="panic-validation-year-table yds-precursor-engine-p9__trend-table">
          <thead>
            <tr>
              <th scope="col">패턴</th>
              <th scope="col">7일 Δ</th>
              <th scope="col">30일 Δ</th>
              <th scope="col">90일 Δ</th>
            </tr>
          </thead>
          <tbody>
            {similarityTrends.map((row) => (
              <tr key={row.key}>
                <td>{row.label}</td>
                {row.trends.map((t) => (
                  <td key={t.days} className="font-mono tabular-nums">
                    <DeltaCell value={t.delta} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article className="yds-precursor-engine-p9__block" aria-label="Pattern Rotation">
        <p className="m-0 panic-validation-panel__h3">Pattern Rotation (최근 30일)</p>
        <ul className="yds-precursor-engine-p9__rotation-list">
          {patternRotation.map((r) => (
            <li key={r.key} className="yds-precursor-engine-p9__rotation-item">
              <span className="yds-precursor-engine-p9__rotation-label">{r.label}</span>
              <span className="font-mono tabular-nums">
                {fmt(r.from)} → {fmt(r.to)}{" "}
                <span className="yds-precursor-engine-p9__rotation-delta">
                  ({r.deltaLabel}) {r.direction}
                </span>
              </span>
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
