import { useMemo } from "react"
import { Link } from "react-router-dom"
import { buildV5Analysis, emptyPortfolioHoldings } from "../../content/ydsPortfolioV5Engine.js"
import { usePortfolioHoldings } from "../../hooks/usePortfolioHoldings.js"
import { useYdsMarketContext } from "../../hooks/useYdsMarketContext.js"

export default function YdsPortfolioYdsCompareSection() {
  const marketContext = useYdsMarketContext()
  const { trades, cashAmount, quoteMap, usdkrw } = usePortfolioHoldings()

  const analysis = useMemo(() => {
    try {
      return buildV5Analysis(trades ?? [], cashAmount ?? 0, marketContext, quoteMap, usdkrw)
    } catch (e) {
      console.error("[YdsPortfolioYdsCompareSection] buildV5Analysis failed", e)
      const empty = emptyPortfolioHoldings()
      return {
        recommended: { usPct: 25, krPct: 15, cashPct: 60 },
        actual: { usPct: 0, krPct: 0, cashPct: 100 },
        asset: empty,
        compliance: { gapPct: 0, compliancePct: 0 },
        gapPct: 0,
        compliancePct: 0,
        rebalance: { conclusion: "포트폴리오 데이터를 불러오지 못했습니다." },
      }
    }
  }, [trades, cashAmount, marketContext, quoteMap, usdkrw])

  const { recommended, actual, compliance, rebalance } = analysis
  const hasData = (trades ?? []).some(
    (t) =>
      t.action !== "watch" &&
      ((t.quantity != null && t.quantity > 0 && t.unitPrice != null && t.unitPrice > 0) ||
        (t.amount ?? 0) > 0),
  )

  return (
    <section
      className="yds-portfolio__section yds-portfolio-v2__section yds-portfolio-v3__compare yds-portfolio-v5__compare"
      aria-labelledby="pf-yds-compare"
    >
      <h2 id="pf-yds-compare" className="yds-portfolio__section-title">
        2 · YDS 비교
      </h2>

      <p className="yds-portfolio-v3__compare-lead">
        {marketContext?.strategyEmoji ?? "📊"} {marketContext?.strategyLabel ?? "시장 판단"} · 주식
        평가 + 현금 비중 비교
      </p>

      <div className="yds-portfolio-v4__alloc-bars">
        <div className="yds-portfolio-v4__alloc-row">
          <span>🇺🇸 미국</span>
          <span className="font-mono tabular-nums">현재 {actual.usPct}%</span>
          <span className="font-mono tabular-nums yds-portfolio-v4__alloc-rec">
            권장 {recommended.usPct}%
          </span>
        </div>
        <div className="yds-portfolio-v4__alloc-row">
          <span>🇰🇷 한국</span>
          <span className="font-mono tabular-nums">현재 {actual.krPct}%</span>
          <span className="font-mono tabular-nums yds-portfolio-v4__alloc-rec">
            권장 {recommended.krPct}%
          </span>
        </div>
        <div className="yds-portfolio-v4__alloc-row">
          <span>💵 현금</span>
          <span className="font-mono tabular-nums">현재 {actual.cashPct}%</span>
          <span className="font-mono tabular-nums yds-portfolio-v4__alloc-rec">
            권장 {recommended.cashPct}%
          </span>
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

      <p className="yds-portfolio-v2__conclusion">{rebalance?.conclusion ?? "—"}</p>

      <p className="yds-portfolio-v2__market-link">
        판단 · <Link to="/market-analysis">시장분석</Link>
        {" · "}후보 · <Link to="/stock-picks">종목추천</Link>
      </p>
    </section>
  )
}
