import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  buildPickPerformanceReport,
  formatPerfPct,
  formatPerfPrice,
} from "../content/ydsPickPerformanceEngine.js"
import { loadValidationPicks } from "../content/ydsValidationStorage.js"
import { refreshValidationPicks } from "../content/ydsValidationEngine.js"
import { buildValidationPriceMap } from "../content/ydsValidationPriceResolver.js"
import {
  formatRecommendSnapshotLine,
  getRecommendSnapshot,
} from "../content/ydsValidationRecommendSnapshot.js"
import { useStockPickLiveData } from "../hooks/useStockPickLiveData.js"
import { useYdsMarketContext } from "../hooks/useYdsMarketContext.js"
import YdsV1ReleaseBadge from "../components/trust/YdsV1ReleaseBadge.jsx"
import YdsEmptyState from "../components/trust/YdsEmptyState.jsx"

function StatCard({ label, value, tone = "neutral", sub }) {
  const toneClass =
    tone === "up" ? "yds-perf-val__stat--up" : tone === "down" ? "yds-perf-val__stat--down" : ""
  return (
    <article className={`yds-perf-val__stat ${toneClass}`}>
      <span className="yds-perf-val__stat-key">{label}</span>
      <strong className="yds-perf-val__stat-val font-mono tabular-nums">{value}</strong>
      {sub ? <span className="yds-perf-val__stat-sub">{sub}</span> : null}
    </article>
  )
}

function toneFromPct(v) {
  if (v == null || !Number.isFinite(v)) return "neutral"
  if (v > 0) return "up"
  if (v < 0) return "down"
  return "neutral"
}

