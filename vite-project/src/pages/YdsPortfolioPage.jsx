import { useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import YdsPortfolioAnalysisSection from "../components/portfolio/YdsPortfolioAnalysisSection.jsx"
import YdsPortfolioHoldingsSection from "../components/portfolio/YdsPortfolioHoldingsSection.jsx"
import YdsPortfolioReviewSection from "../components/portfolio/YdsPortfolioReviewSection.jsx"
import YdsPortfolioTradesSection from "../components/portfolio/YdsPortfolioTradesSection.jsx"
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
    <div className="yds-portfolio yds-portfolio--v2 min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-portfolio__header">
        <p className="yds-portfolio__kicker">{UI_PAGE.portfolio.kicker}</p>
        <h1 className="yds-portfolio__title">{UI_PAGE.portfolio.title}</h1>
        <p className="yds-portfolio__sub">
          투자 운영 센터 · 타이밍{" "}
          <Link to="/market-analysis">시장분석</Link>
          {" · "}종목{" "}
          <Link to="/stock-picks">종목추천</Link>
        </p>
      </header>

      <YdsPortfolioHoldingsSection />
      <YdsPortfolioTradesSection />
      <YdsPortfolioAnalysisSection />
      <YdsPortfolioReviewSection />

      <p className="yds-portfolio__footnote">
        보유 → 기록 → 분석 → 복기 · 모든 기록은 포트폴리오 중심
      </p>
    </div>
  )
}
