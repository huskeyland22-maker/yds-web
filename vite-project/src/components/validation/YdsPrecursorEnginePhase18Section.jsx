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
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildPrecursorEnginePhase18Report,
  formatPerformancePct,
  mergeValidationLogForAnalysis,
  PRECURSOR_ENGINE_PHASE18_LABEL,
} from "../../trading-zone/ydsPrecursorEnginePhase18.js"
import { formatMetric } from "../../trading-zone/ydsHistoricalEventTypes.js"

const BUCKET_COLORS = {
  watch: "#22c55e",
  interest: "#eab308",
  dca: "#f97316",
  panic: "#ef4444",
}

/**
 * @param {{
 *   events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[]
 *   historyRows?: object[]
 * }} props
 */
export default function YdsPrecursorEnginePhase18Section({
  events = YDS_VALIDATION_EVENT_DATASET,
  historyRows = [],
}) {
  const [horizon, setHorizon] = useState("m3")

  const report = useMemo(
    () =>
      buildPrecursorEnginePhase18Report(events, {
        extraRows: historyRows,
        log: mergeValidationLogForAnalysis(),
      }),
    [events, historyRows],
  )

  const {
    meta,
    horizons,
    scoreboard,
    winRateRanking,
    avgReturnRanking,
    bestSignal,
    worstSignal,
    cumulativeChart,
    signals,
    notes,
  } = report

  const scoreboardRows = scoreboard[horizon] ?? []
  const chartSeries = cumulativeChart.series

  const chartData = useMemo(() => {
    const dates = new Set()
    for (const s of chartSeries) {
      for (const p of s.points) {
        if (p.date && p.date !== "—") dates.add(p.date)
      }
    }
    const sorted = [...dates].sort()
    return sorted.map((date) => {
      /** @type {Record<string, number | string>} */
      const row = { date: date.slice(5) }
      for (const s of chartSeries) {
        const pt = s.points.find((p) => p.date === date)
        if (pt) row[s.bucketId] = pt.equity
      }
      return row
    })
  }, [chartSeries])

  return (
    <section
      className="panic-validation-panel yds-precursor-engine-p18"
      aria-labelledby="yds-precursor-engine-p18-title"
    >
      <h2 id="yds-precursor-engine-p18-title" className="panic-validation-panel__h2">
        {PRECURSOR_ENGINE_PHASE18_LABEL}
      </h2>
      <p className="panic-validation-panel__note">
        Phase 15 행동 가이드 실적 검증 · Validation Log 기반 · Phase 0~17 읽기 전용
      </p>

      <p className="m-0 yds-precursor-engine-p18__meta font-mono tabular-nums">
        로그 {meta.logEntries}일 · 매칭 {meta.matchedSignals}건 · 히스토리 {meta.historySteps}스텝
      </p>

      {!meta.hasData ? (
        <p className="m-0 yds-precursor-engine-p18__empty">
          분석 가능한 로그가 없습니다. Phase 17/13에서 일별 스냅샷을 저장한 뒤 다시 확인하세요.
        </p>
      ) : null}

      <div className="yds-precursor-engine-p18__horizon-tabs" role="tablist" aria-label="성과 구간">
        {horizons.map((h) => (
          <button
            key={h.key}
            type="button"
            role="tab"
            aria-selected={horizon === h.key}
            className={
              horizon === h.key
                ? "yds-precursor-engine-p18__horizon-tab yds-precursor-engine-p18__horizon-tab--active"
                : "yds-precursor-engine-p18__horizon-tab"
            }
            onClick={() => setHorizon(h.key)}
          >
            {h.label}
          </button>
        ))}
      </div>

      <article className="yds-precursor-engine-p18__block" aria-label="A. 행동별 스코어보드">
        <p className="m-0 panic-validation-panel__h3">A. 행동별 스코어보드</p>
        <table className="panic-validation-year-table yds-precursor-engine-p18__table">
          <thead>
            <tr>
              <th scope="col">행동 구간</th>
              <th scope="col">발생</th>
              <th scope="col">승률</th>
              <th scope="col">평균 수익</th>
              <th scope="col">최대 수익</th>
              <th scope="col">최대 손실</th>
            </tr>
          </thead>
          <tbody>
            {scoreboardRows.map((row) => (
              <tr key={row.bucketId}>
                <td>
                  {row.emoji} {row.label}
                </td>
                <td className="font-mono tabular-nums">{row.count}</td>
                <td className="font-mono tabular-nums">
                  {row.winRate != null ? `${row.winRate}%` : "—"}
                </td>
                <td className="font-mono tabular-nums">{formatPerformancePct(row.avgReturn)}</td>
                <td className="font-mono tabular-nums yds-precursor-engine-p18__up">
                  {formatPerformancePct(row.maxGain)}
                </td>
                <td className="font-mono tabular-nums yds-precursor-engine-p18__down">
                  {formatPerformancePct(row.maxLoss)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <div className="yds-precursor-engine-p18__two-col">
        <article className="yds-precursor-engine-p18__block" aria-label="B. 승률 랭킹">
          <p className="m-0 panic-validation-panel__h3">B. 승률 랭킹 (3개월)</p>
          <ol className="yds-precursor-engine-p18__rank-list">
            {winRateRanking.map((r) => (
              <li key={r.bucketId}>
                <span className="font-mono tabular-nums">{r.rank}.</span> {r.emoji} {r.label}{" "}
                <strong>{r.winRate}%</strong>
                <span className="yds-precursor-engine-p18__rank-sub"> ({r.count}건)</span>
              </li>
            ))}
          </ol>
        </article>

        <article className="yds-precursor-engine-p18__block" aria-label="C. 평균 수익률 랭킹">
          <p className="m-0 panic-validation-panel__h3">C. 평균 수익률 랭킹 (3개월)</p>
          <ol className="yds-precursor-engine-p18__rank-list">
            {avgReturnRanking.map((r) => (
              <li key={r.bucketId}>
                <span className="font-mono tabular-nums">{r.rank}.</span> {r.emoji} {r.label}{" "}
                <strong>{formatPerformancePct(r.avgReturn)}</strong>
              </li>
            ))}
          </ol>
        </article>
      </div>

      <div className="yds-precursor-engine-p18__two-col">
        <article
          className="yds-precursor-engine-p18__extreme yds-precursor-engine-p18__extreme--best"
          aria-label="D. 최고 성과 시그널"
        >
          <p className="m-0 panic-validation-panel__h3">D. 최고 성과 시그널</p>
          {bestSignal ? (
            <>
              <p className="m-0 font-mono tabular-nums">{bestSignal.date}</p>
              <p className="m-0">
                {bestSignal.bucketEmoji} {bestSignal.actionLabel} ·{" "}
                <strong className="yds-precursor-engine-p18__up">
                  {formatPerformancePct(bestSignal.returnPct)}
                </strong>
              </p>
              <p className="m-0 yds-precursor-engine-p18__extreme-sub">
                YDS {formatMetric(bestSignal.ydsScore, 0)} · {bestSignal.regimeLabel}
              </p>
            </>
          ) : (
            <p className="m-0 text-slate-500">—</p>
          )}
        </article>

        <article
          className="yds-precursor-engine-p18__extreme yds-precursor-engine-p18__extreme--worst"
          aria-label="E. 최악 성과 시그널"
        >
          <p className="m-0 panic-validation-panel__h3">E. 최악 성과 시그널</p>
          {worstSignal ? (
            <>
              <p className="m-0 font-mono tabular-nums">{worstSignal.date}</p>
              <p className="m-0">
                {worstSignal.bucketEmoji} {worstSignal.actionLabel} ·{" "}
                <strong className="yds-precursor-engine-p18__down">
                  {formatPerformancePct(worstSignal.returnPct)}
                </strong>
              </p>
              <p className="m-0 yds-precursor-engine-p18__extreme-sub">
                YDS {formatMetric(worstSignal.ydsScore, 0)} · {worstSignal.regimeLabel}
              </p>
            </>
          ) : (
            <p className="m-0 text-slate-500">—</p>
          )}
        </article>
      </div>

      <article className="yds-precursor-engine-p18__block" aria-label="F. 누적 성과 차트">
        <p className="m-0 panic-validation-panel__h3">F. 누적 성과 차트 (3개월·구간별)</p>
        {chartData.length > 1 ? (
          <div className="yds-precursor-engine-p18__chart">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 10 }} stroke="#64748b" domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{
                    background: "rgba(15,23,42,0.95)",
                    border: "1px solid rgba(51,65,85,0.8)",
                    fontSize: 11,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {chartSeries.map((s) => (
                  <Line
                    key={s.bucketId}
                    type="monotone"
                    dataKey={s.bucketId}
                    name={`${s.emoji} ${s.label}`}
                    stroke={BUCKET_COLORS[s.bucketId] ?? "#94a3b8"}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="m-0 text-slate-500">누적 차트 데이터 부족</p>
        )}
        <ul className="yds-precursor-engine-p18__chart-legend">
          {chartSeries.map((s) => (
            <li key={s.bucketId}>
              {s.emoji} {s.label}: {s.signalCount}건 · 최종 {s.finalEquity}
            </li>
          ))}
        </ul>
      </article>

      {signals.length ? (
        <article className="yds-precursor-engine-p18__block" aria-label="시그널 샘플">
          <p className="m-0 panic-validation-panel__h3">최근 매칭 시그널</p>
          <table className="panic-validation-year-table yds-precursor-engine-p18__table yds-precursor-engine-p18__table--compact">
            <thead>
              <tr>
                <th scope="col">날짜</th>
                <th scope="col">행동</th>
                <th scope="col">1M</th>
                <th scope="col">3M</th>
                <th scope="col">6M</th>
                <th scope="col">12M</th>
              </tr>
            </thead>
            <tbody>
              {signals.slice(0, 12).map((s) => (
                <tr key={s.date}>
                  <td className="font-mono tabular-nums">{s.date}</td>
                  <td>
                    {s.bucketEmoji} {s.actionLabel}
                  </td>
                  <td className="font-mono tabular-nums">
                    {formatPerformancePct(s.forwardReturns.m1)}
                  </td>
                  <td className="font-mono tabular-nums">
                    {formatPerformancePct(s.forwardReturns.m3)}
                  </td>
                  <td className="font-mono tabular-nums">
                    {formatPerformancePct(s.forwardReturns.m6)}
                  </td>
                  <td className="font-mono tabular-nums">
                    {formatPerformancePct(s.forwardReturns.m12)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ) : null}

      <ul className="panic-validation-panel__notes">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </section>
  )
}
