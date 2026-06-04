import { Link } from "react-router-dom"
import { GLOSSARY_ENTRIES } from "../utils/ydsTerminology.js"
import YdsV1ReleaseBadge from "../components/trust/YdsV1ReleaseBadge.jsx"

export default function GlossaryPage() {
  return (
    <div className="yds-glossary min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-glossary__header">
        <div>
          <YdsV1ReleaseBadge />
          <h1 className="yds-glossary__title">YDS 용어 설명</h1>
          <p className="yds-glossary__sub">V1 Release Candidate · 사용자-facing 용어 사전</p>
        </div>
        <Link to="/market-analysis" className="yds-glossary__link">
          시장분석
        </Link>
      </header>

      <dl className="yds-glossary__list">
        {GLOSSARY_ENTRIES.map((e) => (
          <div key={e.id} className="yds-glossary__item">
            <dt>{e.title}</dt>
            <dd>{e.body}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
