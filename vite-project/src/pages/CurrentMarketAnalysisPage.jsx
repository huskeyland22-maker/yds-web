import { useMemo } from "react"
import { Link } from "react-router-dom"
import { useAppDataStore } from "../store/appDataStore.js"
import { panicDataFromCycleRow, mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildCurrentMarketAnalysisReport,
  formatAnalysisPct,
  CURRENT_MARKET_ANALYSIS_LABEL,
} from "../trading-zone/ydsCurrentMarketAnalysis.js"

export default function CurrentMarketAnalysisPage() {
  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)
  const history = useMemo(
    () => resolveCycleHistoryRows(mergeCycleRows(storeRows ?? [], [])),
    [storeRows],
  )
  const latestCycleRow = history[history.length - 1] ?? null

  const latestSnapshot = useMemo(() => {
    if (!latestCycleRow) return null
    const panic = panicDataFromCycleRow(latestCycleRow)
    if (panic) return { ...latestCycleRow, ...panic, date: latestCycleRow.date ?? panic.updatedAt }
    return latestCycleRow
  }, [latestCycleRow])

  const report = useMemo(
    () =>
      buildCurrentMarketAnalysisReport(YDS_VALIDATION_EVENT_DATASET, {
        latestSnapshot,
        extraRows: history,
      }),
    [latestSnapshot, history],
  )

  const {
    asOf,
    hasLive,
    actionStageHero,
    marketEnvironment,
    actionGuide,
    portfolio,
    expectedReturns,
  } = report

  return (
    <div className="yds-market-analysis min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-market-analysis__header">
        <div>
          <h1 className="yds-market-analysis__title">{CURRENT_MARKET_ANALYSIS_LABEL}</h1>
          <p className="yds-market-analysis__sub">
            {hasLive && asOf ? `기준 ${String(asOf).slice(0, 10)}` : "시장 데이터 동기화 중"}
          </p>
        </div>
        <Link to="/lab" className="yds-market-analysis__lab-link">
          연구실
        </Link>
      </header>

      <section
        className={[
          "yds-market-analysis__action-hero",
          actionStageHero.id ? `yds-market-analysis__action-hero--${actionStageHero.id}` : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ "--stage-color": actionStageHero.color }}
        aria-label="현재 행동 단계"
      >
        <p className="yds-market-analysis__action-hero-kicker">{actionStageHero.kicker}</p>
        <p className="yds-market-analysis__action-hero-stage">
          <span className="yds-market-analysis__action-hero-emoji" aria-hidden>
            {actionStageHero.emoji}
          </span>
          {actionStageHero.shortLabel}
        </p>
        <p className="yds-market-analysis__action-hero-desc">{actionStageHero.description}</p>
      </section>

      <section className="yds-market-analysis__env" aria-label="시장 환경">
        <div className="yds-market-analysis__env-head">
          <h2 className="yds-market-analysis__section-title">{marketEnvironment.title}</h2>
          <span className="yds-market-analysis__env-kicker">{marketEnvironment.kicker}</span>
        </div>
        <p className="yds-market-analysis__env-philosophy">{marketEnvironment.philosophyNote}</p>
        <div className="yds-market-analysis__env-grid">
          <div className="yds-market-analysis__env-row">
            <span className="yds-market-analysis__env-key">시장 환경</span>
            <strong
              className={[
                "yds-market-analysis__env-val",
                "yds-market-analysis__env-val--level",
                marketEnvironment.marketCondition.levelId
                  ? `yds-market-analysis__env-val--${marketEnvironment.marketCondition.levelId}`
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              title={marketEnvironment.marketCondition.fullLabel}
            >
              {marketEnvironment.marketCondition.emoji}{" "}
              {marketEnvironment.marketCondition.label}
            </strong>
          </div>
          <div className="yds-market-analysis__env-row yds-market-analysis__env-row--desc">
            <span className="yds-market-analysis__env-key" />
            <span className="yds-market-analysis__env-desc">
              {marketEnvironment.marketCondition.description}
            </span>
          </div>
          <div className="yds-market-analysis__env-row">
            <span className="yds-market-analysis__env-key">YDS 점수</span>
            <strong className="yds-market-analysis__env-val">{marketEnvironment.ydsDisplay}</strong>
          </div>
          {marketEnvironment.bullSimilarity != null ? (
            <div className="yds-market-analysis__env-row">
              <span className="yds-market-analysis__env-key">강세장 유사도</span>
              <strong className="yds-market-analysis__env-val">
                {marketEnvironment.bullSimilarity}%
              </strong>
            </div>
          ) : null}
          <div className="yds-market-analysis__env-row">
            <span className="yds-market-analysis__env-key">신뢰도</span>
            <strong className="yds-market-analysis__env-val">
              {marketEnvironment.confidenceScore ?? "—"}%
            </strong>
          </div>
        </div>
        <p className="yds-market-analysis__env-contrast">{marketEnvironment.contrastNote}</p>
        <p className="yds-market-analysis__env-summary">{marketEnvironment.similarSummary}</p>
        {marketEnvironment.positionHint ? (
          <p className="yds-market-analysis__env-hint">{marketEnvironment.positionHint}</p>
        ) : null}
      </section>

      <section className="yds-market-analysis__block" aria-label="행동 가이드">
        <h2 className="yds-market-analysis__section-title">행동 가이드</h2>
        <p className="yds-market-analysis__section-sub">
          YDS 5단계 · 현재 위치 · 권장 비중 (주식% / 현금%)
        </p>
        <div className="yds-market-analysis__ladder" role="list">
          {actionGuide.stageLadder.map((step) => (
            <div
              key={step.id}
              role="listitem"
              className={[
                "yds-market-analysis__ladder-step",
                step.active ? "yds-market-analysis__ladder-step--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ "--stage-color": step.color }}
            >
              <span className="yds-market-analysis__ladder-emoji">{step.emoji}</span>
              <span className="yds-market-analysis__ladder-label">{step.shortLabel}</span>
              {step.stockPct != null && step.cashPct != null ? (
                <span className="yds-market-analysis__ladder-split font-mono tabular-nums">
                  {step.stockPct} / {step.cashPct}
                </span>
              ) : null}
              {step.active ? (
                <span className="yds-market-analysis__ladder-current">현재</span>
              ) : null}
            </div>
          ))}
        </div>
        <p className="yds-market-analysis__ladder-foot">
          패닉이 깊어질수록 주식 비중을 높이고, 과열·중립 구간에서 현금을 모아 패닉매수에 투입합니다.
        </p>
      </section>

      <section className="yds-market-analysis__block" aria-label="권장 포트폴리오">
        <h2 className="yds-market-analysis__section-title">{portfolio.title}</h2>
        {portfolio.available && portfolio.stage && portfolio.allocation ? (
          <article
            className={[
              "yds-market-analysis__portfolio-card",
              `yds-market-analysis__portfolio-card--${portfolio.stage.id}`,
            ].join(" ")}
            style={{ "--stage-color": portfolio.stage.color }}
          >
            <div className="yds-market-analysis__portfolio-row">
              <span className="yds-market-analysis__portfolio-key">권장 비중</span>
              <div className="yds-market-analysis__portfolio-split">
                <strong>{portfolio.allocation.stockLabel}</strong>
                <strong>{portfolio.allocation.cashLabel}</strong>
              </div>
            </div>
            <div
              className="yds-market-analysis__portfolio-bar"
              role="img"
              aria-label={`주식 ${portfolio.allocation.stockPct}% 현금 ${portfolio.allocation.cashPct}%`}
            >
              <span
                className="yds-market-analysis__portfolio-bar-stock"
                style={{ width: `${portfolio.allocation.stockPct}%` }}
              />
              <span
                className="yds-market-analysis__portfolio-bar-cash"
                style={{ width: `${portfolio.allocation.cashPct}%` }}
              />
            </div>
            <p className="yds-market-analysis__portfolio-desc">{portfolio.description}</p>
          </article>
        ) : (
          <p className="yds-market-analysis__empty">{portfolio.description}</p>
        )}
      </section>

      <section className="yds-market-analysis__block" aria-label="기대 수익률">
        <h2 className="yds-market-analysis__section-title">기대 수익률</h2>
        <p className="yds-market-analysis__section-sub">유사 사례 Top 3 · 역사적 S&P500 추정</p>
        <div className="yds-market-analysis__returns-grid">
          {expectedReturns.map((h) => (
            <article key={h.horizon} className="yds-market-analysis__returns-card">
              <span className="yds-market-analysis__returns-horizon">{h.label}</span>
              <div className="yds-market-analysis__returns-row">
                <span>평균 수익률</span>
                <strong>{formatAnalysisPct(h.avgReturn)}</strong>
              </div>
              <div className="yds-market-analysis__returns-row">
                <span>승률</span>
                <strong>{formatAnalysisPct(h.winRate)}</strong>
              </div>
              <div className="yds-market-analysis__returns-row">
                <span>최대 MDD</span>
                <strong>{formatAnalysisPct(h.maxMdd)}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
