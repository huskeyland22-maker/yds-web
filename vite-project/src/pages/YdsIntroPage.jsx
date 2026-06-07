import LaunchPageShell from "../components/launch/LaunchPageShell.jsx"
import { YDS_LABEL_PANIC_SCORE } from "../content/ydsLanguage.js"
import { INTRO_SECTIONS } from "../content/ydsLaunchContent.js"

export default function YdsIntroPage() {
  return (
    <LaunchPageShell title="YDS 소개" subtitle={`Y'DS 시장 사이클 투자 시스템 · ${YDS_LABEL_PANIC_SCORE} · 패닉 5단계`}>
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
