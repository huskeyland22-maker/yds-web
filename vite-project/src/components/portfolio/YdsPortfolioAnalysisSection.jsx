import { useMemo } from "react"
import { Link } from "react-router-dom"
import { buildPortfolioV2Analysis } from "../../content/ydsPortfolioV2Engine.js"
import { usePortfolioCash } from "../../hooks/usePortfolioCash.js"
import { usePortfolioHoldings } from "../../hooks/usePortfolioHoldings.js"
import { useYdsMarketContext } from "../../hooks/useYdsMarketContext.js"

export default function YdsPortfolioAnalysisSection() {
  const marketContext = useYdsMarketContext()
  const { positions } = usePortfolioHoldings()
  const { cashAmount } = usePortfolioCash()

  const analysis = useMemo(
    () => buildPortfolioV2Analysis(positions, cashAmount, marketContext),
    [positions, cashAmount, marketContext],
  )

  const { recommended, actual, compliance, rebalance, asset } = analysis

  return (
    <section className="yds-portfolio__section yds-portfolio-v2__section" aria-labelledby="pf-analysis">
      <h2 id="pf-analysis" className="yds-portfolio__section-title">
        3 · 포트폴리오 분석
      </h2>

      <p className="yds-portfolio-v2__lead">
        {marketContext.strategyEmoji} {marketContext.strategyLabel} · 보유 종목 기준 자동 계산
      </p>

      <p className="yds-portfolio-v2__asset-total font-mono tabular-nums">
        총자산 {asset.total.toLocaleString("ko-KR")}원
        {cashAmount > 0 ? ` · 현금 ${cashAmount.toLocaleString("ko-KR")}원` : ""}
      </p>

      <div className="yds-portfolio-v2__alloc-grid">
        <div className="yds-portfolio-v2__alloc-card">
          <p className="yds-portfolio-v2__alloc-head">YDS 권장 비중</p>
          <ul className="yds-portfolio-v2__alloc-list">
            <li className="font-mono tabular-nums">🇺🇸 미국 {recommended.usPct}%</li>
            <li className="font-mono tabular-nums">🇰🇷 한국 {recommended.krPct}%</li>
            <li className="font-mono tabular-nums">💵 현금 {recommended.cashPct}%</li>
          </ul>
        </div>
        <div className="yds-portfolio-v2__alloc-card">
          <p className="yds-portfolio-v2__alloc-head">실제 비중</p>
          <ul className="yds-portfolio-v2__alloc-list">
            <li className="font-mono tabular-nums">🇺🇸 미국 {actual.usPct}%</li>
            <li className="font-mono tabular-nums">🇰🇷 한국 {actual.krPct}%</li>
            <li className="font-mono tabular-nums">💵 현금 {actual.cashPct}%</li>
          </ul>
        </div>
        <div className="yds-portfolio-v2__alloc-card yds-portfolio-v2__alloc-card--gap">
          <p className="yds-portfolio-v2__alloc-head">괴리도 · 준수</p>
          <p className="yds-portfolio-v2__gap-hero font-mono tabular-nums">{compliance.gapPct}%</p>
          <p className="yds-portfolio-v2__gap-sub font-mono tabular-nums">
            YDS 준수 {compliance.compliancePct}%
          </p>
        </div>
      </div>

      <p className="yds-portfolio-v2__conclusion">{rebalance.conclusion}</p>

      {!positions.length ? (
        <p className="yds-portfolio-v2__hint">매매 기록 또는 보유 입력 후 분석이 표시됩니다.</p>
      ) : null}

      <p className="yds-portfolio-v2__market-link">
        시장 근거는 <Link to="/market-analysis">시장분석</Link>에서 확인
      </p>
    </section>
  )
}
