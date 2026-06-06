import LaunchPageShell from "../components/launch/LaunchPageShell.jsx"
import { INTRO_SECTIONS } from "../content/ydsLaunchContent.js"

export default function YdsIntroPage() {
  return (
    <LaunchPageShell title="YDS 소개" subtitle="YDS 총점 · 시장 사이클 · 5단계 행동">
      {INTRO_SECTIONS.map((s) => (
        <section key={s.id} className="yds-launch-block">
          <h2 className="yds-launch-block__h2">{s.title}</h2>
          {s.body ? <p className="yds-launch-block__p">{s.body}</p> : null}
          {s.list ? (
            <ol className="yds-launch-block__ol">
              {s.list.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          ) : null}
        </section>
      ))}
    </LaunchPageShell>
  )
}
