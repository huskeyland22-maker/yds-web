import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useAppDataStore } from "../store/appDataStore.js"
import { mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import { fetchPanicLabBenchmarks } from "../content/ydsEtfDailyLoader.js"
import {
  buildPanicLabReport,
  formatLabPct,
  PANIC_LAB_HORIZONS,
} from "../content/ydsPanicLabEngine.js"
import YdsV1ReleaseBadge from "../components/trust/YdsV1ReleaseBadge.jsx"
import YdsEmptyState from "../components/trust/YdsEmptyState.jsx"

function StatCard({ label, value, sub }) {
  return (
    <article className="yds-panic-lab__stat">
      <span className="yds-panic-lab__stat-key">{label}</span>
      <strong className="yds-panic-lab__stat-val font-mono tabular-nums">{value}</strong>
      {sub ? <span className="yds-panic-lab__stat-sub">{sub}</span> : null}
    </article>
  )
}

function IntensityChart({ series, minDate, maxDate }) {
  if (!series?.length) {
    return <p className="yds-panic-lab__note">패닉 강도 시계열 데이터가 없습니다.</p>
  }

  const data = series.map((p) => ({
    ...p,
    axisLabel: p.date.slice(5),
  }))

  return (
    <div className="yds-panic-lab__chart-wrap">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => String(d).slice(5)}
            tick={{ fill: "#64748b", fontSize: 10 }}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 10 }} width={32} />
          <Tooltip
            contentStyle={{
              background: "#070a10",
              border: "1px solid rgba(148,163,184,0.2)",
              fontSize: 11,
            }}
            formatter={(v) => [`${v}점`, "패닉 강도"]}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#94a3b8"
            strokeWidth={1.75}
            dot={false}
            activeDot={{ r: 3, fill: "#e2e8f0" }}
          />
          {minDate ? (
            <ReferenceDot
              x={minDate}
              y={data.find((d) => d.date === minDate)?.score}
              r={4}
              fill="#38bdf8"
              stroke="#0f172a"
            />
          ) : null}
          {maxDate ? (
            <ReferenceDot
              x={maxDate}
              y={data.find((d) => d.date === maxDate)?.score}
              r={4}
              fill="#f87171"
              stroke="#0f172a"
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
      <div className="yds-panic-lab__chart-legend">
        <span className="yds-panic-lab__legend-item">
          <span className="yds-panic-lab__dot yds-panic-lab__dot--low" /> 최저
        </span>
        <span className="yds-panic-lab__legend-item">
          <span className="yds-panic-lab__dot yds-panic-lab__dot--high" /> 최고
        </span>
      </div>
    </div>
  )
}

