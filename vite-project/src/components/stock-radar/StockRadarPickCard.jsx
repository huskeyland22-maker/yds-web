import { Link } from "react-router-dom"
import { formatStockRadarScore } from "../../trading-zone/ydsPrecursorEnginePhase26.js"

/**
 * @param {{
 *   pick: {
 *     rank?: number
 *     name: string
 *     symbol?: string
 *     score: number
 *     status?: { display?: string }
 *     explain?: import("../../trading-zone/ydsStockRadarExplain.js").buildStockPickExplainability extends (...args: any) => infer R ? R : never
 *   }
 *   compact?: boolean
 * }} props
 */
export default function StockRadarPickCard({ pick, compact = false }) {
  const ex = pick.explain
  if (compact || !ex) {
    return (
      <li className="yds-stock-pick yds-stock-pick--compact">
        <span className="font-mono">{pick.rank}</span>
        <span>{pick.name}</span>
        <span className="font-mono tabular-nums">{formatStockRadarScore(pick.score)}</span>
        {pick.status?.display ? <span className="yds-stock-pick__status">{pick.status.display}</span> : null}
      </li>
    )
  }

  return (
    <article className="yds-stock-pick">
      <header className="yds-stock-pick__head">
        <span className="yds-stock-pick__rank font-mono tabular-nums">{pick.rank}</span>
        <div>
          <h3 className="yds-stock-pick__name">{pick.name}</h3>
          {pick.symbol ? <span className="yds-stock-pick__sym font-mono">{pick.symbol}</span> : null}
        </div>
        <div className="yds-stock-pick__score-block">
          <span className="yds-stock-pick__score font-mono tabular-nums">
            {formatStockRadarScore(pick.score)}
          </span>
          <span
            className="yds-stock-pick__conf"
            title={ex.confidenceNote}
          >
            {ex.confidence.label}
          </span>
        </div>
      </header>

      {pick.status?.display ? (
        <p className="yds-stock-pick__status-line">{pick.status.display}</p>
      ) : null}

      <dl className="yds-stock-pick__breakdown">
        {ex.breakdownRows.map((row) => (
          <div key={row.key}>
            <dt>{row.label}</dt>
            <dd className="font-mono tabular-nums">{formatStockRadarScore(row.score)}</dd>
          </div>
        ))}
      </dl>

      {ex.recommendReasons.length ? (
        <div className="yds-stock-pick__reasons">
          <p className="yds-stock-pick__sub">추천 이유</p>
          <ul>
            {ex.recommendReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {ex.strengths.length || ex.weaknesses.length ? (
        <div className="yds-stock-pick__swot">
          {ex.strengths.map((s) => (
            <p key={s.label} className="yds-stock-pick__strength">
              <span>강점</span> {s.label} — {s.detail}
            </p>
          ))}
          {ex.weaknesses.map((w) => (
            <p key={w.label} className="yds-stock-pick__weak">
              <span>약점</span> {w.label} — {w.detail}
            </p>
          ))}
        </div>
      ) : null}

      {ex.warnings.length ? (
        <div className="yds-stock-pick__warn">
          <p className="yds-stock-pick__sub">추천 경고</p>
          <ul>
            {ex.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="yds-stock-pick__formula">
        <Link to="/glossary">산식 설명</Link> · {ex.formulaSummary}
      </p>
    </article>
  )
}
