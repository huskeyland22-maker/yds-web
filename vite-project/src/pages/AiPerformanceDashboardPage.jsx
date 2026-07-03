import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useYdsMarketContext } from "../hooks/useYdsMarketContext.js"
import { useStockPickLiveData } from "../hooks/useStockPickLiveData.js"
import {
  AI_DASHBOARD_PERIOD_FILTERS,
  buildAiPerformanceDashboardReport,
} from "../content/ydsAiPerformanceDashboardEngine.js"
import "../styles/stock-picks-platform.css"

function formatPct(value) {
  return value == null || !Number.isFinite(value) ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`
}

function DashboardCard({ label, value, tone = "neutral" }) {
  return (
    <article className={`yds-ai-dashboard__card yds-ai-dashboard__card--${tone}`}>
      <span className="yds-ai-dashboard__card-label">{label}</span>
      <strong className="yds-ai-dashboard__card-value font-mono tabular-nums">{value}</strong>
    </article>
  )
}

function MiniBars({ rows, valueKey, unit = "%" }) {
  if (!rows?.length) return <p className="yds-ai-dashboard__empty">데이터 부족</p>
  const vals = rows.map((row) => Number(row[valueKey])).filter((value) => Number.isFinite(value))
  const maxAbs = Math.max(1, ...vals.map((value) => Math.abs(value)))
  return (
    <div className="yds-ai-dashboard__bars">
      {rows.map((row) => {
        const value = Number(row[valueKey])
        const height = Number.isFinite(value) ? Math.max(6, Math.round((Math.abs(value) / maxAbs) * 100)) : 0
        const up = Number.isFinite(value) && value >= 0
        return (
          <div key={`${valueKey}-${row.month}`} className="yds-ai-dashboard__bar-col">
            <span className="yds-ai-dashboard__bar-value font-mono tabular-nums">
              {Number.isFinite(value) ? `${value > 0 ? "+" : ""}${value.toFixed(1)}${unit}` : "—"}
            </span>
            <div className="yds-ai-dashboard__bar-wrap">
              <div
                className={`yds-ai-dashboard__bar ${up ? "yds-ai-dashboard__bar--up" : "yds-ai-dashboard__bar--down"}`}
                style={{ height: `${height}%` }}
              />
            </div>
            <span className="yds-ai-dashboard__bar-label">{row.monthLabel}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function AiPerformanceDashboardPage() {
  const marketContext = useYdsMarketContext()
  const { stocks: liveStocks = [] } = useStockPickLiveData(marketContext?.ready ? marketContext : null)
  const [periodId, setPeriodId] = useState("all")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")

  const report = useMemo(
    () =>
      buildAiPerformanceDashboardReport(liveStocks, {
        periodId,
        customStart,
        customEnd,
      }),
    [liveStocks, periodId, customStart, customEnd],
  )

  const kpis = report.kpis
  const topMovers = report.topMovers

  return (
    <div className="yds-ai-dashboard min-w-0 px-3 py-4 sm:px-4">
      <Link to="/stock-picks" className="yds-spick-detail__back">
        ← 종목추천
      </Link>

      <header className="yds-ai-dashboard__head">
        <div>
          <h1 className="yds-ai-dashboard__title">{report.title}</h1>
          <p className="yds-ai-dashboard__sub">{report.subtitle}</p>
        </div>
        <div className="yds-ai-dashboard__links">
          <Link to="/performance-validation/track-record" className="yds-ai-dashboard__link">
            Track Record →
          </Link>
          <Link to="/performance-validation" className="yds-ai-dashboard__link">
            종합 검증 →
          </Link>
        </div>
      </header>

      {!report.visible || !kpis ? (
        <p className="yds-ai-dashboard__empty">저장된 추천 이력이 없습니다. 종목추천 화면을 열면 자동 기록됩니다.</p>
      ) : (
        <>
          <div className="yds-ai-dashboard__filters" role="tablist" aria-label="기간 필터">
            {AI_DASHBOARD_PERIOD_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={periodId === item.id}
                className={[
                  "yds-ai-dashboard__filter",
                  periodId === item.id ? "yds-ai-dashboard__filter--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setPeriodId(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {periodId === "custom" ? (
            <div className="yds-ai-dashboard__date-range">
              <label>
                시작일
                <input
                  type="date"
                  value={customStart}
                  min={report.availableRange.min ?? undefined}
                  max={report.availableRange.max ?? undefined}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </label>
              <label>
                종료일
                <input
                  type="date"
                  value={customEnd}
                  min={report.availableRange.min ?? undefined}
                  max={report.availableRange.max ?? undefined}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </label>
            </div>
          ) : null}

          <p className="yds-ai-dashboard__scope">
            집계 범위: {report.periodLabel} · {report.rows.length}건
          </p>

          <section className="yds-ai-dashboard__section">
            <h2 className="yds-ai-dashboard__h2">상단 KPI</h2>
            <div className="yds-ai-dashboard__grid">
              <DashboardCard label="총 추천 수" value={`${kpis.totalCount}건`} />
              <DashboardCard label="진행 중" value={`${kpis.activeCount}건`} />
              <DashboardCard label="종료" value={`${kpis.endedCount}건`} />
              <DashboardCard label="승률" value={formatPct(kpis.winRate)} tone={kpis.winRate >= 50 ? "up" : "neutral"} />
              <DashboardCard label="평균 수익률" value={formatPct(kpis.avgReturn)} tone={kpis.avgReturn > 0 ? "up" : kpis.avgReturn < 0 ? "down" : "neutral"} />
              <DashboardCard label="평균 보유기간" value={kpis.avgHoldDays != null ? `${Math.round(kpis.avgHoldDays)}일` : "—"} />
              <DashboardCard label="최고 수익률" value={formatPct(kpis.maxReturn)} tone="up" />
              <DashboardCard label="최대 손실률" value={formatPct(kpis.maxLoss)} tone="down" />
            </div>
          </section>

          <section className="yds-ai-dashboard__section">
            <h2 className="yds-ai-dashboard__h2">추가 KPI</h2>
            <div className="yds-ai-dashboard__grid yds-ai-dashboard__grid--compact">
              <DashboardCard label="AI 90+ 승률" value={formatPct(kpis.score90WinRate)} />
              <DashboardCard label="KR 승률" value={formatPct(kpis.krWinRate)} />
              <DashboardCard label="US 승률" value={formatPct(kpis.usWinRate)} />
              <DashboardCard label="Outperform 비율" value={formatPct(kpis.outperformRate)} />
              <DashboardCard label="평균 Alpha" value={formatPct(kpis.avgAlpha)} tone={kpis.avgAlpha > 0 ? "up" : kpis.avgAlpha < 0 ? "down" : "neutral"} />
            </div>
          </section>

          <section className="yds-ai-dashboard__section">
            <h2 className="yds-ai-dashboard__h2">월별 성과</h2>
            {!report.monthly.length ? (
              <p className="yds-ai-dashboard__empty">월별 집계 데이터가 부족합니다.</p>
            ) : (
              <>
                <div className="yds-ai-dashboard__table-scroll">
                  <table className="yds-ai-dashboard__table">
                    <thead>
                      <tr>
                        <th>월</th>
                        <th>추천 수</th>
                        <th>승률</th>
                        <th>평균 수익률</th>
                        <th>누적 성과</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.monthly.map((row) => (
                        <tr key={row.month}>
                          <td>{row.monthLabel}</td>
                          <td className="font-mono tabular-nums">{row.count}</td>
                          <td className="font-mono tabular-nums">{formatPct(row.winRate)}</td>
                          <td className="font-mono tabular-nums">{formatPct(row.avgReturn)}</td>
                          <td className="font-mono tabular-nums">{formatPct(row.cumulativeReturn)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="yds-ai-dashboard__chart-grid">
                  <section className="yds-ai-dashboard__chart-box">
                    <h3>월별 승률</h3>
                    <MiniBars rows={report.monthly} valueKey="winRate" />
                  </section>
                  <section className="yds-ai-dashboard__chart-box">
                    <h3>월별 평균 수익률</h3>
                    <MiniBars rows={report.monthly} valueKey="avgReturn" />
                  </section>
                  <section className="yds-ai-dashboard__chart-box yds-ai-dashboard__chart-box--wide">
                    <h3>누적 성과 그래프</h3>
                    <MiniBars rows={report.monthly} valueKey="cumulativeReturn" />
                  </section>
                </div>
              </>
            )}
          </section>

          <section className="yds-ai-dashboard__section">
            <h2 className="yds-ai-dashboard__h2">최고/최악 추천</h2>
            <div className="yds-ai-dashboard__movers">
              <div className="yds-ai-dashboard__mover">
                <span>최고 추천</span>
                <strong>{topMovers?.best?.name ?? "—"}</strong>
                <span className="font-mono tabular-nums">{formatPct(topMovers?.best?.returnPct ?? null)}</span>
              </div>
              <div className="yds-ai-dashboard__mover">
                <span>최악 추천</span>
                <strong>{topMovers?.worst?.name ?? "—"}</strong>
                <span className="font-mono tabular-nums">{formatPct(topMovers?.worst?.returnPct ?? null)}</span>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
