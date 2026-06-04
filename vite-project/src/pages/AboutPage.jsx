import LaunchPageShell from "../components/launch/LaunchPageShell.jsx"
import { ABOUT_SECTIONS } from "../content/ydsLaunchContent.js"

export default function AboutPage() {
  return (
    <LaunchPageShell title="About" subtitle="프로젝트 · 주의 · 면책">
      {ABOUT_SECTIONS.map((s) => (
        <section key={s.title} className="yds-launch-block">
          <h2 className="yds-launch-block__h2">{s.title}</h2>
          <p className="yds-launch-block__p">{s.body}</p>
        </section>
      ))}
    </LaunchPageShell>
  )
}
