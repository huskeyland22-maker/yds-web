import { Link } from "react-router-dom"
import LaunchFooterNav from "../components/launch/LaunchFooterNav.jsx"

export default function NotFoundPage() {
  return (
    <div className="yds-not-found min-w-0 px-3 py-8 sm:px-4">
      <p className="yds-not-found__code">404</p>
      <h1 className="yds-not-found__title">페이지를 찾을 수 없습니다</h1>
      <p className="yds-not-found__sub">주소가 바뀌었거나 삭제된 페이지일 수 있습니다.</p>
      <div className="yds-not-found__actions">
        <Link to="/market-analysis" className="yds-not-found__primary">
          시장분석으로
        </Link>
        <Link to="/start" className="yds-not-found__link">
          시작하기 가이드
        </Link>
      </div>
      <LaunchFooterNav />
    </div>
  )
}
