import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useYdsMarketContext } from "../hooks/useYdsMarketContext.js"
import { useStockPickLiveData } from "../hooks/useStockPickLiveData.js"
import {
  AI_DASHBOARD_PERIOD_FILTERS,
  buildAiPerformanceDashboardReport,
  filterDashboardRowsByDrilldown,
  resolveDashboardDrillLabel,
} from "../content/ydsAiPerformanceDashboardEngine.js"
import "../styles/stock-picks-platform.css"

function formatPct(value) {
  return value == null || !Number.isFinite(value) ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`
}

/**
 * @param {{
 *   label: string
 *   value: string
 *   tone?: string
 *   drillId?: string
 *   activeDrillId?: string | null
 *   onDrill?: (id: string) => void
 * }} props
 */
function DashboardCard({ label, value, tone = "neutral", drillId, activeDrillId, onDrill }) {
  const clickable = Boolean(drillId && onDrill)
  const active = clickable && activeDrillId === drillId
  return (
    <article
      className={[
        "yds-ai-dashboard__card",
        `yds-ai-dashboard__card--${tone}`,
        clickable ? "yds-ai-dashboard__card--clickable" : "",
        active ? "yds-ai-dashboard__card--active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => onDrill(drillId) : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onDrill(drillId)
              }
            }
          : undefined
      }
    >
      <span className="yds-ai-dashboard__card-label">{label}</span>
      <strong className="yds-ai-dashboard__card-value font-mono tabular-nums">{value}</strong>
    </article>
  )
}

/**
 * @param {{
 *   title: string
 *   items: { id: string; label: string; count: number }[]
 *   activeDrillId?: string | null
 *   onDrill?: (id: string) => void
 * }} props
 */
function DrillChipGroup({ title, items, activeDrillId, onDrill }) {
  if (!items.length) return null
  return (
    <div className="yds-ai-dashboard__chip-group">
      <h3 className="yds-ai-dashboard__chip-title">{title}</h3>
      <div className="yds-ai-dashboard__chips">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={[
              "yds-ai-dashboard__chip",
              activeDrillId === item.id ? "yds-ai-dashboard__chip--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onDrill?.(item.id)}
          >
            <span>{item.label}</span>
            <span className="yds-ai-dashboard__chip-count font-mono tabular-nums">{item.count}</span>
          </button>
        ))}
      </div>
    </div>
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

/**
 * @param {{
 *   rows: ReturnType<typeof filterDashboardRowsByDrilldown>
 *   drillLabel: string
 *   onClear: () => void
 * }} props
 */
function DashboardDrilldownTable({ rows, drillLabel, onClear }) {
  return (
    <section className="yds-ai-dashboard__drill" aria-label="Drill-down 추천 목록">
      <div className="yds-ai-dashboard__drill-head">
        <h2 className="yds-ai-dashboard__h2">
          {drillLabel} <span className="yds-ai-dashboard__drill-count">({rows.length}건)</span>
        </h2>
        <button type="button" className="yds-ai-dashboard__drill-clear" onClick={onClear}>
          필터 해제
        </button>
      </div>
      {!rows.length ? (
        <p className="yds-ai-dashboard__empty">해당 조건의 추천이 없습니다.</p>
      ) : (
        <div className="yds-ai-dashboard__table-scroll">
          <table className="yds-ai-dashboard__table yds-ai-dashboard__table--drill">
            <thead>
              <tr>
                <th>추천일</th>
                <th>종목</th>
                <th>추천가</th>
                <th>현재가</th>
                <th>수익률</th>
                <th>AI점수</th>
                <th>시장상태</th>
                <th>패닉강도</th>
                <th>추천사유</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const panic =
                  row.marketLedger?.panicIntensity != null &&
                  Number.isFinite(row.marketLedger.panicIntensity)
                    ? Math.round(row.marketLedger.panicIntensity)
                    : "—"
                const marketLabel =
                  row.marketLedger?.marketStateLabel ??
                  row.marketLedger?.strategyLabel ??
                  "—"
                return (
                  <tr key={row.pickId} className="yds-ai-dashboard__drill-row">
                    <td
                      className="font-mono tabular-nums"
                      title={row.recommendedAtLabel ?? undefined}
                    >
                      {row.elapsedLabel ?? row.recommendedAtLabel ?? "—"}
                    </td>
                    <td>
                      <Link
                        to={`/stock-picks/${encodeURIComponent(row.ticker)}`}
                        className="yds-ai-dashboard__drill-name"
                      >
                        {row.name}
                      </Link>
                      <span className="yds-ai-dashboard__drill-ticker font-mono tabular-nums">
                        {row.ticker}
                      </span>
                    </td>
                    <td className="font-mono tabular-nums">{row.recommendedPriceLabel}</td>
                    <td className="font-mono tabular-nums">{row.currentPriceLabel}</td>
                    <td
                      className={[
                        "font-mono tabular-nums",
                        `yds-ai-dashboard__ret--${row.returnTone ?? "muted"}`,
                      ].join(" ")}
                    >
                      {row.returnLabel}
                    </td>
                    <td className="font-mono tabular-nums">{row.aiScoreLabel}</td>
                    <td>{marketLabel}</td>
                    <td className="font-mono tabular-nums">{panic}</td>
                    <td className="yds-ai-dashboard__drill-reason">{row.reasonLine}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default function AiPerformanceDashboardPage() {
  const marketContext = useYdsMarketContext()
  const { stocks: liveStocks = [] } = useStockPickLiveData(marketContext?.ready ? marketContext : null)
  const [periodId, setPeriodId] = useState("all")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")
  const [drillId, setDrillId] = useState(/** @type {string | null} */ (null))

  const report = useMemo(
    () =>
      buildAiPerformanceDashboardReport(liveStocks, {
        periodId,
        customStart,
        customEnd,
      }),
    [liveStocks, periodId, customStart, customEnd],
  )

  const drillRows = useMemo(
    () => filterDashboardRowsByDrilldown(report.rows, drillId),
    [report.rows, drillId],
  )

  const kpis = report.kpis
  const topMovers = report.topMovers
  const analysis = report.analysis

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
                onClick={() => {
                  setPeriodId(item.id)
                  setDrillId(null)
                }}
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
            {drillId ? ` · 필터: ${resolveDashboardDrillLabel(drillId)}` : ""}
          </p>

          <section className="yds-ai-dashboard__section">
            <h2 className="yds-ai-dashboard__h2">상단 KPI</h2>
            <p className="yds-ai-dashboard__hint">KPI를 클릭하면 해당 조건의 추천 목록을 확인할 수 있습니다.</p>
            <div className="yds-ai-dashboard__grid">
              <DashboardCard
                label="총 추천 수"
                value={`${kpis.totalCount}건`}
                drillId="kpi-total"
                activeDrillId={drillId}
                onDrill={setDrillId}
              />
              <DashboardCard
                label="진행 중"
                value={`${kpis.activeCount}건`}
                drillId="kpi-active"
                activeDrillId={drillId}
                onDrill={setDrillId}
              />
              <DashboardCard
                label="종료"
                value={`${kpis.endedCount}건`}
                drillId="kpi-ended"
                activeDrillId={drillId}
                onDrill={setDrillId}
              />
              <DashboardCard
                label="승률"
                value={formatPct(kpis.winRate)}
                tone={kpis.winRate >= 50 ? "up" : "neutral"}
                drillId="kpi-win"
                activeDrillId={drillId}
                onDrill={setDrillId}
              />
              <DashboardCard
                label="평균 수익률"
                value={formatPct(kpis.avgReturn)}
                tone={kpis.avgReturn > 0 ? "up" : kpis.avgReturn < 0 ? "down" : "neutral"}
                drillId="kpi-avg-return"
                activeDrillId={drillId}
                onDrill={setDrillId}
              />
              <DashboardCard
                label="평균 보유기간"
                value={kpis.avgHoldDays != null ? `${Math.round(kpis.avgHoldDays)}일` : "—"}
                drillId="kpi-avg-hold"
                activeDrillId={drillId}
                onDrill={setDrillId}
              />
              <DashboardCard
                label="최고 수익률"
                value={formatPct(kpis.maxReturn)}
                tone="up"
                drillId="kpi-max-return"
                activeDrillId={drillId}
                onDrill={setDrillId}
              />
              <DashboardCard
                label="최대 손실률"
                value={formatPct(kpis.maxLoss)}
                tone="down"
                drillId="kpi-max-loss"
                activeDrillId={drillId}
                onDrill={setDrillId}
              />
            </div>
          </section>

          <section className="yds-ai-dashboard__section">
            <h2 className="yds-ai-dashboard__h2">분석 Drill-down</h2>
            <div className="yds-ai-dashboard__analysis">
              <DrillChipGroup
                title="AI 점수별"
                items={analysis?.score ?? []}
                activeDrillId={drillId}
                onDrill={setDrillId}
              />
              <DrillChipGroup
                title="국가별"
                items={analysis?.country ?? []}
                activeDrillId={drillId}
                onDrill={setDrillId}
              />
              <DrillChipGroup
                title="시장 상태별"
                items={analysis?.market ?? []}
                activeDrillId={drillId}
                onDrill={setDrillId}
              />
              <DrillChipGroup
                title="패닉 강도별"
                items={analysis?.panic ?? []}
                activeDrillId={drillId}
                onDrill={setDrillId}
              />
            </div>
          </section>

          {drillId ? (
            <DashboardDrilldownTable
              rows={drillRows}
              drillLabel={resolveDashboardDrillLabel(drillId)}
              onClear={() => setDrillId(null)}
            />
          ) : null}

          <section className="yds-ai-dashboard__section">
            <h2 className="yds-ai-dashboard__h2">추가 KPI</h2>
            <div className="yds-ai-dashboard__grid yds-ai-dashboard__grid--compact">
              <DashboardCard
                label="AI 90+ 승률"
                value={formatPct(kpis.score90WinRate)}
                drillId="score-g90"
                activeDrillId={drillId}
                onDrill={setDrillId}
              />
              <DashboardCard
                label="KR 승률"
                value={formatPct(kpis.krWinRate)}
                drillId="country-kr"
                activeDrillId={drillId}
                onDrill={setDrillId}
              />
              <DashboardCard
                label="US 승률"
                value={formatPct(kpis.usWinRate)}
                drillId="country-us"
                activeDrillId={drillId}
                onDrill={setDrillId}
              />
              <DashboardCard label="Outperform 비율" value={formatPct(kpis.outperformRate)} />
              <DashboardCard
                label="평균 Alpha"
                value={formatPct(kpis.avgAlpha)}
                tone={kpis.avgAlpha > 0 ? "up" : kpis.avgAlpha < 0 ? "down" : "neutral"}
              />
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
              <button
                type="button"
                className="yds-ai-dashboard__mover yds-ai-dashboard__mover--clickable"
                onClick={() => setDrillId("kpi-max-return")}
              >
                <span>최고 추천</span>
                <strong>{topMovers?.best?.name ?? "—"}</strong>
                <span className="font-mono tabular-nums">{formatPct(topMovers?.best?.returnPct ?? null)}</span>
              </button>
              <button
                type="button"
                className="yds-ai-dashboard__mover yds-ai-dashboard__mover--clickable"
                onClick={() => setDrillId("kpi-max-loss")}
              >
                <span>최악 추천</span>
                <strong>{topMovers?.worst?.name ?? "—"}</strong>
                <span className="font-mono tabular-nums">{formatPct(topMovers?.worst?.returnPct ?? null)}</span>
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
