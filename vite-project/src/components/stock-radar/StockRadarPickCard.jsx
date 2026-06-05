import { UI_BTN } from "../../utils/ydsUiLabels.js"
import { Link } from "react-router-dom"
import { formatStockRadarScore } from "../../trading-zone/ydsPrecursorEnginePhase26.js"
import WhyExplainButton from "../trust/WhyExplainButton.jsx"

/**
 * @param {{
 *   pick: {
 *     id?: string
 *     rank?: number
 *     name: string
 *     symbol?: string
 *     score: number
 *     status?: { display?: string }
 *     explain?: import("../../trading-zone/ydsStockRadarExplain.js").buildStockPickExplainability extends (...args: any) => infer R ? R : never
 *   }
 *   compact?: boolean
 *   showJourney?: boolean
 * }} props
 */
export default function StockRadarPickCard({ pick, compact = false, showJourney = true }) {
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
          <span className="yds-stock-pick__conf" title={ex.confidenceNote}>
            {ex.confidence.label}
          </span>
        </div>
        <WhyExplainButton label={UI_BTN.whyRecommend} lines={ex.recommendReasons} />
      </header>

      {pick.status?.display ? <p className="yds-stock-pick__status-line">{pick.status.display}</p> : null}

      <dl className="yds-stock-pick__breakdown">
        {ex.breakdownRows.map((row) => (
          <div key={row.key}>
            <dt>{row.label}</dt>
            <dd className="font-mono tabular-nums">{formatStockRadarScore(row.score)}</dd>
          </div>
        ))}
      </dl>

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

      {showJourney && pick.id ? (
        <div className="yds-stock-pick__journey">
          <Link to={`/stock-picks#watchlist-${pick.id}`} className="yds-stock-pick__cta">
            {UI_BTN.watchlist}
          </Link>
          <Link to="/alert-center" className="yds-stock-pick__cta yds-stock-pick__cta--muted">
            알림 확인
          </Link>
        </div>
      ) : null}

      <p className="yds-stock-pick__formula">
        <Link to="/glossary#stock-radar">산식 설명</Link>
      </p>
    </article>
  )
}
