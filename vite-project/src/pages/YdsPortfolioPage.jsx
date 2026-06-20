import { useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import YdsPortfolioCashSection from "../components/portfolio/YdsPortfolioCashSection.jsx"
import YdsPortfolioCenterSection from "../components/portfolio/YdsPortfolioCenterSection.jsx"
import YdsPortfolioMySection from "../components/portfolio/YdsPortfolioMySection.jsx"
import YdsPortfolioReviewSection from "../components/portfolio/YdsPortfolioReviewSection.jsx"
import YdsPortfolioTradesSection from "../components/portfolio/YdsPortfolioTradesSection.jsx"
import YdsPortfolioValidationSection from "../components/portfolio/YdsPortfolioValidationSection.jsx"
import YdsPortfolioYdsCompareSection from "../components/portfolio/YdsPortfolioYdsCompareSection.jsx"
import { PortfolioStateProvider } from "../context/PortfolioStateContext.jsx"
import { UI_PAGE } from "../utils/ydsUiLabels.js"
import "../styles/yds-portfolio.css"

const HASH_TARGETS = {
  "#execution-log": "portfolio-trades",
  "#portfolio-trades": "portfolio-trades",
}

export default function YdsPortfolioPage() {
  const location = useLocation()

  useEffect(() => {
    const targetId = HASH_TARGETS[location.hash]
    if (!targetId) return
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [location.hash])

  return (
    <div className="yds-portfolio yds-portfolio--v2 yds-portfolio--v3 yds-portfolio--v4 yds-portfolio--v5 yds-portfolio--v6 yds-portfolio--v64 yds-portfolio--p7 min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-portfolio__header">
        <p className="yds-portfolio__kicker">{UI_PAGE.portfolio.kicker}</p>
        <h1 className="yds-portfolio__title">{UI_PAGE.portfolio.title}</h1>
        <p className="yds-portfolio__sub">
          실제 보유 자산 ·{" "}
          <Link to="/market-analysis">시장상태</Link>
          {" · "}후보{" "}
          <Link to="/stock-picks">종목추천</Link>
          {" · "}성과{" "}
          <Link to="/performance-validation">성과검증</Link>
        </p>
      </header>

      <PortfolioStateProvider>
        <YdsPortfolioCenterSection />

        <details className="yds-pf-center__ops">
          <summary className="yds-pf-center__ops-summary">운영 도구 · 상세 계좌·거래·검증</summary>
          <div className="yds-pf-center__ops-body">
            <YdsPortfolioMySection />
            <YdsPortfolioYdsCompareSection />
            <YdsPortfolioTradesSection />
            <YdsPortfolioCashSection />
            <YdsPortfolioReviewSection />
            <YdsPortfolioValidationSection />
          </div>
        </details>
      </PortfolioStateProvider>

      <p className="yds-portfolio__footnote">
        보유·현금만 입력 · 시장상태·리스크·비중은 시스템이 계산
      </p>
    </div>
  )
}
