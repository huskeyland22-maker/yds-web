import { useMemo } from "react"
import { Link } from "react-router-dom"
import { buildPortfolioV2Analysis } from "../../content/ydsPortfolioV2Engine.js"
import { usePortfolioCash } from "../../hooks/usePortfolioCash.js"
import { usePortfolioHoldings } from "../../hooks/usePortfolioHoldings.js"
import { useYdsMarketContext } from "../../hooks/useYdsMarketContext.js"

export default function YdsPortfolioYdsCompareSection() {
  const marketContext = useYdsMarketContext()
  const { positions } = usePortfolioHoldings()
  const { cashAmount } = usePortfolioCash()

  const analysis = useMemo(
    () => buildPortfolioV2Analysis(positions, cashAmount, marketContext),
    [positions, cashAmount, marketContext],
  )

  const { recommended, actual, compliance, rebalance } = analysis

  return (
    <section
      className="yds-portfolio__section yds-portfolio-v2__section yds-portfolio-v3__compare"
      aria-labelledby="pf-yds-compare"
    >
      <h2 id="pf-yds-compare" className="yds-portfolio__section-title">
        2 · YDS 비교
      </h2>

      <p className="yds-portfolio-v3__compare-lead">
        {marketContext.strategyEmoji} {marketContext.strategyLabel}
      </p>

      <div className="yds-portfolio-v3__compare-grid">
        <div className="yds-portfolio-v3__compare-col">
          <p className="yds-portfolio-v3__compare-head">현재 비중</p>
          <ul className="yds-portfolio-v3__compare-list">
            <li className="font-mono tabular-nums">🇺🇸 미국 {actual.usPct}%</li>
            <li className="font-mono tabular-nums">🇰🇷 한국 {actual.krPct}%</li>
            <li className="font-mono tabular-nums">💵 현금 {actual.cashPct}%</li>
          </ul>
        </div>
        <div className="yds-portfolio-v3__compare-col">
          <p className="yds-portfolio-v3__compare-head">권장 비중</p>
          <ul className="yds-portfolio-v3__compare-list">
            <li className="font-mono tabular-nums">🇺🇸 미국 {recommended.usPct}%</li>
            <li className="font-mono tabular-nums">🇰🇷 한국 {recommended.krPct}%</li>
            <li className="font-mono tabular-nums">💵 현금 {recommended.cashPct}%</li>
          </ul>
        </div>
      </div>

      <div className="yds-portfolio-v3__compare-metrics">
        <div className="yds-portfolio-v3__compare-metric">
          <span className="yds-portfolio-v3__compare-metric-label">괴리도</span>
          <strong className="yds-portfolio-v3__compare-metric-value font-mono tabular-nums">
            {positions.length || cashAmount > 0 ? `${compliance.gapPct}%` : "—"}
          </strong>
        </div>
        <div className="yds-portfolio-v3__compare-metric yds-portfolio-v3__compare-metric--accent">
          <span className="yds-portfolio-v3__compare-metric-label">준수율</span>
          <strong className="yds-portfolio-v3__compare-metric-value font-mono tabular-nums">
            {positions.length || cashAmount > 0 ? `${compliance.compliancePct}%` : "—"}
          </strong>
        </div>
      </div>

      <p className="yds-portfolio-v2__conclusion">{rebalance.conclusion}</p>

      <p className="yds-portfolio-v2__market-link">
        판단 근거 · <Link to="/market-analysis">시장분석</Link>
        {" · "}
        <Link to="/stock-picks">종목추천</Link>
      </p>
    </section>
  )
}
