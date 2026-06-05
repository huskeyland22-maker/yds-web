import { Link } from "react-router-dom"

export default function YdsCycleScopeBanner() {
  return (
    <div className="yds-cycle-scope" role="note">
      <p className="yds-cycle-scope__text">
        상세 패닉 데스크 뷰입니다. 일상 사용은{" "}
        <Link to="/market-analysis">시장분석 Hub</Link>가 기준 화면입니다.
      </p>
    </div>
  )
}
