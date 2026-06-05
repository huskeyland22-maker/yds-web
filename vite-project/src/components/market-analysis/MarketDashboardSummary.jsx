import { UI_BTN, UI_PAGE } from "../../utils/ydsUiLabels.js"
import { Link } from "react-router-dom"
import { formatSectorRadarScore } from "../../trading-zone/ydsPrecursorEnginePhase25.js"
import { formatStockRadarScore } from "../../trading-zone/ydsPrecursorEnginePhase26.js"
import WhyExplainButton from "../trust/WhyExplainButton.jsx"
import YdsV1DataScopeNotice from "../trust/YdsV1DataScopeNotice.jsx"

/**
 * @param {{
 *   hub: ReturnType<typeof import("../../utils/ydsMarketHubPresentation.js").buildMarketHubTopViewModel>
 *   report: ReturnType<typeof import("../../trading-zone/ydsCurrentMarketAnalysis.js").buildCurrentMarketAnalysisReport>
 *   compact?: boolean
 * }} props
 */
export default function MarketDashboardSummary({ hub, report, compact = false }) {
  const risk = report.currentState?.risk
  const regime = report.currentState?.regime
  const stockPct = hub.allocation.stockPct ?? 0
  const cashPct = hub.allocation.cashPct ?? 100
  const sectors = hub.topSectors.slice(0, 3)
  const stocks = hub.topStocks.slice(0, 3)

  const regimeWhy = [
    regime?.label ? `현재 ${regime.label}` : null,
    regime?.reason ?? null,
    risk?.priA != null ? `조기경보 ${risk.priA}` : null,
  ].filter(Boolean)

  const priWhy = [
    risk?.priA != null ? `PRI-A ${risk.priA} · ${risk.priALabel ?? "조기경보"}` : null,
    risk?.priB != null ? `PRI-B ${risk.priB} · ${risk.priBLabel ?? "충격감지"}` : null,
  ].filter(Boolean)

  return (
    <div className="yds-dash-summary-v2" aria-label="5초 시장 요약">
      <YdsV1DataScopeNotice compact />

      <section className="yds-dash-summary-v2__hero" aria-label="5초 핵심 요약">
        <div className="yds-dash-summary-v2__hero-market">
          <span className="yds-dash-summary-v2__hero-emoji" aria-hidden>
            {hub.stage?.emoji ?? "—"}
          </span>
          <div className="yds-dash-summary-v2__hero-block">
            <p className="yds-dash-summary-v2__hero-label">현재 시장</p>
            <p className="yds-dash-summary-v2__hero-value">
              {regime?.label ?? hub.stage?.shortLabel ?? "—"}
            </p>
            <p className="yds-dash-summary-v2__hero-sub font-mono tabular-nums">
              {hub.marketPosition.display}
            </p>
          </div>
        </div>

        <div className="yds-dash-summary-v2__hero-action">
          <div className="yds-dash-summary-v2__hero-action-head">
            <p className="yds-dash-summary-v2__hero-label">추천 행동</p>
            <WhyExplainButton lines={hub.actionWhyLines} />
          </div>
          <p className="yds-dash-summary-v2__hero-action-text">{hub.recommendedAction}</p>
        </div>

        <div className="yds-dash-summary-v2__hero-stocks">
          <div className="yds-dash-summary-v2__hero-stocks-head">
            <p className="yds-dash-summary-v2__hero-label">추천 종목</p>
            <Link to="/watchlist" className="yds-dash-summary-v2__hero-more">
              {UI_PAGE.watchlist.title}
            </Link>
          </div>
          {stocks.length ? (
            <ul className="yds-dash-summary-v2__hero-stock-list">
              {stocks.map((s) => (
                <li key={s.id}>
                  <Link to={`/watchlist#watchlist-${s.id}`} className="yds-dash-summary-v2__hero-stock">
                    <span className="font-mono tabular-nums">{s.rank}</span>
                    <span>{s.name}</span>
                    <span className="font-mono tabular-nums">{formatStockRadarScore(s.score)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="yds-dash-summary-v2__muted">추천 종목 산출 대기</p>
          )}
        </div>
      </section>

      <div className="yds-dash-summary-v2__metrics">
        <div className="yds-dash-summary-v2__metric">
          <span className="yds-dash-summary-v2__key">
            시장 국면
            <WhyExplainButton label="왜?" lines={regimeWhy} />
          </span>
          <strong>{regime?.label ?? "—"}</strong>
        </div>
        <div className="yds-dash-summary-v2__metric">
          <span className="yds-dash-summary-v2__key">
            시장 위치
            <WhyExplainButton label="왜?" lines={hub.marketPosition.whyLines} />
          </span>
          <strong className="font-mono tabular-nums">{hub.marketPosition.display}</strong>
        </div>
        <div className="yds-dash-summary-v2__metric">
          <span className="yds-dash-summary-v2__key">
            조기경보
            <WhyExplainButton label="왜?" lines={priWhy.length ? [priWhy[0]] : []} />
          </span>
          <strong className="font-mono tabular-nums">{risk?.priA ?? "—"}</strong>
        </div>
        <div className="yds-dash-summary-v2__metric">
          <span className="yds-dash-summary-v2__key">
            충격감지
            <WhyExplainButton label="왜?" lines={priWhy.length > 1 ? [priWhy[1]] : priWhy} />
          </span>
          <strong className="font-mono tabular-nums">{risk?.priB ?? "—"}</strong>
        </div>
      </div>

      <div className="yds-dash-summary-v2__cols">
        <section className="yds-dash-summary-v2__col">
          <h2 className="yds-dash-summary-v2__h2">추천 섹터 Top3</h2>
          {sectors.length ? (
            <ol className="yds-dash-summary-v2__list">
              {sectors.map((s) => (
                <li key={s.id}>
                  <span className="font-mono">{s.rank}</span>
                  <span>{s.label}</span>
                  <span className="font-mono tabular-nums">{formatSectorRadarScore(s.score)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="yds-dash-summary-v2__muted">—</p>
          )}
        </section>

        <section className="yds-dash-summary-v2__col">
          <h2 className="yds-dash-summary-v2__h2">추천 종목 Top3</h2>
          {stocks.length ? (
            <ol className="yds-dash-summary-v2__list">
              {stocks.map((s) => (
                <li key={s.id}>
                  <span className="font-mono">{s.rank}</span>
                  <Link to={`/watchlist#watchlist-${s.id}`} className="yds-dash-summary-v2__stock-link">
                    {s.name}
                  </Link>
                  <span className="font-mono tabular-nums">{formatStockRadarScore(s.score)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="yds-dash-summary-v2__muted">—</p>
          )}
        </section>
      </div>

      <section className="yds-dash-summary-v2__alloc">
        <div className="yds-dash-summary-v2__alloc-head">
          <h2 className="yds-dash-summary-v2__h2">권장 비중</h2>
          <WhyExplainButton
            lines={[
              hub.allocation.stockLabel ? `주식 ${hub.allocation.stockLabel}` : null,
              hub.allocation.cashLabel ? `현금 ${hub.allocation.cashLabel}` : null,
              report.portfolio?.description ?? null,
            ].filter(Boolean)}
          />
        </div>
        <div className="yds-dash-summary-v2__alloc-row">
          <span>주식 {stockPct}%</span>
          <span>현금 {cashPct}%</span>
        </div>
        <div
          className="yds-dash-summary-v2__alloc-bar"
          role="img"
          aria-label={`주식 ${stockPct}% 현금 ${cashPct}%`}
        >
          <span style={{ width: `${stockPct}%` }} />
        </div>
      </section>

      {!compact ? (
        <p className="yds-dash-summary-v2__stage">
          <span aria-hidden>{hub.stage.emoji}</span> {hub.stage.shortLabel}
        </p>
      ) : null}
    </div>
  )
}
