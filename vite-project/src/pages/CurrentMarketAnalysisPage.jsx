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

/**
 * @param {string} tone
 */
function confidenceToneClass(tone) {
  if (tone === "high" || tone === "good") return "yds-market-analysis__conf--high"
  if (tone === "mid" || tone === "medium") return "yds-market-analysis__conf--mid"
  return "yds-market-analysis__conf--low"
}

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
    headline,
    currentState,
    similarCases,
    positionMapping,
    actionGuide,
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
        className={`yds-market-analysis__hero yds-market-analysis__hero--${headline.regime.regimeId}`}
        aria-label="시장 해석"
      >
        <span className="yds-market-analysis__hero-emoji" aria-hidden>
          {headline.regime.emoji}
        </span>
        <div className="yds-market-analysis__hero-body">
          <p className="yds-market-analysis__hero-kicker">현재 시장 해석</p>
          <p className="yds-market-analysis__hero-regime">{headline.regime.label}</p>
          <p className="yds-market-analysis__hero-text">{headline.interpretation}</p>
          {positionMapping ? (
            <p className="yds-market-analysis__hero-position">
              {positionMapping.eventEmoji} {positionMapping.eventLabel} 타임라인 ·{" "}
              {positionMapping.offsetLabel} · 유사도 {formatAnalysisPct(positionMapping.similarity)}
            </p>
          ) : null}
        </div>
      </section>

      <section className="yds-market-analysis__state" aria-label="현재 시장 상태">
        <h2 className="yds-market-analysis__section-title">현재 시장 상태</h2>
        <div className="yds-market-analysis__state-grid">
          <article className="yds-market-analysis__state-card">
            <span className="yds-market-analysis__state-key">현재 YDS</span>
            <strong className="yds-market-analysis__state-val yds-market-analysis__state-val--yds">
              {currentState.yds.display}
            </strong>
          </article>
          <article className="yds-market-analysis__state-card">
            <span className="yds-market-analysis__state-key">현재 단계</span>
            <strong className="yds-market-analysis__state-val">
              {currentState.yds.stage
                ? `${currentState.yds.stage.emoji} ${currentState.yds.stage.label}`
                : "—"}
            </strong>
          </article>
          <article className="yds-market-analysis__state-card">
            <span className="yds-market-analysis__state-key">위험도</span>
            <strong className="yds-market-analysis__state-val">
              {currentState.risk.emoji} {currentState.risk.label}
            </strong>
          </article>
          <article
            className={[
              "yds-market-analysis__state-card",
              confidenceToneClass(currentState.confidence.tone),
            ].join(" ")}
          >
            <span className="yds-market-analysis__state-key">신뢰도</span>
            <strong className="yds-market-analysis__state-val">
              {currentState.confidence.score ?? "—"} · {currentState.confidence.label}
            </strong>
          </article>
        </div>
      </section>

      <section className="yds-market-analysis__block" aria-label="유사 과거 사례">
        <h2 className="yds-market-analysis__section-title">유사 과거 사례</h2>
        {!hasLive ? (
          <p className="yds-market-analysis__empty">패닉 허브 데이터 동기화 후 표시됩니다.</p>
        ) : (
          <ol className="yds-market-analysis__similar-list">
            {similarCases.map((c) => (
              <li key={c.eventId}>
                <span className="yds-market-analysis__medal" aria-hidden>
                  {c.medal}
                </span>
                <div className="yds-market-analysis__similar-body">
                  <strong>
                    {c.emoji} {c.name}
                  </strong>
                  <span>유사도 {formatAnalysisPct(c.similarity)}</span>
                  <span className="yds-market-analysis__similar-stage">
                    당시 {c.timelineLabel} · {c.historicalStageLabel}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="yds-market-analysis__block" aria-label="행동 가이드">
        <h2 className="yds-market-analysis__section-title">행동 가이드</h2>
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
            </div>
          ))}
        </div>
        <p className="yds-market-analysis__action-oneliner">{actionGuide.oneLiner}</p>
        <p className="yds-market-analysis__action-rec">
          추천: {actionGuide.recommended.allocation}
        </p>
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
