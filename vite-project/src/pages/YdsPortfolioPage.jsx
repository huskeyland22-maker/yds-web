import { useMemo } from "react"
import { Link } from "react-router-dom"
import {
  buildPortfolioView,
  computeRecommendedAllocation,
  derivePortfolioRebalance,
} from "../content/ydsPortfolioEngine.js"
import { usePortfolioHoldings } from "../hooks/usePortfolioHoldings.js"
import { useYdsMarketContext } from "../hooks/useYdsMarketContext.js"
import { UI_PAGE } from "../utils/ydsUiLabels.js"
import "../styles/yds-portfolio.css"

export default function YdsPortfolioPage() {
  const marketContext = useYdsMarketContext()
  const { holdings, setStockPct } = usePortfolioHoldings()

  const view = useMemo(() => {
    const recommended = computeRecommendedAllocation(marketContext)
    const rebalance = derivePortfolioRebalance(recommended, holdings)
    return buildPortfolioView(marketContext, recommended, holdings, rebalance)
  }, [marketContext, holdings])

  const { market, recommended, current, rebalance } = view

  return (
    <div className="yds-portfolio min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-portfolio__header">
        <p className="yds-portfolio__kicker">{UI_PAGE.portfolio.kicker}</p>
        <h1 className="yds-portfolio__title">{UI_PAGE.portfolio.title}</h1>
        <p className="yds-portfolio__sub">
          얼마나 살 것인가 · 종목은{" "}
          <Link to="/stock-picks">종목추천</Link>
          · 타이밍은{" "}
          <Link to="/market-analysis">시장분석</Link>
        </p>
      </header>

      <section className="yds-portfolio__hero" aria-label="권장 비중">
        <p className="yds-portfolio__hero-label">현재 권장 비중</p>
        <div className="yds-portfolio__hero-bars">
          <div className="yds-portfolio__hero-bar">
            <span className="yds-portfolio__hero-bar-label">주식</span>
            <strong className="yds-portfolio__hero-bar-value font-mono tabular-nums">
              {recommended.stockPct}%
            </strong>
          </div>
          <div className="yds-portfolio__hero-bar yds-portfolio__hero-bar--cash">
            <span className="yds-portfolio__hero-bar-label">현금</span>
            <strong className="yds-portfolio__hero-bar-value font-mono tabular-nums">
              {recommended.cashPct}%
            </strong>
          </div>
        </div>
        <p className="yds-portfolio__hero-note">{recommended.note}</p>
      </section>

      <section className="yds-portfolio__section" aria-labelledby="portfolio-market">
        <h2 id="portfolio-market" className="yds-portfolio__section-title">
          1 · 현재 시장
        </h2>
        <div className="yds-portfolio__market-grid">
          <div className="yds-portfolio__market-item">
            <span className="yds-portfolio__market-key">패닉 강도</span>
            <span className="yds-portfolio__market-val">
              {marketContext.macroEmoji} {market.panicLabel}
            </span>
          </div>
          <div className="yds-portfolio__market-item">
            <span className="yds-portfolio__market-key">현재 전략</span>
            <span className="yds-portfolio__market-val">
              {marketContext.strategyEmoji} {market.strategyLabel}
            </span>
          </div>
          <div className="yds-portfolio__market-item">
            <span className="yds-portfolio__market-key">사이클</span>
            <span className="yds-portfolio__market-val">
              {marketContext.cycleEmoji} {market.cycleLabel}
            </span>
          </div>
          <div className="yds-portfolio__market-item">
            <span className="yds-portfolio__market-key">시장 상태</span>
            <span className="yds-portfolio__market-val">
              {marketContext.marketEmoji} {market.marketLabel}
            </span>
          </div>
        </div>
        {!market.ready ? (
          <p className="yds-portfolio__hint">시장 데이터 로딩 중 · 기본 권장 비중 적용</p>
        ) : null}
      </section>

      <section className="yds-portfolio__section" aria-labelledby="portfolio-compare">
        <h2 id="portfolio-compare" className="yds-portfolio__section-title">
          2 · 권장 vs 현재
        </h2>
        <div className="yds-portfolio__compare">
          <div className="yds-portfolio__compare-col">
            <p className="yds-portfolio__compare-head">권장</p>
            <p className="yds-portfolio__compare-row font-mono tabular-nums">
              주식 {recommended.stockPct}%
            </p>
            <p className="yds-portfolio__compare-row font-mono tabular-nums">
              현금 {recommended.cashPct}%
            </p>
          </div>
          <div className="yds-portfolio__compare-col">
            <p className="yds-portfolio__compare-head">현재 보유</p>
            <label className="yds-portfolio__slider-row">
              <span>주식</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={current.stockPct}
                onChange={(e) => setStockPct(Number(e.target.value))}
                className="yds-portfolio__slider"
              />
              <span className="font-mono tabular-nums">{current.stockPct}%</span>
            </label>
            <p className="yds-portfolio__compare-row font-mono tabular-nums">
              현금 {current.cashPct}%
            </p>
          </div>
          <div className="yds-portfolio__compare-col">
            <p className="yds-portfolio__compare-head">차이</p>
            <p
              className={[
                "yds-portfolio__diff font-mono tabular-nums",
                rebalance.stockDiff > 0 ? "yds-portfolio__diff--high" : "",
                rebalance.stockDiff < 0 ? "yds-portfolio__diff--low" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              주식 {rebalance.stockDiff > 0 ? "+" : ""}
              {rebalance.stockDiff}%
            </p>
            <p className="yds-portfolio__compare-row font-mono tabular-nums">
              현금 {rebalance.cashDiff > 0 ? "+" : ""}
              {rebalance.cashDiff}%
            </p>
          </div>
        </div>
      </section>

      <section
        className={[
          "yds-portfolio__conclusion",
          `yds-portfolio__conclusion--${rebalance.tone}`,
        ].join(" ")}
        aria-labelledby="portfolio-action"
      >
        <h2 id="portfolio-action" className="yds-portfolio__section-title">
          3 · 결론 · 행동
        </h2>
        <p className="yds-portfolio__conclusion-text">{rebalance.conclusion}</p>
        <ul className="yds-portfolio__action-list">
          {rebalance.actions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ul>
      </section>

      <p className="yds-portfolio__footnote">
        개별 종목 매매가 아닌 시장분석 기반 비중 전략 ·{" "}
        <Link to="/action-log">YDS 행동 로그</Link>
        {" "}에서 실행 기록
      </p>
    </div>
  )
}
