import { Link } from "react-router-dom"
import YdsPortfolioCenterSection from "../components/portfolio/YdsPortfolioCenterSection.jsx"
import { PortfolioStateProvider } from "../context/PortfolioStateContext.jsx"
import { UI_PAGE } from "../utils/ydsUiLabels.js"

export default function YdsPortfolioPage() {
  return (
    <div className="yds-pf-v1-page min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-pf-v1-page__header">
        <p className="yds-pf-v1-page__kicker">{UI_PAGE.portfolio.kicker}</p>
        <h1 className="yds-pf-v1-page__title">{UI_PAGE.portfolio.title}</h1>
        <p className="yds-pf-v1-page__sub">
          실제 계좌 ·{" "}
          <Link to="/market-analysis">시장상태</Link>
          {" · "}
          <Link to="/investment-playbook">투자 원칙</Link>
        </p>
      </header>

      <PortfolioStateProvider>
        <YdsPortfolioCenterSection />
      </PortfolioStateProvider>

      <p className="yds-pf-v1-page__foot">V1 · 보유·현금만 입력 · 매매일지·세금·자동매매 미포함</p>
    </div>
  )
}
