import { Link } from "react-router-dom"
import LaunchPageShell from "../components/launch/LaunchPageShell.jsx"
import { START_GUIDE_STEPS } from "../content/ydsLaunchContent.js"
import { completeLaunchOnboarding } from "../utils/ydsLaunchOnboardingStorage.js"

export default function StartGuidePage() {
  return (
    <LaunchPageShell title="시작하기 가이드" subtitle="약 3분 · 4단계">
      <p className="yds-launch-block__p">
        아래 순서대로 둘러보면 YDS V1 핵심 기능을 빠르게 익힐 수 있습니다.
      </p>
      <ol className="yds-launch-steps">
        {START_GUIDE_STEPS.map((s) => (
          <li key={s.step} className="yds-launch-steps__item">
            <span className="yds-launch-steps__num">{s.step}</span>
            <div>
              <h2 className="yds-launch-steps__title">
                {s.title}
                <span className="yds-launch-steps__time">{s.time}</span>
              </h2>
              <p className="yds-launch-block__p">{s.body}</p>
              <Link to={s.path} className="yds-launch-steps__cta">
                {s.cta} →
              </Link>
            </div>
          </li>
        ))}
      </ol>
      <p className="yds-launch-done">
        <Link
          to="/market-analysis"
          className="yds-launch-done__btn"
          onClick={() => completeLaunchOnboarding()}
        >
          가이드 완료 · 시장분석으로
        </Link>
      </p>
    </LaunchPageShell>
  )
}