function BarChart({ rows, valueKey, labelKey, maxBars = 12, unit = "%" }) {
  if (!rows?.length) {
    return <p className="yds-perf-val__chart-empty">집계 데이터 없음</p>
  }
  const slice = rows.slice(-maxBars)
  const vals = slice.map((r) => Number(r[valueKey])).filter((v) => Number.isFinite(v))
  const maxAbs = Math.max(1, ...vals.map((v) => Math.abs(v)))

  return (
    <div className="yds-perf-val__chart" role="img" aria-label="월별 차트">
      <div className="yds-perf-val__chart-bars">
        {slice.map((row) => {
          const v = Number(row[valueKey])
          const h = Number.isFinite(v) ? Math.round((Math.abs(v) / maxAbs) * 100) : 0
          const up = Number.isFinite(v) && v >= 0
          return (
            <div key={row[labelKey]} className="yds-perf-val__chart-col">
              <span className="yds-perf-val__chart-val font-mono tabular-nums">
                {Number.isFinite(v) ? `${v > 0 ? "+" : ""}${v.toFixed(1)}${unit}` : "—"}
              </span>
              <div className="yds-perf-val__chart-bar-wrap">
                <div
                  className={`yds-perf-val__chart-bar ${up ? "yds-perf-val__chart-bar--up" : "yds-perf-val__chart-bar--down"}`}
                  style={{ height: `${h}%` }}
                />
              </div>
              <span className="yds-perf-val__chart-label">{row.monthLabel ?? row[labelKey]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function GradeRow({ item }) {
  return (
    <div className="yds-perf-val__grade-row">
      <span className="yds-perf-val__grade-label">{item.label}</span>
      <span className="yds-perf-val__grade-meta font-mono tabular-nums">
        n={item.count}
      </span>
      <strong
        className={`yds-perf-val__grade-val font-mono tabular-nums ${
          item.avgReturn != null && item.avgReturn >= 0
            ? "yds-perf-val__grade-val--up"
            : item.avgReturn != null && item.avgReturn < 0
              ? "yds-perf-val__grade-val--down"
              : ""
        }`}
      >
        {item.count ? formatPerfPct(item.avgReturn) : "—"}
      </strong>
    </div>
  )
}

function PickRecommendSnapshot({ row, horizon7Pct }) {
  const snap = getRecommendSnapshot(row)
  if (!snap) return null
  const retClass =
    horizon7Pct != null && Number.isFinite(horizon7Pct)
      ? horizon7Pct >= 0
        ? "yds-perf-val__snap-ret--up"
        : "yds-perf-val__snap-ret--down"
      : ""

  return (
    <div className="yds-perf-val__snap" aria-label="추천 당시 스냅샷">
      <span className="yds-perf-val__snap-scores">
        {snap.totalScore != null ? (
          <span className="yds-perf-val__snap-chip font-mono tabular-nums">
            총점 {Math.round(snap.totalScore)}
          </span>
        ) : null}
        {snap.qualityGrade !== "—" ? (
          <span className="yds-perf-val__snap-chip">품질 {snap.qualityGrade}</span>
        ) : null}
        {snap.timingGrade !== "—" ? (
          <span className="yds-perf-val__snap-chip">타이밍 {snap.timingGrade}</span>
        ) : null}
        {snap.marketFitGrade !== "—" ? (
          <span className="yds-perf-val__snap-chip">시장적합 {snap.marketFitGrade}</span>
        ) : null}
      </span>
      <span className="yds-perf-val__snap-meta">
        {snap.marketStateLabel !== "—" ? (
          <span className="yds-perf-val__snap-market">{snap.marketStateLabel}</span>
        ) : null}
        {snap.panicLabel !== "—" ? (
          <span className="yds-perf-val__snap-panic">{snap.panicLabel}</span>
        ) : null}
        {horizon7Pct != null && Number.isFinite(horizon7Pct) ? (
          <span className={`yds-perf-val__snap-ret font-mono tabular-nums ${retClass}`}>
            7일 {formatPerfPct(horizon7Pct)}
          </span>
        ) : null}
      </span>
    </div>
  )
}

function CaseTable({ rows, mode }) {
  if (!rows.length) {
    return <p className="yds-perf-val__note">30일 수익률이 확정된 사례가 없습니다.</p>
  }
  return (
    <div className="yds-perf-val__table-wrap">
      <table className="yds-perf-val__table">
        <thead>
          <tr>
            <th>#</th>
            <th>추천일</th>
            <th>종목</th>
            <th>점수</th>
            <th>품질</th>
            <th>타이밍</th>
            <th>시장적합</th>
            <th>시장상태</th>
            <th>패닉</th>
            <th>추천가</th>
            <th>30일</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const snap = getRecommendSnapshot(row)
            return (
            <tr key={row.id}>
              <td>{i + 1}</td>
              <td className="font-mono tabular-nums">{row.recommendedAt}</td>
              <td>
                <Link to={`/stock-picks/${encodeURIComponent(row.ticker)}`} className="yds-perf-val__link">
                  {row.name}
                </Link>
                <span className="yds-perf-val__ticker font-mono">{row.ticker}</span>
                <PickRecommendSnapshot row={row} horizon7Pct={row.horizons?.d7} />
              </td>
              <td className="font-mono tabular-nums">
                {row.recommendedScore != null ? Math.round(row.recommendedScore) : "—"}
              </td>
              <td>{row.qualityGrade}</td>
              <td>{row.timingGrade}</td>
              <td>{row.marketFitGrade}</td>
              <td>{snap?.marketStateLabel ?? "—"}</td>
              <td>{snap?.panicLabel ?? "—"}</td>
              <td className="font-mono tabular-nums">{formatPerfPrice(row.recommendedPrice)}</td>
              <td
                className={`font-mono tabular-nums ${
                  mode === "best" ? "yds-perf-val__ret--up" : "yds-perf-val__ret--down"
                }`}
              >
                {formatPerfPct(row.lockedReturn)}
              </td>
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function PerformanceValidationPage() {
  const marketContext = useYdsMarketContext()
  const { stocks: liveStocks, loading: liveLoading } = useStockPickLiveData(marketContext)
  const [picks, setPicks] = useState(() => loadValidationPicks())

  useEffect(() => {
    if (liveLoading) return
    const priceMap = buildValidationPriceMap(liveStocks.length ? liveStocks : undefined)
    const refreshed = refreshValidationPicks(loadValidationPicks(), priceMap, {
      liveStocks: liveStocks.length ? liveStocks : null,
      marketContext,
    })
    setPicks(refreshed)
  }, [liveLoading, liveStocks, marketContext])

  const report = useMemo(() => buildPickPerformanceReport(picks, 30), [picks])
  const { kpi, gradeBreakdown, topSuccess, topFailure, monthly } = report
  const hasAny = report.allPickCount > 0

  return (
    <div className="yds-perf-val min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-perf-val__header">
        <div>
          <YdsV1ReleaseBadge compact />
          <p className="yds-perf-val__kicker">성과 검증 · 백테스트</p>
          <h1 className="yds-perf-val__title">성과 검증</h1>
          <p className="yds-perf-val__sub">
            추천 당시 점수·등급·시장상태 스냅샷 기준 · 7/14/30일 수익률 잠금 · 최근 {report.windowDays}일
          </p>
        </div>
        <Link to="/stock-picks" className="yds-perf-val__nav-link">
          종목추천
        </Link>
      </header>

      {!hasAny ? (
        <YdsEmptyState
          icon="📈"
          title="검증 데이터 없음"
          description="종목추천 화면을 열면 Top10 추천 스냅샷이 자동 기록됩니다. 며칠 후 7·14·30일 수익률이 잠금됩니다."
          primaryTo="/stock-picks"
          primaryLabel="종목추천"
        />
      ) : (
        <>
          <section className="yds-perf-val__section" aria-labelledby="perf-val-kpi">
            <h2 id="perf-val-kpi" className="yds-perf-val__h2">
              KPI · 최근 {report.windowDays}일
            </h2>
            <div className="yds-perf-val__stat-grid yds-perf-val__stat-grid--hero">
              <StatCard label="추천 종목 수" value={String(kpi.count)} />
              <StatCard
                label="30일 평균"
                value={formatPerfPct(kpi.avgReturn)}
                tone={toneFromPct(kpi.avgReturn)}
              />
              <StatCard label="승률 (30일)" value={kpi.winRate != null ? `${kpi.winRate}%` : "—"} />
              <StatCard
                label="최대 수익"
                value={formatPerfPct(kpi.maxGain)}
                tone="up"
              />
              <StatCard
                label="최대 손실"
                value={formatPerfPct(kpi.maxLoss)}
                tone="down"
              />
            </div>
            <div className="yds-perf-val__horizon-row">
              {kpi.horizons.map((h) => (
                <div key={h.key} className="yds-perf-val__horizon-chip">
                  <span className="yds-perf-val__horizon-label">{h.label} 평균</span>
                  <strong
                    className={`yds-perf-val__horizon-val font-mono tabular-nums ${
                      h.avgReturn != null && h.avgReturn >= 0
                        ? "yds-perf-val__horizon-val--up"
                        : h.avgReturn != null
                          ? "yds-perf-val__horizon-val--down"
                          : ""
                    }`}
                  >
                    {h.count ? formatPerfPct(h.avgReturn) : "—"}
                  </strong>
                  <span className="yds-perf-val__horizon-n">n={h.count}</span>
                </div>
              ))}
            </div>
            <p className="yds-perf-val__note">
              추천 생성 시 총점·품질·타이밍·시장적합·시장상태·패닉강도를 함께 저장합니다. refresh 시
              스냅샷은 변경되지 않습니다. 수익률은 추천 당시 가격 대비 해당 기간 종가를 1회 잠금합니다.
            </p>
          </section>

          {report.picks.slice(0, 5).some((p) => getRecommendSnapshot(p)?.totalScore != null) ? (
            <section className="yds-perf-val__section" aria-labelledby="perf-val-snapshots">
              <h2 id="perf-val-snapshots" className="yds-perf-val__h2">
                추천 당시 스냅샷 · 최근 사례
              </h2>
              <ul className="yds-perf-val__snap-list">
                {report.picks.slice(0, 8).map((row) => (
                  <li key={row.id} className="yds-perf-val__snap-card">
                    <span className="yds-perf-val__snap-card-title">{row.name}</span>
                    <span className="yds-perf-val__snap-card-line">
                      {formatRecommendSnapshotLine(row, row.horizons?.d7)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="yds-perf-val__section" aria-labelledby="perf-val-grade">
            <h2 id="perf-val-grade" className="yds-perf-val__h2">
              등급별 검증 · 30일 평균
            </h2>
            <div className="yds-perf-val__grade-grid">
              <div className="yds-perf-val__grade-block">
                <h3 className="yds-perf-val__h3">기업품질</h3>
                {gradeBreakdown.quality.map((g) => (
                  <GradeRow key={g.grade} item={g} />
                ))}
              </div>
              <div className="yds-perf-val__grade-block">
                <h3 className="yds-perf-val__h3">타이밍</h3>
                {gradeBreakdown.timing.map((g) => (
                  <GradeRow key={g.grade} item={g} />
                ))}
              </div>
              <div className="yds-perf-val__grade-block">
                <h3 className="yds-perf-val__h3">시장적합</h3>
                {gradeBreakdown.marketFit.map((g) => (
                  <GradeRow key={g.grade} item={g} />
                ))}
              </div>
            </div>
          </section>

          <section className="yds-perf-val__section" aria-labelledby="perf-val-top">
            <h2 id="perf-val-top" className="yds-perf-val__h2">
              TOP 성공 · 30일 수익률
            </h2>
            <CaseTable rows={topSuccess} mode="best" />
          </section>

          <section className="yds-perf-val__section" aria-labelledby="perf-val-fail">
            <h2 id="perf-val-fail" className="yds-perf-val__h2">
              실패 사례 · 30일 하락률
            </h2>
            <CaseTable rows={topFailure} mode="worst" />
          </section>

          <section className="yds-perf-val__section" aria-labelledby="perf-val-charts">
            <h2 id="perf-val-charts" className="yds-perf-val__h2">
              월별 추이
            </h2>
            <div className="yds-perf-val__chart-grid">
              <div className="yds-perf-val__chart-panel">
                <h3 className="yds-perf-val__h3">월별 승률</h3>
                <BarChart rows={monthly} valueKey="winRate" labelKey="month" unit="%" />
              </div>
              <div className="yds-perf-val__chart-panel">
                <h3 className="yds-perf-val__h3">월별 평균 수익률</h3>
                <BarChart rows={monthly} valueKey="avgReturn" labelKey="month" unit="%" />
              </div>
              <div className="yds-perf-val__chart-panel yds-perf-val__chart-panel--wide">
                <h3 className="yds-perf-val__h3">누적 성과 (월별 평균 합산)</h3>
                <BarChart rows={monthly} valueKey="cumulativeReturn" labelKey="month" unit="%" maxBars={18} />
              </div>
            </div>
          </section>

          <section className="yds-perf-val__section" aria-labelledby="perf-val-data">
            <h2 id="perf-val-data" className="yds-perf-val__h2">
              수집 데이터 · 최근 {report.windowDays}일
            </h2>
            <div className="yds-perf-val__table-wrap yds-perf-val__table-wrap--scroll">
              <table className="yds-perf-val__table yds-perf-val__table--dense">
                <thead>
                  <tr>
                    <th>추천일</th>
                    <th>종목</th>
                    <th>점수</th>
                    <th>품질</th>
                    <th>타이밍</th>
                    <th>시장적합</th>
                    <th>시장상태</th>
                    <th>패닉</th>
                    <th>추천가</th>
                    <th>7일</th>
                    <th>14일</th>
                    <th>30일</th>
                    <th>7일%</th>
                    <th>14일%</th>
                    <th>30일%</th>
                  </tr>
                </thead>
                <tbody>
                  {report.picks.map((row) => {
                    const snap = getRecommendSnapshot(row)
                    return (
                    <tr key={row.id}>
                      <td className="font-mono tabular-nums">{row.recommendedAt}</td>
                      <td>
                        <span className="yds-perf-val__pick-name">{row.name}</span>
                        <PickRecommendSnapshot row={row} horizon7Pct={row.horizons?.d7} />
                      </td>
                      <td className="font-mono tabular-nums">
                        {row.recommendedScore != null ? Math.round(row.recommendedScore) : "—"}
                      </td>
                      <td>{row.qualityGrade}</td>
                      <td>{row.timingGrade}</td>
                      <td>{row.marketFitGrade}</td>
                      <td>{snap?.marketStateLabel ?? "—"}</td>
                      <td>{snap?.panicLabel ?? "—"}</td>
                      <td className="font-mono tabular-nums">{formatPerfPrice(row.recommendedPrice)}</td>
                      <td className="font-mono tabular-nums">{formatPerfPrice(row.horizonPrices?.d7)}</td>
                      <td className="font-mono tabular-nums">{formatPerfPrice(row.horizonPrices?.d14)}</td>
                      <td className="font-mono tabular-nums">{formatPerfPrice(row.horizonPrices?.d30)}</td>
                      <td className="font-mono tabular-nums">{formatPerfPct(row.horizons?.d7)}</td>
                      <td className="font-mono tabular-nums">{formatPerfPct(row.horizons?.d14)}</td>
                      <td className="font-mono tabular-nums">{formatPerfPct(row.horizons?.d30)}</td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