function ComponentBars({ items }) {
  if (!items?.length) return <p className="yds-panic-lab__note">구성요소 분석 데이터 없음</p>
  const maxShare = Math.max(...items.map((i) => i.sharePct ?? 0), 1)
  return (
    <div className="yds-panic-lab__contrib-list">
      {items.map((item) => (
        <div key={item.key} className="yds-panic-lab__contrib-row">
          <span className="yds-panic-lab__contrib-label">{item.label}</span>
          <div className="yds-panic-lab__contrib-bar-wrap">
            <div
              className="yds-panic-lab__contrib-bar"
              style={{ width: `${Math.round(((item.sharePct ?? 0) / maxShare) * 100)}%` }}
            />
          </div>
          <span className="yds-panic-lab__contrib-val font-mono tabular-nums">
            {item.sharePct != null ? `${item.sharePct}%` : "—"}
          </span>
          <span className="yds-panic-lab__contrib-sub font-mono tabular-nums">
            {item.avgScore != null ? `${item.avgScore}점` : "—"}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function PanicLabPage() {
  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)
  const history = useMemo(
    () => resolveCycleHistoryRows(mergeCycleRows(storeRows ?? [], [])),
    [storeRows],
  )

  const [benchmarks, setBenchmarks] = useState(null)
  useEffect(() => {
    let cancelled = false
    fetchPanicLabBenchmarks().then((b) => {
      if (!cancelled) setBenchmarks(b)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const report = useMemo(() => {
    if (!benchmarks) return null
    return buildPanicLabReport(history, benchmarks)
  }, [history, benchmarks])

  const loading = benchmarks == null
  const hasHistory = (report?.historyDays ?? 0) > 0

  return (
    <div className="yds-panic-lab min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-panic-lab__header">
        <div>
          <YdsV1ReleaseBadge compact />
          <p className="yds-panic-lab__kicker">Panic Lab · 패닉 연구실</p>
          <h1 className="yds-panic-lab__title">패닉 연구실</h1>
          <p className="yds-panic-lab__sub">
            패닉 강도 히스토리와 SPY·QQQ·SOXX 사후 수익률 · YDS 8지표 기여도
          </p>
        </div>
        <Link to="/market-analysis" className="yds-panic-lab__nav-link">
          시장분석
        </Link>
      </header>

      {loading ? (
        <p className="yds-panic-lab__note">벤치마크·히스토리 로딩 중…</p>
      ) : !hasHistory ? (
        <YdsEmptyState
          icon="🧪"
          title="패닉 히스토리 없음"
          description="시장분석에서 패닉 지표가 저장되면 연구실 리포트가 생성됩니다. 확장 앵커 데이터와 병합해 분석합니다."
          primaryTo="/market-analysis"
          primaryLabel="시장분석"
          secondaryTo="/panic-validation"
          secondaryLabel="패닉 검증"
        />
      ) : (
        <>
          <section className="yds-panic-lab__section" aria-labelledby="panic-lab-chart">
            <h2 id="panic-lab-chart" className="yds-panic-lab__h2">
              1. 패닉 히스토리
            </h2>
            <div className="yds-panic-lab__stat-grid yds-panic-lab__stat-grid--3">
              <StatCard label="관측 일수" value={String(report.historyDays)} />
              <StatCard
                label="최저"
                value={report.intensity.min != null ? `${report.intensity.min}점` : "—"}
                sub={report.intensity.minDate ?? undefined}
              />
              <StatCard
                label="최고"
                value={report.intensity.max != null ? `${report.intensity.max}점` : "—"}
                sub={report.intensity.maxDate ?? undefined}
              />
            </div>
            <IntensityChart
              series={report.intensity.series}
              minDate={report.intensity.minDate}
              maxDate={report.intensity.maxDate}
            />
          </section>

          <section className="yds-panic-lab__section" aria-labelledby="panic-lab-events">
            <h2 id="panic-lab-events" className="yds-panic-lab__h2">
              2. 패닉 이벤트 · 80점 이상
            </h2>
            <p className="yds-panic-lab__note">
              연속 구간 중 최고점 기록 · n={report.eventCount}
            </p>
            {report.events.length ? (
              <div className="yds-panic-lab__table-wrap">
                <table className="yds-panic-lab__table">
                  <thead>
                    <tr>
                      <th>날짜</th>
                      <th>점수</th>
                      <th>원인</th>
                      <th>당시 시장</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.events.map((ev) => (
                      <tr key={ev.id}>
                        <td className="font-mono tabular-nums">{ev.date}</td>
                        <td className="font-mono tabular-nums">{ev.score}</td>
                        <td>{ev.cause}</td>
                        <td>{ev.marketContext}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="yds-panic-lab__note">80점 이상 이벤트가 아직 기록되지 않았습니다.</p>
            )}
          </section>

          <section className="yds-panic-lab__section" aria-labelledby="panic-lab-forward">
            <h2 id="panic-lab-forward" className="yds-panic-lab__h2">
              3. 패닉 발생 후 성과
            </h2>
            <p className="yds-panic-lab__note">패닉 80+ 이벤트 이후 거래일 기준 평균 수익률</p>
            <div className="yds-panic-lab__table-wrap">
              <table className="yds-panic-lab__table yds-panic-lab__table--perf">
                <thead>
                  <tr>
                    <th>지수</th>
                    {PANIC_LAB_HORIZONS.map((h) => (
                      <th key={h.key}>{h.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.forwardPerf.map((row) => (
                    <tr key={row.id}>
                      <td>{row.label}</td>
                      {row.horizons.map((h) => (
                        <td key={h.key} className="font-mono tabular-nums">
                          {h.count ? formatLabPct(h.avgReturn) : "—"}
                          {h.count ? (
                            <span className="yds-panic-lab__cell-n"> n={h.count}</span>
                          ) : null}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-panic-lab__section" aria-labelledby="panic-lab-bands">
            <h2 id="panic-lab-bands" className="yds-panic-lab__h2">
              4. 패닉 구간 통계
            </h2>
            <div className="yds-panic-lab__table-wrap">
              <table className="yds-panic-lab__table">
                <thead>
                  <tr>
                    <th>구간</th>
                    <th>발생 빈도</th>
                    <th>SPY 30일 평균</th>
                    <th>표본</th>
                  </tr>
                </thead>
                <tbody>
                  {report.bandStats.map((band) => (
                    <tr key={band.id}>
                      <td className="font-mono tabular-nums">{band.label}</td>
                      <td className="font-mono tabular-nums">{band.frequency}일</td>
                      <td className="font-mono tabular-nums">{formatLabPct(band.avgReturn30d)}</td>
                      <td className="font-mono tabular-nums">{band.sample30d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="yds-panic-lab__section" aria-labelledby="panic-lab-components">
            <h2 id="panic-lab-components" className="yds-panic-lab__h2">
              5. 패닉 구성요소 분석
            </h2>
            <p className="yds-panic-lab__note">
              {report.componentPool === "panic80+"
                ? "패닉 80+ 구간 정규화 공포 점수 기여 비율"
                : "전체 히스토리 기준 (80+ 이벤트 3건 미만)"}
            </p>
            <ComponentBars items={report.components} />
          </section>
        </>
      )}
    </div>
  )
}
