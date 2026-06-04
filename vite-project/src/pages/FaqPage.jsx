import LaunchPageShell from "../components/launch/LaunchPageShell.jsx"
import { FAQ_ITEMS } from "../content/ydsLaunchContent.js"

export default function FaqPage() {
  return (
    <LaunchPageShell title="FAQ" subtitle="자주 묻는 질문">
      <dl className="yds-launch-faq">
        {FAQ_ITEMS.map((item) => (
          <div key={item.q} className="yds-launch-faq__item">
            <dt>{item.q}</dt>
            <dd>{item.a}</dd>
          </div>
        ))}
      </dl>
    </LaunchPageShell>
  )
}
