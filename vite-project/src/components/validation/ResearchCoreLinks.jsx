import { Link } from "react-router-dom"

const CORE_LINKS = [
  { label: "시장분석", path: "/market-analysis" },
  { label: "종목추천", path: "/stock-picks" },
  { label: "알림", path: "/alert-center" },
  { label: "AI 리포트", path: "/ai-daily-report" },
  { label: "성과", path: "/performance-center" },
]

export default function ResearchCoreLinks() {
  return (
    <nav className="research-core-links" aria-label="CORE 바로가기">
      <p className="research-core-links__label">프로덕션 (CORE)</p>
      <ul className="research-core-links__list">
        {CORE_LINKS.map((item) => (
          <li key={item.path}>
            <Link to={item.path}>{item.label}</Link>
          </li>
        ))}
      </ul>
      <p className="research-core-links__note">
        Paper·Journal Lab 미리보기는 V1에서 제거되었습니다. 시장분석 Hub·성과·관심종목을 이용하세요.
      </p>
    </nav>
  )
}
