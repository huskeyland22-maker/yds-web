import { Link } from "react-router-dom"

/**
 * CREDIT CYCLE 준비 화면.
 * HY·BBB 등 신용 위험은 패닉 데이터와 분리해 이 영역에서 다룰 예정이다.
 */
export default function CreditCyclePage() {
  return (
    <div className="yds-menu-hub yds-menu-hub--credit">
      <header className="yds-menu-hub__header">
        <p className="yds-menu-hub__eyebrow">CREDIT CYCLE</p>
        <h1 className="yds-menu-hub__title">신용 사이클</h1>
        <p className="yds-menu-hub__sub">
          HY 스프레드 · BBB 스프레드 및 기타 신용 위험 지표를 위한 영역으로 구축할 예정입니다.
        </p>
      </header>
      <div className="yds-menu-hub__panel" role="status">
        <p className="yds-menu-hub__panel-title">준비 중 · 완성 기능 아님</p>
        <p className="yds-menu-hub__panel-body">
          현재는 안내 화면만 제공합니다. HY·BBB 신용 스프레드는 이 영역에서 다루며, Panic Index(VIX · CNN ·
          Put/Call) 점수와 합산하지 않습니다.
        </p>
        <ul className="yds-menu-hub__bullets">
          <li>향후 HY · BBB 신용 스프레드</li>
          <li>신용 사이클 국면·리스크 해석</li>
          <li>패닉 AI 입력(VIX · CNN · Put/Call)과 분리</li>
        </ul>
      </div>
      <p className="yds-menu-hub__footer-links">
        <Link to="/panic-fear-buy">패닉·공포 매수 허브</Link>
        <Link to="/market-briefing">시장 브리핑</Link>
      </p>
    </div>
  )
}
