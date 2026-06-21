import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  buildPickPerformanceReport,
  formatPerfPct,
  formatPerfPrice,
} from "../content/ydsPickPerformanceEngine.js"
import {
  buildSuccessPatternReport,
  formatSuccessRate,
  GRADE_PATTERN_MIN_SAMPLE,
  OUTCOME_LABELS,
  PATTERN_MIN_SAMPLE,
} from "../content/ydsPickSuccessPatternEngine.js"
import {
  buildOutcomeSummaryReport,
  outcomeCriteriaLabels,
  resolvePickOutcomeView,
} from "../content/ydsPickOutcomeEngine.js"
import {
  buildReliabilityAuditReport,
} from "../content/ydsPickReliabilityAudit.js"
import {
  buildScoreCorrelationReport,
} from "../content/ydsPickScoreCorrelation.js"
import { buildComponentContributionReport } from "../content/ydsPickComponentContribution.js"
import { buildPanicDeepAnalysisReport } from "../content/ydsPickPanicDeepAnalysis.js"
import { buildMarketStateStrategyReport } from "../content/ydsPickMarketStateStrategy.js"
import {
  buildHorizonAvailability,
  isComponentContributionPanelVisible,
  isHorizonTabEnabled,
  isMarketStrategyPanelVisible,
  isOutcomePanelVisible,
  isPanicDeepPanelVisible,
  isReliabilityPanelVisible,
  isScoreCorrelationPanelVisible,
  isSuccessPatternPanelVisible,
  resolveDefaultHorizon,
} from "../content/ydsPickPerfPanelVisibility.js"
import { loadValidationPicks } from "../content/ydsValidationStorage.js"
import { refreshValidationPicks } from "../content/ydsValidationEngine.js"
import { buildValidationPriceMap } from "../content/ydsValidationPriceResolver.js"
import {
  formatRecommendSnapshotLine,
  formatSnapshotGradeCell,
  formatSnapshotTotalScore,
  getRecommendSnapshot,
  pickDisplayFieldsFromSnapshot,
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

function OutcomeBadge({ returnPct, compact = false }) {
  const view = resolvePickOutcomeView(returnPct)
  if (!view) {
    return <span className="yds-perf-val__outcome yds-perf-val__outcome--pending">—</span>
  }
  return (
    <span
      className={`yds-perf-val__outcome yds-perf-val__outcome--${view.tone}${compact ? " yds-perf-val__outcome--compact" : ""}`}
      title={`${view.label} · ${returnPct != null ? formatPerfPct(returnPct) : "—"}`}
    >
      <span className="yds-perf-val__outcome-emoji" aria-hidden>
        {view.emoji}
      </span>
      {!compact ? <span className="yds-perf-val__outcome-label">{view.label}</span> : null}
    </span>
  )
}

/**
 * @param {{
 *   horizons: { key: string; label: string }[]
 *   horizonKey: string
 *   onHorizonChange: (key: string) => void
 *   availability: Record<string, number>
 *   className?: string
 *   ariaLabel?: string
 *   tabClassPrefix?: string
 * }} props
 */
function HorizonTabBar({
  horizons,
  horizonKey,
  onHorizonChange,
  availability,
  className = "yds-perf-val__pattern-horizon",
  ariaLabel = "분석 기간",
  tabClassPrefix = "yds-perf-val__pattern-tab",
}) {
  return (
    <div className={className} role="tablist" aria-label={ariaLabel}>
      {horizons.map((h) => {
        const enabled = isHorizonTabEnabled(availability, h.key)
        const active = horizonKey === h.key
        return (
          <button
            key={h.key}
            type="button"
            role="tab"
            aria-selected={active}
            aria-disabled={!enabled}
            disabled={!enabled}
            title={enabled ? undefined : "데이터 수집 중"}
            className={[
              tabClassPrefix,
              active ? `${tabClassPrefix}--active` : "",
              !enabled ? `${tabClassPrefix}--disabled` : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => {
              if (enabled) onHorizonChange(h.key)
            }}
          >
            {enabled ? h.label : `${h.label} · 수집중`}
          </button>
        )
      })}
    </div>
  )
}

function OutcomeVerdictPanel({ summary, horizonKey, onHorizonChange, horizonAvailability }) {
  if (!isOutcomePanelVisible(summary)) return null

  const horizons = [
    { key: "d7", label: "7일" },
    { key: "d14", label: "14일" },
    { key: "d30", label: "30일" },
  ]
  const criteriaLabels = outcomeCriteriaLabels(summary.criteria)

  return (
    <section className="yds-perf-val__section yds-perf-val__outcome-panel" aria-labelledby="perf-val-outcome">
      <div className="yds-perf-val__outcome-head">
        <div>
          <p className="yds-perf-val__outcome-kicker">Verdict · Outcome</p>
          <h2 id="perf-val-outcome" className="yds-perf-val__h2">
            성공/실패 판정
          </h2>
          <p className="yds-perf-val__outcome-lede">
            잠금 수익률 기준 · 실제 성과만 · 예측 없음
          </p>
        </div>
        <HorizonTabBar
          horizons={horizons}
          horizonKey={horizonKey}
          onHorizonChange={onHorizonChange}
          availability={horizonAvailability}
          className="yds-perf-val__outcome-horizon"
          ariaLabel="판정 기간"
          tabClassPrefix="yds-perf-val__outcome-tab"
        />
      </div>

      <div className="yds-perf-val__outcome-criteria">
        {criteriaLabels.map((c) => (
          <span key={c.id} className="yds-perf-val__outcome-criterion">
            {c.label}
          </span>
        ))}
      </div>

      <div className="yds-perf-val__outcome-summary">
        <StatCard label={`총 추천 · ${summary.horizonLabel}`} value={`${summary.total}건`} />
        <StatCard
          label="성공"
          value={`${summary.successCount}건`}
          tone="up"
          sub={summary.normalCount ? `보통 ${summary.normalCount}건` : undefined}
        />
        <StatCard label="실패" value={`${summary.failureCount}건`} tone="down" />
        <StatCard
          label="성공률"
          value={summary.successRate != null ? `${summary.successRate}%` : "—"}
          tone={summary.successRate != null && summary.successRate >= 50 ? "up" : "neutral"}
        />
        <StatCard
          label="평균 수익률"
          value={formatPerfPct(summary.avgReturn)}
          tone={toneFromPct(summary.avgReturn)}
        />
      </div>
    </section>
  )
}

function PatternBucketRow({ item }) {
  const pending = item.pending
  const rateClass =
    !pending && item.successRate != null && item.successRate >= 50
      ? "yds-perf-val__pattern-rate--up"
      : !pending && item.successRate != null && item.successRate < 40
        ? "yds-perf-val__pattern-rate--down"
        : ""

  return (
    <div className={`yds-perf-val__pattern-row ${pending ? "yds-perf-val__pattern-row--pending" : ""}`}>
      <span className="yds-perf-val__pattern-label">{item.label}</span>
      <span className="yds-perf-val__pattern-meta font-mono tabular-nums">n={item.count}</span>
      <strong className={`yds-perf-val__pattern-rate font-mono tabular-nums ${rateClass}`}>
        {formatSuccessRate(item.successRate, pending, item.count)}
      </strong>
      {!pending && item.avgReturn != null ? (
        <span className="yds-perf-val__pattern-avg font-mono tabular-nums">
          평균 {formatPerfPct(item.avgReturn)}
        </span>
      ) : null}
    </div>
  )
}

function SuccessPatternPanel({ pattern, horizonKey, onHorizonChange, horizonAvailability }) {
  if (!isSuccessPatternPanelVisible(pattern)) return null

  const horizons = [
    { key: "d7", label: "7일" },
    { key: "d14", label: "14일" },
    { key: "d30", label: "30일" },
  ]

  return (
    <section className="yds-perf-val__section yds-perf-val__pattern" aria-labelledby="perf-val-pattern">
      <div className="yds-perf-val__pattern-head">
        <div>
          <p className="yds-perf-val__pattern-kicker">Research · Pattern Analysis</p>
          <h2 id="perf-val-pattern" className="yds-perf-val__h2">
            성공 패턴 분석
          </h2>
          <p className="yds-perf-val__pattern-lede">
            실제 잠금 수익률 기준 · 등급별 표본 {GRADE_PATTERN_MIN_SAMPLE}개 미만은 참고용 · AI 예측 없음
          </p>
        </div>
        <HorizonTabBar
          horizons={horizons}
          horizonKey={horizonKey}
          onHorizonChange={onHorizonChange}
          availability={horizonAvailability}
        />
      </div>

      <div className="yds-perf-val__pattern-criteria">
        {OUTCOME_LABELS.map((o) => (
          <span key={o.id} className="yds-perf-val__pattern-criterion">
            {o.label}
          </span>
        ))}
        <span className="yds-perf-val__pattern-criterion yds-perf-val__pattern-criterion--muted">
          추적 n={pattern.totalTracked} · {pattern.horizonLabel} 잠금
        </span>
      </div>

      {pattern.highlights.length ? (
        <div className="yds-perf-val__pattern-highlights">
          {pattern.highlights.map((h) => (
            <article key={h.id} className="yds-perf-val__pattern-card">
              <span className="yds-perf-val__pattern-card-key">{h.label}</span>
              <strong className="yds-perf-val__pattern-card-val font-mono tabular-nums">
                성공률 {h.successRate}%
              </strong>
              <span className="yds-perf-val__pattern-card-sub font-mono tabular-nums">
                n={h.count} · 평균 {formatPerfPct(h.avgReturn)}
              </span>
            </article>
          ))}
        </div>
      ) : (
        <p className="yds-perf-val__pattern-empty">
          {pattern.horizonLabel} 수익률이 잠긴 표본이 {PATTERN_MIN_SAMPLE}개 미만입니다. 데이터가 쌓이면 패턴 분석이
          표시됩니다.
        </p>
      )}

      <div className="yds-perf-val__pattern-grid">
        <div className="yds-perf-val__pattern-block">
          <h3 className="yds-perf-val__h3">기업품질 · 성공률</h3>
          {pattern.grades.quality.map((g) => (
            <PatternBucketRow key={g.id} item={g} />
          ))}
        </div>
        <div className="yds-perf-val__pattern-block">
          <h3 className="yds-perf-val__h3">타이밍 · 성공률</h3>
          {pattern.grades.timing.map((g) => (
            <PatternBucketRow key={g.id} item={g} />
          ))}
        </div>
        <div className="yds-perf-val__pattern-block">
          <h3 className="yds-perf-val__h3">시장적합 · 성공률</h3>
          {pattern.grades.marketFit.map((g) => (
            <PatternBucketRow key={g.id} item={g} />
          ))}
        </div>
        <div className="yds-perf-val__pattern-block">
          <h3 className="yds-perf-val__h3">시장상태 · 성공률</h3>
          {pattern.marketStates.length ? (
            pattern.marketStates.map((g) => <PatternBucketRow key={g.id} item={g} />)
          ) : (
            <p className="yds-perf-val__pattern-note">시장상태 스냅샷 없음</p>
          )}
        </div>
        <div className="yds-perf-val__pattern-block yds-perf-val__pattern-block--wide">
          <h3 className="yds-perf-val__h3">패닉강도 · 성공률</h3>
          {pattern.panicBands.map((g) => (
            <PatternBucketRow key={g.id} item={g} />
          ))}
        </div>
      </div>
    </section>
  )
}

function ReliabilityAuditPanel({ report }) {
  if (!isReliabilityPanelVisible(report)) return null

  return (
    <section className="yds-perf-val__section yds-perf-val__audit" aria-labelledby="perf-val-audit">
      <div className="yds-perf-val__audit-head">
        <div>
          <p className="yds-perf-val__pattern-kicker">Data Integrity · 7일만</p>
          <h2 id="perf-val-audit" className="yds-perf-val__h2">
            성과 데이터 신뢰도 검증
          </h2>
          <p className="yds-perf-val__pattern-lede">
            추천가·7일 가격·수익률·성공판정을 저장값과 재계산으로 대조 · 14/30일 제외
          </p>
        </div>
        {report.trustPct != null ? (
          <div className="yds-perf-val__audit-trust">
            <span className="yds-perf-val__audit-trust-label">신뢰도</span>
            <strong className="yds-perf-val__audit-trust-val font-mono tabular-nums">
              {report.trustPct}%
            </strong>
          </div>
        ) : null}
      </div>

      <div className="yds-perf-val__audit-stats">
        <StatCard label="7일 잠금 n" value={String(report.totalWithD7)} />
        <StatCard label="가격 정합" value={`${report.priceOkCount}/${report.totalWithD7}`} />
        <StatCard label="수익률 일치" value={`${report.returnMatchCount}/${report.totalWithD7}`} />
        <StatCard label="판정 일치" value={`${report.outcomeMatchCount}/${report.totalWithD7}`} />
      </div>

      {report.samples.length ? (
        <div className="yds-perf-val__audit-table-wrap">
          <table className="yds-perf-val__audit-table">
            <thead>
              <tr>
                <th>종목</th>
                <th>추천가</th>
                <th>7일가</th>
                <th>계산</th>
                <th>시스템</th>
                <th>판정</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {report.samples.map((row) => (
                <tr
                  key={row.id}
                  className={row.trusted ? "" : "yds-perf-val__audit-row--warn"}
                >
                  <td>
                    <span className="yds-perf-val__audit-name">{row.name}</span>
                    <span className="yds-perf-val__audit-date font-mono tabular-nums">
                      {row.recommendedAt}
                    </span>
                  </td>
                  <td className="font-mono tabular-nums">{formatPerfPrice(row.recommendPrice)}</td>
                  <td className="font-mono tabular-nums">{formatPerfPrice(row.priceD7)}</td>
                  <td className="font-mono tabular-nums">{formatPerfPct(row.calcReturn)}</td>
                  <td className="font-mono tabular-nums">{formatPerfPct(row.systemReturn)}</td>
                  <td>{row.outcomeLabel}</td>
                  <td>
                    <span
                      className={
                        row.trusted
                          ? "yds-perf-val__audit-ok"
                          : "yds-perf-val__audit-warn"
                      }
                    >
                      {row.trusted ? "일치" : "불일치"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="yds-perf-val__pattern-empty">
          7일 수익률이 잠긴 추천이 없습니다. 며칠 후 자동 검증이 가능합니다.
        </p>
      )}
    </section>
  )
}

function ScoreCorrelationPanel({ report }) {
  if (!isScoreCorrelationPanelVisible(report)) return null

  return (
    <section className="yds-perf-val__section yds-perf-val__score-corr" aria-labelledby="perf-val-score">
      <div className="yds-perf-val__audit-head">
        <div>
          <p className="yds-perf-val__pattern-kicker">Score vs Return · 7일 실측</p>
          <h2 id="perf-val-score" className="yds-perf-val__h2">
            추천 점수 · 실제 성과 상관
          </h2>
          <p className="yds-perf-val__pattern-lede">
            추천 당시 잠금 총점 구간별 승률·평균수익 · 저장 데이터만 사용
          </p>
        </div>
        <div className="yds-perf-val__score-corr-r">
          <span className="yds-perf-val__score-corr-r-label">상관계수 r</span>
          <strong className="yds-perf-val__score-corr-r-val font-mono tabular-nums">
            {report.correlation != null ? report.correlation : "—"}
          </strong>
          <span className="yds-perf-val__score-corr-r-sub">{report.correlationLabel}</span>
        </div>
      </div>

      <p className="yds-perf-val__note">분석 표본 n={report.total} · {report.horizonLabel} 잠금 수익률</p>

      <div className="yds-perf-val__score-corr-grid">
        {report.buckets.map((b) => (
          <article
            key={b.id}
            className={`yds-perf-val__score-corr-card ${b.count ? "" : "yds-perf-val__score-corr-card--empty"}`}
          >
            <span className="yds-perf-val__score-corr-band font-mono tabular-nums">{b.label}</span>
            <span className="yds-perf-val__score-corr-meta font-mono tabular-nums">n={b.count}</span>
            <strong className="yds-perf-val__score-corr-win font-mono tabular-nums">
              {b.count ? `승률 ${b.winRate}%` : "—"}
            </strong>
            <span
              className={`yds-perf-val__score-corr-avg font-mono tabular-nums ${
                b.avgReturn != null && b.avgReturn >= 0
                  ? "yds-perf-val__score-corr-avg--up"
                  : b.avgReturn != null
                    ? "yds-perf-val__score-corr-avg--down"
                    : ""
              }`}
            >
              {b.count ? `평균 ${formatPerfPct(b.avgReturn)}` : "데이터 없음"}
            </span>
          </article>
        ))}
      </div>
    </section>
  )
}

function ComponentContributionPanel({ report }) {
  if (!isComponentContributionPanelVisible(report)) return null

  return (
    <section className="yds-perf-val__section yds-perf-val__contrib" aria-labelledby="perf-val-contrib">
      <p className="yds-perf-val__pattern-kicker">Component Impact · 7일 실측</p>
      <h2 id="perf-val-contrib" className="yds-perf-val__h2">
        점수 구성요소 기여도
      </h2>
      <p className="yds-perf-val__pattern-lede">
        기업품질·타이밍·시장적합 등급별 승률·평균수익 · 요소별 상관계수 순위
      </p>

      {report.ranking.length ? (
        <ol className="yds-perf-val__contrib-rank">
          {report.ranking.map((r) => (
            <li key={r.id} className="yds-perf-val__contrib-rank-item">
              <span className="yds-perf-val__contrib-rank-pos font-mono tabular-nums">{r.rank}위</span>
              <span className="yds-perf-val__contrib-rank-label">{r.label}</span>
              <strong className="yds-perf-val__contrib-rank-r font-mono tabular-nums">
                r={r.correlation}
              </strong>
            </li>
          ))}
        </ol>
      ) : null}

      <div className="yds-perf-val__contrib-grid">
        {report.components.map((comp) => (
          <div key={comp.id} className="yds-perf-val__contrib-block">
            <h3 className="yds-perf-val__h3">
              {comp.label}
              {comp.correlation != null ? (
                <span className="yds-perf-val__contrib-r font-mono tabular-nums"> r={comp.correlation}</span>
              ) : null}
            </h3>
            {comp.grades
              .filter((g) => g.count > 0)
              .map((g) => (
              <div key={g.grade} className="yds-perf-val__contrib-row">
                <span className="yds-perf-val__contrib-grade">{g.label}</span>
                <span className="yds-perf-val__contrib-meta font-mono tabular-nums">n={g.count}</span>
                <span className="yds-perf-val__contrib-win font-mono tabular-nums">
                  {g.count ? `승률 ${g.winRate}%` : "—"}
                </span>
                <span
                  className={`yds-perf-val__contrib-avg font-mono tabular-nums ${
                    g.avgReturn != null && g.avgReturn >= 0
                      ? "yds-perf-val__score-corr-avg--up"
                      : g.avgReturn != null
                        ? "yds-perf-val__score-corr-avg--down"
                        : ""
                  }`}
                >
                  {g.count ? formatPerfPct(g.avgReturn) : "—"}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

function PanicDeepPanel({ report }) {
  if (!isPanicDeepPanelVisible(report)) return null

  const zones = report.zones.filter((z) => z.count > 0)

  return (
    <section className="yds-perf-val__section yds-perf-val__panic-deep" aria-labelledby="perf-val-panic">
      <p className="yds-perf-val__pattern-kicker">Panic Zones · 7일 실측</p>
      <h2 id="perf-val-panic" className="yds-perf-val__h2">
        패닉지수 구간별 성과
      </h2>
      <p className="yds-perf-val__note">추천 당시 잠금 패닉강도 · n={report.total}</p>
      <div className="yds-perf-val__panic-deep-grid">
        {zones.map((z) => (
          <article
            key={z.id}
            className={`yds-perf-val__panic-deep-card ${z.count ? "" : "yds-perf-val__score-corr-card--empty"}`}
          >
            <span className="yds-perf-val__panic-deep-label">{z.panicLabel}</span>
            <span className="yds-perf-val__score-corr-meta font-mono tabular-nums">n={z.count}</span>
            <strong className="yds-perf-val__score-corr-win font-mono tabular-nums">
              {z.count ? `승률 ${z.winRate}%` : "—"}
            </strong>
            <span
              className={`yds-perf-val__score-corr-avg font-mono tabular-nums ${
                z.avgReturn != null && z.avgReturn >= 0
                  ? "yds-perf-val__score-corr-avg--up"
                  : z.avgReturn != null
                    ? "yds-perf-val__score-corr-avg--down"
                    : ""
              }`}
            >
              {z.count ? `평균 ${formatPerfPct(z.avgReturn)}` : "—"}
            </span>
            {z.count ? (
              <span className="yds-perf-val__panic-deep-range font-mono tabular-nums">
                최대 {formatPerfPct(z.maxGain)} · 최소 {formatPerfPct(z.maxLoss)}
              </span>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}

function MarketStateStrategyPanel({ report }) {
  if (!isMarketStrategyPanelVisible(report)) return null

  const strategies = report.strategies.filter((s) => s.count > 0)

  return (
    <section className="yds-perf-val__section yds-perf-val__mkt-strat" aria-labelledby="perf-val-mkt">
      <p className="yds-perf-val__pattern-kicker">Market Regime · 7일 실측</p>
      <h2 id="perf-val-mkt" className="yds-perf-val__h2">
        시장상태별 투자전략 검증
      </h2>
      <p className="yds-perf-val__note">추천 당시 잠금 시장상태 · n={report.total}</p>

      <div className="yds-perf-val__mkt-strat-grid">
        {strategies.map((s) => (
          <article key={s.id} className="yds-perf-val__mkt-strat-card">
            <h3 className="yds-perf-val__h3">{s.label}</h3>
            <p className="yds-perf-val__mkt-strat-meta font-mono tabular-nums">
              n={s.count}
              {s.count ? ` · 승률 ${s.winRate}% · 평균 ${formatPerfPct(s.avgReturn)}` : ""}
            </p>
            {s.best ? (
              <p className="yds-perf-val__mkt-strat-extreme yds-perf-val__mkt-strat-extreme--up">
                최고 {s.best.name} {formatPerfPct(s.best.returnPct)}
              </p>
            ) : null}
            {s.worst ? (
              <p className="yds-perf-val__mkt-strat-extreme yds-perf-val__mkt-strat-extreme--down">
                최악 {s.worst.name} {formatPerfPct(s.worst.returnPct)}
              </p>
            ) : null}
          </article>
        ))}
      </div>

      {report.detailStates.length ? (
        <details className="yds-perf-val__mkt-strat-detail">
          <summary className="yds-perf-val__mkt-strat-summary">세부 시장상태</summary>
          <div className="yds-perf-val__mkt-strat-detail-grid">
            {report.detailStates.map((s) => (
              <div key={s.id} className="yds-perf-val__mkt-strat-detail-row">
                <span className="yds-perf-val__mkt-strat-detail-label">{s.stateLabel}</span>
                <span className="font-mono tabular-nums">
                  n={s.count} · 승률 {s.winRate ?? "—"}% · {formatPerfPct(s.avgReturn)}
                </span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
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
          <span className="yds-perf-val__snap-chip">품질 {formatSnapshotGradeCell(snap, "quality")}</span>
        ) : null}
        {snap.timingGrade !== "—" ? (
          <span className="yds-perf-val__snap-chip">타이밍 {formatSnapshotGradeCell(snap, "timing")}</span>
        ) : null}
        {snap.marketFitGrade !== "—" ? (
          <span className="yds-perf-val__snap-chip">시장적합 {formatSnapshotGradeCell(snap, "marketFit")}</span>
        ) : null}
        {snap.recommendedPrice != null ? (
          <span className="yds-perf-val__snap-chip font-mono tabular-nums">
            추천가 {formatPerfPrice(snap.recommendedPrice)}
          </span>
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
            const display = pickDisplayFieldsFromSnapshot(row)
            return (
            <tr key={row.id}>
              <td>{i + 1}</td>
              <td className="font-mono tabular-nums">{display.recommendedAt}</td>
              <td>
                <Link to={`/stock-picks/${encodeURIComponent(row.ticker)}`} className="yds-perf-val__link">
                  {display.name}
                </Link>
                <span className="yds-perf-val__ticker font-mono">{row.ticker}</span>
                <PickRecommendSnapshot row={row} horizon7Pct={row.horizons?.d7} />
              </td>
              <td className="font-mono tabular-nums">{formatSnapshotTotalScore(snap)}</td>
              <td>{formatSnapshotGradeCell(snap, "quality")}</td>
              <td>{formatSnapshotGradeCell(snap, "timing")}</td>
              <td>{formatSnapshotGradeCell(snap, "marketFit")}</td>
              <td>{snap?.marketStateLabel ?? "—"}</td>
              <td>{snap?.panicLabel ?? "—"}</td>
              <td className="font-mono tabular-nums">{formatPerfPrice(display.recommendedPrice)}</td>
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

  const [patternHorizon, setPatternHorizon] = useState("d7")
  const [outcomeHorizon, setOutcomeHorizon] = useState("d7")

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
  const pattern = useMemo(
    () => buildSuccessPatternReport(picks, patternHorizon),
    [picks, patternHorizon],
  )
  const outcomeSummary = useMemo(
    () => buildOutcomeSummaryReport(picks, outcomeHorizon),
    [picks, outcomeHorizon],
  )
  const reliability = useMemo(() => buildReliabilityAuditReport(picks), [picks])
  const scoreCorrelation = useMemo(() => buildScoreCorrelationReport(picks), [picks])
  const componentContribution = useMemo(() => buildComponentContributionReport(picks), [picks])
  const panicDeep = useMemo(() => buildPanicDeepAnalysisReport(picks), [picks])
  const marketStrategy = useMemo(() => buildMarketStateStrategyReport(picks), [picks])
  const horizonAvailability = useMemo(() => buildHorizonAvailability(picks), [picks])

  useEffect(() => {
    const next = resolveDefaultHorizon(horizonAvailability, patternHorizon)
    if (next !== patternHorizon) setPatternHorizon(next)
  }, [horizonAvailability, patternHorizon])

  useEffect(() => {
    const next = resolveDefaultHorizon(horizonAvailability, outcomeHorizon)
    if (next !== outcomeHorizon) setOutcomeHorizon(next)
  }, [horizonAvailability, outcomeHorizon])

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
          <OutcomeVerdictPanel
            summary={outcomeSummary}
            horizonKey={outcomeHorizon}
            onHorizonChange={setOutcomeHorizon}
            horizonAvailability={horizonAvailability}
          />

          <ReliabilityAuditPanel report={reliability} />

          <ScoreCorrelationPanel report={scoreCorrelation} />

          <ComponentContributionPanel report={componentContribution} />

          <PanicDeepPanel report={panicDeep} />

          <MarketStateStrategyPanel report={marketStrategy} />

          <SuccessPatternPanel
            pattern={pattern}
            horizonKey={patternHorizon}
            onHorizonChange={setPatternHorizon}
            horizonAvailability={horizonAvailability}
          />

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
              추천 생성 시 점수·등급·시장상태·패닉강도를 `recommendSnapshot`에 잠금 저장합니다. refresh·재계산 시
              현재 점수를 사용하지 않으며, 추천 당시 스냅샷만 표시·분석합니다.
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
                    <th>7일 판정</th>
                    <th>14일%</th>
                    <th>14일 판정</th>
                    <th>30일%</th>
                    <th>30일 판정</th>
                  </tr>
                </thead>
                <tbody>
                  {report.picks.map((row) => {
                    const snap = getRecommendSnapshot(row)
                    const display = pickDisplayFieldsFromSnapshot(row)
                    return (
                    <tr key={row.id}>
                      <td className="font-mono tabular-nums">{display.recommendedAt}</td>
                      <td>
                        <span className="yds-perf-val__pick-name">{display.name}</span>
                        <PickRecommendSnapshot row={row} horizon7Pct={row.horizons?.d7} />
                      </td>
                      <td className="font-mono tabular-nums">{formatSnapshotTotalScore(snap)}</td>
                      <td>{formatSnapshotGradeCell(snap, "quality")}</td>
                      <td>{formatSnapshotGradeCell(snap, "timing")}</td>
                      <td>{formatSnapshotGradeCell(snap, "marketFit")}</td>
                      <td>{snap?.marketStateLabel ?? "—"}</td>
                      <td>{snap?.panicLabel ?? "—"}</td>
                      <td className="font-mono tabular-nums">{formatPerfPrice(display.recommendedPrice)}</td>
                      <td className="font-mono tabular-nums">{formatPerfPrice(row.horizonPrices?.d7)}</td>
                      <td className="font-mono tabular-nums">{formatPerfPrice(row.horizonPrices?.d14)}</td>
                      <td className="font-mono tabular-nums">{formatPerfPrice(row.horizonPrices?.d30)}</td>
                      <td className="font-mono tabular-nums">{formatPerfPct(row.horizons?.d7)}</td>
                      <td><OutcomeBadge returnPct={row.horizons?.d7} /></td>
                      <td className="font-mono tabular-nums">{formatPerfPct(row.horizons?.d14)}</td>
                      <td><OutcomeBadge returnPct={row.horizons?.d14} /></td>
                      <td className="font-mono tabular-nums">{formatPerfPct(row.horizons?.d30)}</td>
                      <td><OutcomeBadge returnPct={row.horizons?.d30} /></td>
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
