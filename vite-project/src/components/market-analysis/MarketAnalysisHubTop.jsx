import { Link } from "react-router-dom"
import { buildMarketHubTopViewModel } from "../../utils/ydsMarketHubPresentation.js"
import { formatSectorRadarScore } from "../../trading-zone/ydsPrecursorEnginePhase25.js"
import { formatStockRadarScore } from "../../trading-zone/ydsPrecursorEnginePhase26.js"
import ConfidenceBadge from "../trust/ConfidenceBadge.jsx"
import WhyExplainButton from "../trust/WhyExplainButton.jsx"
import YdsV1ReleaseBadge from "../trust/YdsV1ReleaseBadge.jsx"

/**
 * @param {{
 *   report: ReturnType<typeof import("../../trading-zone/ydsCurrentMarketAnalysis.js").buildCurrentMarketAnalysisReport>
 *   simplified?: boolean
 * }} props
 */
export default function MarketAnalysisHubTop({ report, simplified = false }) {
  const hub = buildMarketHubTopViewModel(report)
  if (!hub.available) {
    return <p className="yds-market-analysis__empty">시장분석 데이터를 불러오는 중입니다.</p>
  }

  const { stage, allocation } = hub
  const stockPct = allocation.stockPct ?? 0
  const cashPct = allocation.cashPct ?? 100

  if (simplified) {
    return (
      <div className="yds-hub-top yds-hub-top--simple" aria-label="시장분석 첫 화면">
        <section
          className={[
            "yds-hub-top__card yds-hub-top__card--stage",
            stage.id ? `yds-hub-top__card--${stage.id}` : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ "--stage-color": stage.color }}
        >
          <h2 className="yds-hub-top__h2">현재 시장</h2>
          <p className="yds-hub-top__stage-main">
            <span aria-hidden>{stage.emoji}</span> {stage.shortLabel}
          </p>
          <p className="yds-hub-top__simple-pos font-mono tabular-nums">
            시장 위치 {hub.marketPosition.display}
          </p>
        </section>

        <section className="yds-hub-top__card">
          <h2 className="yds-hub-top__h2">추천 행동</h2>
          <p className="yds-hub-top__action">{hub.recommendedAction}</p>
        </section>

        <section className="yds-hub-top__card">
          <h2 className="yds-hub-top__h2">추천 섹터</h2>
          {hub.hasSectors ? (
            <ol className="yds-hub-top__list">
              {hub.topSectors.map((s) => (
                <li key={s.id}>
                  <span className="font-mono">{s.rank}</span>
                  <span>{s.label}</span>
                  <span className="font-mono tabular-nums">{formatSectorRadarScore(s.score)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="yds-hub-top__muted">—</p>
          )}
        </section>

        <section className="yds-hub-top__card">
          <h2 className="yds-hub-top__h2">추천 종목</h2>
          {hub.hasStocks ? (
            <ol className="yds-hub-top__list">
              {hub.topStocks.map((s) => (
                <li key={s.id}>
                  <span className="font-mono">{s.rank}</span>
                  <span>{s.name}</span>
                  <span className="font-mono tabular-nums">{formatStockRadarScore(s.score)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="yds-hub-top__muted">—</p>
          )}
        </section>
      </div>
    )
  }

  return (
    <div className="yds-hub-top" aria-label="시장분석 Hub">
      <div className="yds-hub-top__head">
        <YdsV1ReleaseBadge />
        <ConfidenceBadge
          level={hub.confidence.level}
          tone={hub.confidence.tone}
          score={hub.confidenceScore}
        />
        <Link to="/glossary" className="yds-hub-top__glossary-link">
          용어 설명
        </Link>
      </div>

      <section
        className={[
          "yds-hub-top__card yds-hub-top__card--stage",
          stage.id ? `yds-hub-top__card--${stage.id}` : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ "--stage-color": stage.color }}
      >
        <div className="yds-hub-top__card-head">
          <h2 className="yds-hub-top__h2">현재 단계</h2>
        </div>
        <p className="yds-hub-top__stage-main">
          <span aria-hidden>{stage.emoji}</span> {stage.shortLabel}
        </p>
        <p className="yds-hub-top__stage-desc">{stage.description}</p>
      </section>

      <section className="yds-hub-top__card">
        <div className="yds-hub-top__card-head">
          <h2 className="yds-hub-top__h2">시장 위치</h2>
          <WhyExplainButton lines={hub.marketPosition.whyLines} />
        </div>
        <p className="yds-hub-top__score font-mono tabular-nums">{hub.marketPosition.display}</p>
      </section>

      <section className="yds-hub-top__card yds-hub-top__card--interpret">
        <div className="yds-hub-top__card-head">
          <h2 className="yds-hub-top__h2">시장 해석</h2>
          <ConfidenceBadge level={hub.confidence.level} tone={hub.confidence.tone} score={hub.confidenceScore} />
        </div>
        <p className="yds-hub-top__lead">{hub.interpretationLine}</p>
        {hub.interpretationReasons.length ? (
          <ul className="yds-hub-top__reasons">
            {hub.interpretationReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="yds-hub-top__card">
        <div className="yds-hub-top__card-head">
          <h2 className="yds-hub-top__h2">추천 행동</h2>
          <WhyExplainButton lines={hub.actionWhyLines} />
        </div>
        <p className="yds-hub-top__action">{hub.recommendedAction}</p>
      </section>

      <section className="yds-hub-top__card">
        <div className="yds-hub-top__card-head">
          <h2 className="yds-hub-top__h2">권장 비중</h2>
        </div>
        <div className="yds-hub-top__alloc-row">
          <span>주식 {stockPct}%</span>
          <span>현금 {cashPct}%</span>
        </div>
        <div
          className="yds-hub-top__alloc-bar"
          role="img"
          aria-label={`주식 ${stockPct}% 현금 ${cashPct}%`}
        >
          <span style={{ width: `${stockPct}%` }} />
        </div>
      </section>

      <section className="yds-hub-top__card">
        <div className="yds-hub-top__card-head">
          <h2 className="yds-hub-top__h2">추천 섹터</h2>
        </div>
        {hub.hasSectors ? (
          <ol className="yds-hub-top__list">
            {hub.topSectors.map((s) => (
              <li key={s.id}>
                <span className="font-mono">{s.rank}</span>
                <span>{s.label}</span>
                <span className="font-mono tabular-nums">{formatSectorRadarScore(s.score)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="yds-hub-top__muted">—</p>
        )}
      </section>

      <section className="yds-hub-top__card">
        <div className="yds-hub-top__card-head">
          <h2 className="yds-hub-top__h2">추천 종목</h2>
        </div>
        {hub.hasStocks ? (
          <ol className="yds-hub-top__list">
            {hub.topStocks.map((s) => (
              <li key={s.id}>
                <span className="font-mono">{s.rank}</span>
                <span>{s.name}</span>
                <span className="font-mono tabular-nums">{formatStockRadarScore(s.score)}</span>
                <span className="yds-hub-top__muted">{s.status}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="yds-hub-top__muted">—</p>
        )}
        <p className="yds-hub-top__foot">
          <Link to="/watchlist">Watchlist</Link> · <Link to="/alert-center">알림</Link> ·{" "}
          <Link to="/performance-center">성과</Link>
        </p>
      </section>
    </div>
  )
}
