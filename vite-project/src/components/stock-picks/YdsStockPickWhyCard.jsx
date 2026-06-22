import { Link } from "react-router-dom"
import { buildStockPickWhyBrief } from "../../content/ydsStockPickWhyBrief.js"
import { getStockPickTotalScore } from "../../content/ydsStockPickUxStatus.js"
import YdsStockPickOpinionBlock from "./YdsStockPickOpinionBlock.jsx"
import YdsStockPickPhase3Breakdown from "./YdsStockPickPhase3Breakdown.jsx"
import YdsStockPickThemeBadges from "./YdsStockPickThemeBadges.jsx"

const ROWS = [
  { key: "industry", label: "산업" },
  { key: "bottleneck", label: "병목" },
  { key: "performance", label: "실적" },
  { key: "technology", label: "기술" },
  { key: "action", label: "액션" },
]

/**
 * @param {{
 *   stock: import("../../content/ydsStockPickModel.js").StockPickView
 *   rank: number
 * }} props
 */
export default function YdsStockPickWhyCard({ stock, rank }) {
  const brief = buildStockPickWhyBrief(stock)
  const totalScore = getStockPickTotalScore(stock)
  const to = `/stock-picks/${encodeURIComponent(stock.ticker)}`

  return (
    <article className="yds-spick-why-card">
      <header className="yds-spick-why-card__head">
        <span className="yds-spick-why-card__rank font-mono tabular-nums">{rank}</span>
        <div className="yds-spick-why-card__title-block">
          <Link to={to} className="yds-spick-why-card__name">
            {stock.name}
          </Link>
          <YdsStockPickThemeBadges themes={stock.investThemes ?? []} />
        </div>
        {totalScore != null ? (
          <span className="yds-spick-why-card__score font-mono tabular-nums">{totalScore}</span>
        ) : null}
      </header>

      <div className="yds-spick-why-card__body">
        <YdsStockPickPhase3Breakdown
          stock={stock}
          breakdown={stock.scoreBreakdown}
          v4={stock.v4Score}
          timing={stock.timingScore}
          variant="why"
          showDetails={false}
        />

        {stock.pickMeta?.timingPenaltyReasons?.length ? (
          <div className="yds-spick-why-card__penalty">
            <p className="yds-spick-why-card__penalty-title">타이밍 감점</p>
            <ul className="yds-spick-why-card__penalty-list">
              {stock.pickMeta.timingPenaltyReasons.map((r) => (
                <li key={r}>− {r}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="yds-spick-why-card__lead">왜 이 종목인가?</p>

        <YdsStockPickOpinionBlock opinion={stock.opinion} variant="why" />

        <dl className="yds-spick-why-card__grid">
          {ROWS.map(({ key, label }) => (
            <div key={key} className="yds-spick-why-card__row">
              <dt>{label}</dt>
              <dd>{brief[key]}</dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  )
}
