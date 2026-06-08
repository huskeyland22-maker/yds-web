import { useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import YdsPortfolioMySection from "../components/portfolio/YdsPortfolioMySection.jsx"
import YdsPortfolioReviewSection from "../components/portfolio/YdsPortfolioReviewSection.jsx"
import YdsPortfolioTradesSection from "../components/portfolio/YdsPortfolioTradesSection.jsx"
import YdsPortfolioYdsCompareSection from "../components/portfolio/YdsPortfolioYdsCompareSection.jsx"
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
    <div className="yds-portfolio yds-portfolio--v2 yds-portfolio--v3 yds-portfolio--v4 min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-portfolio__header">
        <p className="yds-portfolio__kicker">{UI_PAGE.portfolio.kicker}</p>
        <h1 className="yds-portfolio__title">{UI_PAGE.portfolio.title}</h1>
        <p className="yds-portfolio__sub">
          YDS 최종 실행 · 판단{" "}
          <Link to="/market-analysis">시장분석</Link>
          {" · "}후보{" "}
          <Link to="/stock-picks">종목추천</Link>
        </p>
      </header>

      <YdsPortfolioMySection />
      <YdsPortfolioYdsCompareSection />
      <YdsPortfolioTradesSection />
      <YdsPortfolioReviewSection />

      <p className="yds-portfolio__footnote">
        거래를 기록한다 · 포트폴리오는 거래 결과로 자동 생성된다
      </p>
    </div>
  )
}
