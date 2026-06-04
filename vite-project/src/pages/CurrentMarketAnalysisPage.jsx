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
import { formatSectorRadarScore } from "../trading-zone/ydsPrecursorEnginePhase25.js"
import { formatStockRadarScore } from "../trading-zone/ydsPrecursorEnginePhase26.js"
import { formatEntryRadarScore } from "../trading-zone/ydsPrecursorEnginePhase27.js"
import TradingJournalPanel from "../components/trading/TradingJournalPanel.jsx"
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
    marketBrief,
    marketEnvironment,
    actionGuide,
    portfolio,
    sectorRadar,
    stockRadar,
    entryRadar,
    tradingJournal,
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

      <section
        className="yds-market-analysis__brief"
        style={{ "--stage-color": actionStageHero.color }}
        aria-label={marketBrief.title}
      >
        <h2 className="yds-market-analysis__section-title">{marketBrief.title}</h2>
        <div className="yds-market-analysis__brief-grid">
          {marketBrief.cards.map((card) => (
            <article
              key={card.id}
              className={[
                "yds-market-analysis__brief-card",
                card.tone ? `yds-market-analysis__brief-card--${card.tone}` : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="yds-market-analysis__brief-key">{card.label}</span>
              <strong className="yds-market-analysis__brief-val">{card.value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="yds-market-analysis__env" aria-label="시장 환경">
        <div className="yds-market-analysis__env-head">
          <h2 className="yds-market-analysis__section-title">{marketEnvironment.title}</h2>
          <span className="yds-market-analysis__env-kicker">{marketEnvironment.kicker}</span>
        </div>
        <p className="yds-market-analysis__env-philosophy">{marketEnvironment.philosophyNote}</p>

        <div className="yds-market-analysis__env-body">
          <div
            className="yds-market-analysis__yds-spotlight"
            aria-label={`YDS 점수 ${marketEnvironment.ydsDisplay}`}
          >
            <span className="yds-market-analysis__yds-spotlight-kicker">YDS SCORE</span>
            <span className="yds-market-analysis__yds-spotlight-value font-mono tabular-nums">
              {marketEnvironment.ydsDisplay}
            </span>
          </div>

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
        </div>

        {marketEnvironment.similarCaseCards?.length ? (
          <div className="yds-market-analysis__similar-strip" aria-label="유사 사례">
            <span className="yds-market-analysis__similar-strip-label">유사 사례</span>
            <div className="yds-market-analysis__similar-cards">
              {marketEnvironment.similarCaseCards.map((c) => (
                <article key={c.rank} className="yds-market-analysis__similar-card">
                  <span className="yds-market-analysis__similar-badge" aria-hidden>
                    {c.badge}
                  </span>
                  <span className="yds-market-analysis__similar-name">
                    {c.emoji} {c.name}
                  </span>
                  <strong className="yds-market-analysis__similar-pct font-mono tabular-nums">
                    {c.similarityDisplay}
                  </strong>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        <p className="yds-market-analysis__env-contrast">{marketEnvironment.contrastNote}</p>
        {marketEnvironment.positionHint ? (
          <p className="yds-market-analysis__env-hint">{marketEnvironment.positionHint}</p>
        ) : null}
      </section>

      <section className="yds-market-analysis__block" aria-label="행동 가이드">
        <h2 className="yds-market-analysis__section-title">행동 가이드</h2>
        <p className="yds-market-analysis__section-sub">
          YDS 5단계 · 현재 위치 · 권장 비중
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
                <div
                  className="yds-market-analysis__ladder-alloc"
                  aria-label={`주식 ${step.stockPct}% 현금 ${step.cashPct}%`}
                >
                  <div className="yds-market-analysis__ladder-alloc-col">
                    <span className="yds-market-analysis__ladder-alloc-pct font-mono tabular-nums">
                      {step.stockPct}%
                    </span>
                    <span className="yds-market-analysis__ladder-alloc-label">주식</span>
                  </div>
                  <div className="yds-market-analysis__ladder-alloc-col">
                    <span className="yds-market-analysis__ladder-alloc-pct font-mono tabular-nums">
                      {step.cashPct}%
                    </span>
                    <span className="yds-market-analysis__ladder-alloc-label">현금</span>
                  </div>
                </div>
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

      <section className="yds-market-analysis__block yds-market-analysis__sector-radar" aria-label="Sector Radar">
        <h2 className="yds-market-analysis__section-title">추천 섹터</h2>
        <p className="yds-market-analysis__section-sub">Sector Radar · YDS 단계·국면·패턴 집약</p>
        {sectorRadar.available ? (
          <>
            <div className="yds-market-analysis__sector-market">
              <span className="yds-market-analysis__sector-market-key">현재 시장</span>
              <strong>{sectorRadar.currentMarket.display}</strong>
            </div>
            {sectorRadar.stagePolicy ? (
              <p className="yds-market-analysis__sector-policy">{sectorRadar.stagePolicy.display}</p>
            ) : null}
            <ol className="yds-market-analysis__sector-rank">
              {sectorRadar.topSectors.map((s) => (
                <li key={s.id}>
                  <span className="yds-market-analysis__sector-rank-n">{s.rank}위</span>
                  <span className="yds-market-analysis__sector-rank-label">{s.label}</span>
                  <span className="yds-market-analysis__sector-rank-score font-mono tabular-nums">
                    점수 {formatSectorRadarScore(s.score)}
                  </span>
                </li>
              ))}
            </ol>
            <div className="yds-market-analysis__sector-status">
              <article className="yds-market-analysis__sector-status-card yds-market-analysis__sector-status-card--strong">
                <span>
                  {sectorRadar.sectorStatus.strong.emoji} {sectorRadar.sectorStatus.strong.title}
                </span>
                <p>{sectorRadar.sectorStatus.strong.labels.join(" · ")}</p>
              </article>
              <article className="yds-market-analysis__sector-status-card yds-market-analysis__sector-status-card--weak">
                <span>
                  {sectorRadar.sectorStatus.weak.emoji} {sectorRadar.sectorStatus.weak.title}
                </span>
                <p>{sectorRadar.sectorStatus.weak.labels.join(" · ")}</p>
              </article>
            </div>
          </>
        ) : (
          <p className="yds-market-analysis__empty">섹터 추천을 산출할 수 없습니다.</p>
        )}
      </section>

      <section className="yds-market-analysis__block yds-market-analysis__stock-radar" aria-label="Stock Radar">
        <h2 className="yds-market-analysis__section-title">매수 후보</h2>
        <p className="yds-market-analysis__section-sub">
          Stock Radar · {stockRadar.scoreWeightsDisplay}
        </p>
        {stockRadar.available ? (
          <ol className="yds-market-analysis__stock-rank">
            {stockRadar.topBuys.map((s) => (
              <li key={s.id}>
                <span className="yds-market-analysis__stock-rank-n">{s.rank}.</span>
                <span className="yds-market-analysis__stock-rank-name">{s.name}</span>
                <span className="yds-market-analysis__stock-rank-score font-mono tabular-nums">
                  점수 {formatStockRadarScore(s.score)}
                </span>
                <span className="yds-market-analysis__stock-rank-status">{s.status.display}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="yds-market-analysis__empty">매수 후보를 산출할 수 없습니다.</p>
        )}
      </section>

      <section
        className="yds-market-analysis__block yds-market-analysis__entry-radar"
        aria-label="실전 매매 후보"
      >
        <h2 className="yds-market-analysis__section-title">{entryRadar.title}</h2>
        <p className="yds-market-analysis__section-sub">
          Entry Radar · {entryRadar.scoreWeightsDisplay}
        </p>
        {entryRadar.available ? (
          <ul className="yds-market-analysis__entry-list">
            {entryRadar.tradeCandidates.map((c) => (
              <li
                key={c.id}
                className={`yds-market-analysis__entry-card yds-market-analysis__entry-card--${c.grade.id}`}
              >
                <div className="yds-market-analysis__entry-head">
                  <strong className="yds-market-analysis__entry-name">{c.name}</strong>
                  <span className="yds-market-analysis__entry-score font-mono tabular-nums">
                    점수 {formatEntryRadarScore(c.score)}
                  </span>
                </div>
                <div className="yds-market-analysis__entry-meta">
                  <span>{c.status.display}</span>
                  <span className="yds-market-analysis__entry-grade">진입등급 {c.grade.id}</span>
                </div>
                <p className="yds-market-analysis__entry-action">{c.grade.action}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="yds-market-analysis__empty">실전 매매 후보를 산출할 수 없습니다.</p>
        )}
      </section>

      <section
        className="yds-market-analysis__block yds-market-analysis__trading-journal"
        aria-label="트레이드 로그"
      >
        <h2 className="yds-market-analysis__section-title">{tradingJournal.title}</h2>
        <p className="yds-market-analysis__section-sub">
          Trading Journal · Entry Radar 추적 · 최근 20건
        </p>
        <TradingJournalPanel journal={tradingJournal} compact />
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
