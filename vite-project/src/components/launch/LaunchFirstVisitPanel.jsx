import { Link } from "react-router-dom"
import { completeLaunchOnboarding } from "../../utils/ydsLaunchOnboardingStorage.js"

/**
 * @param {{ onShowFull: () => void }} props
 */
export default function LaunchFirstVisitPanel({ onShowFull }) {
  return (
    <aside className="yds-launch-welcome" aria-label="첫 방문 안내">
      <p className="yds-launch-welcome__lead">
        처음이신가요? 아래 4가지만 보면 오늘 시장을 5초 안에 파악할 수 있습니다.
      </p>
      <div className="yds-launch-welcome__actions">
        <Link to="/intro" className="yds-launch-welcome__link">
          YDS 소개
        </Link>
        <Link to="/start" className="yds-launch-welcome__link yds-launch-welcome__link--primary">
          3분 시작하기
        </Link>
        <button
          type="button"
          className="yds-launch-welcome__btn"
          onClick={() => {
            completeLaunchOnboarding()
            onShowFull()
          }}
        >
          전체 기능 보기
        </button>
      </div>
    </aside>
  )
}
