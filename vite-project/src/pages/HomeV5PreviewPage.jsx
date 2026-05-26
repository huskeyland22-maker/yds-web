import { useEffect } from "react"
import { Link } from "react-router-dom"
import HomeV5Preview from "../home-preview/HomeV5Preview.jsx"
import { HOME_V5_PREVIEW_MOCK } from "../home-preview/homeV5PreviewModel.js"

export default function HomeV5PreviewPage() {
  useEffect(() => {
    document.body.classList.add("home-v5-preview-route")
    return () => document.body.classList.remove("home-v5-preview-route")
  }, [])

  return (
    <div className="home-v5-preview-page home-v5-preview-page--compact home-v5-preview-page--hero min-w-0">
      <div className="home-v5-preview-page__banner" role="status">
        <div className="home-v5-preview-page__banner-text">
          <strong>홈 v5 시안 미리보기</strong>
          <span>Mock 데이터 · 실데이터 미사용 · /cycle 미반영</span>
        </div>
        <Link to="/cycle" className="home-v5-preview-page__back">
          현재 홈으로
        </Link>
      </div>

      <HomeV5Preview panicData={HOME_V5_PREVIEW_MOCK} />

      <p className="home-v5-preview-page__foot">
        v5 시안 최종 · Mock · CNN 78 · VIX 16 · HY 4.1 · 🔵 과열
      </p>
    </div>
  )
}
