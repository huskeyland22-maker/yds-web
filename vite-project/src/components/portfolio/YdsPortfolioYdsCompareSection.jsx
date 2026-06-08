import { useMemo } from "react"
import { Link } from "react-router-dom"
import { buildV4Analysis } from "../../content/ydsPortfolioV4Engine.js"
import { usePortfolioHoldings } from "../../hooks/usePortfolioHoldings.js"
import { useYdsMarketContext } from "../../hooks/useYdsMarketContext.js"

export default function YdsPortfolioYdsCompareSection() {
  const marketContext = useYdsMarketContext()
  const { trades, cashAmount } = usePortfolioHoldings()

  const analysis = useMemo(
    () => buildV4Analysis(trades, cashAmount, marketContext),
    [trades, cashAmount, marketContext],
  )

  const { recommended, actual, compliance, rebalance } = analysis
  const hasData = trades.some((t) => t.action !== "watch" && (t.amount ?? 0) > 0)

  return (
    <section
      className="yds-portfolio__section yds-portfolio-v2__section yds-portfolio-v3__compare"
      aria-labelledby="pf-yds-compare"
    >
      <h2 id="pf-yds-compare" className="yds-portfolio__section-title">
        2 · YDS 비교
      </h2>

      <p className="yds-portfolio-v3__compare-lead">
        {marketContext.strategyEmoji} {marketContext.strategyLabel} · 거래 기반 자동 분석
      </p>

      <div className="yds-portfolio-v4__alloc-bars">
        <div className="yds-portfolio-v4__alloc-row">
          <span>🇺🇸 미국</span>
          <span className="font-mono tabular-nums">현재 {actual.usPct}%</span>
          <span className="font-mono tabular-nums yds-portfolio-v4__alloc-rec">권장 {recommended.usPct}%</span>
        </div>
        <div className="yds-portfolio-v4__alloc-row">
          <span>🇰🇷 한국</span>
          <span className="font-mono tabular-nums">현재 {actual.krPct}%</span>
          <span className="font-mono tabular-nums yds-portfolio-v4__alloc-rec">권장 {recommended.krPct}%</span>
        </div>
        <div className="yds-portfolio-v4__alloc-row">
          <span>💵 현금</span>
          <span className="font-mono tabular-nums">현재 {actual.cashPct}%</span>
          <span className="font-mono tabular-nums yds-portfolio-v4__alloc-rec">권장 {recommended.cashPct}%</span>
        </div>
      </div>

      <div className="yds-portfolio-v3__compare-metrics">
        <div className="yds-portfolio-v3__compare-metric">
          <span className="yds-portfolio-v3__compare-metric-label">괴리도</span>
          <strong className="yds-portfolio-v3__compare-metric-value font-mono tabular-nums">
            {hasData ? `${compliance.gapPct}%` : "—"}
          </strong>
        </div>
        <div className="yds-portfolio-v3__compare-metric yds-portfolio-v3__compare-metric--accent">
          <span className="yds-portfolio-v3__compare-metric-label">준수율</span>
          <strong className="yds-portfolio-v3__compare-metric-value font-mono tabular-nums">
            {hasData ? `${compliance.compliancePct}%` : "—"}
          </strong>
        </div>
      </div>

      <p className="yds-portfolio-v2__conclusion">{rebalance.conclusion}</p>

      <p className="yds-portfolio-v2__market-link">
        판단 · <Link to="/market-analysis">시장분석</Link>
        {" · "}후보 · <Link to="/stock-picks">종목추천</Link>
      </p>
    </section>
  )
}
