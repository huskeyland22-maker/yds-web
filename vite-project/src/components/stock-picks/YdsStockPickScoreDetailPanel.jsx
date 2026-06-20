import { useMemo } from "react"
import { buildStockPickScoreDetail } from "../../content/ydsStockPickScoreDetailEngine.js"
import { resolveStockPosition } from "../../content/ydsStockPositionEngine.js"
import YdsStockPickChangeStrip from "./YdsStockPickChangeStrip.jsx"
import { useYdsMarketContext } from "../../hooks/useYdsMarketContext.js"

/**
 * @param {{ items: { label: string; display: string; sub?: string }[] }} props
 */
function ScoreRows({ items }) {
  return (
    <ul className="yds-spick-score__rows">
      {items.map((item) => (
        <li key={item.label} className="yds-spick-score__row">
          <span>{item.label}</span>
          {item.sub ? <span className="yds-spick-score__sub">{item.sub}</span> : null}
          <strong className="font-mono tabular-nums">{item.display}</strong>
        </li>
      ))}
    </ul>
  )
}

function ContributionBars({ contribution }) {
  const bars = [
    { key: "quality", label: "기업품질", ...contribution.quality, color: "#6366f1" },
    { key: "timing", label: "타이밍", ...contribution.timing, color: "#22c55e" },
    { key: "marketFit", label: "시장적합", ...contribution.marketFit, color: "#f59e0b" },
  ]
  return (
    <div className="yds-spick-score__bars" role="img" aria-label="점수 기여도">
      {bars.map((b) => (
        <div key={b.key} className="yds-spick-score__bar-col">
          <div className="yds-spick-score__bar-track">
            <div
              className="yds-spick-score__bar-fill"
              style={{ width: `${b.pct}%`, background: b.color }}
            />
          </div>
          <span className="yds-spick-score__bar-label">{b.label}</span>
          <span className="yds-spick-score__bar-pct font-mono tabular-nums">{b.pct}%</span>
        </div>
      ))}
    </div>
  )
}

function ConfidenceGauge({ confidence, totalScore }) {
  const pct = confidence.score
  const ringStyle = {
    background: `conic-gradient(#60a5fa ${pct * 3.6}deg, rgba(42,54,72,0.5) 0deg)`,
  }
  return (
    <div className="yds-spick-score__confidence">
      <div className="yds-spick-score__gauge" style={ringStyle} aria-hidden="true">
        <div className="yds-spick-score__gauge-inner">
          <span className="yds-spick-score__gauge-grade">{confidence.grade}</span>
          <strong className="font-mono tabular-nums">{confidence.score}</strong>
        </div>
      </div>
      <div className="yds-spick-score__confidence-meta">
        <p>
          추천 <strong className="font-mono tabular-nums">{totalScore}</strong>
          {" · "}
          신뢰도 <strong className="font-mono tabular-nums">{confidence.score}</strong>
        </p>
        <ul className="yds-spick-score__confidence-factors">
          {confidence.factors.map((f) => (
            <li key={f.id}>
              <span>{f.label}</span>
              <span className="font-mono tabular-nums">{f.score}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/**
 * @param {{ stock: import("../../content/ydsStockPickModel.js").StockPickView }} props
 */
export default function YdsStockPickScoreDetailPanel({ stock }) {
  const marketContext = useYdsMarketContext()
  const detail = useMemo(
    () => buildStockPickScoreDetail(stock, marketContext?.ready ? marketContext : null),
    [stock, marketContext],
  )
  const position = useMemo(
    () => stock.pickMeta?.positionState ?? resolveStockPosition(stock),
    [stock],
  )

  return (
    <article className="yds-spick-score" aria-label="추천 점수 상세">
      <div
        className={[
          "yds-spick-score__position",
          `yds-spick-position--${position.tone}`,
        ].join(" ")}
      >
        <span className="yds-spick-score__position-label">현재 위치</span>
        <strong>{position.label}</strong>
        <span className="yds-spick-score__position-hint">{position.interpretation}</span>
      </div>
      <header className="yds-spick-score__head">
        <div>
          <p className="yds-spick-score__kicker">Score Transparency · YDS</p>
          <h2 className="yds-spick-score__total font-mono tabular-nums">
            총점 {detail.totalScore}점
          </h2>
        </div>
        <span className={`yds-spick-score__status yds-spick-score__status--${detail.status.tone}`}>
          {detail.status.label}
        </span>
      </header>

      <ConfidenceGauge confidence={detail.confidence} totalScore={detail.totalScore} />

      <YdsStockPickChangeStrip stock={stock} variant="detail" className="yds-spick-score__change" />

      <section className="yds-spick-score__block" aria-labelledby="sp-score-quality">
        <h3 id="sp-score-quality" className="yds-spick-score__h3">
          기업품질 세부
        </h3>
        <ScoreRows items={detail.qualityItems} />
      </section>

      <section className="yds-spick-score__block" aria-labelledby="sp-score-timing">
        <h3 id="sp-score-timing" className="yds-spick-score__h3">
          타이밍 세부
        </h3>
        <ScoreRows items={detail.timingItems} />
      </section>

      <section className="yds-spick-score__block" aria-labelledby="sp-score-market">
        <h3 id="sp-score-market" className="yds-spick-score__h3">
          시장적합 세부
        </h3>
        <ScoreRows items={detail.marketFitItems} />
      </section>

      <section className="yds-spick-score__block" aria-labelledby="sp-score-bars">
        <h3 id="sp-score-bars" className="yds-spick-score__h3">
          점수 기여도
        </h3>
        <ContributionBars contribution={detail.contribution} />
      </section>

      <section className="yds-spick-score__block" aria-labelledby="sp-score-why">
        <h3 id="sp-score-why" className="yds-spick-score__h3">
          추천 · 제외 사유
        </h3>
        <div className="yds-spick-score__why-grid">
          <div>
            <p className="yds-spick-score__why-title yds-spick-score__why-title--ok">추천 사유</p>
            {detail.recommendReasons.length ? (
              <ul className="yds-spick-score__why-list yds-spick-score__why-list--ok">
                {detail.recommendReasons.map((r) => (
                  <li key={r}>✓ {r}</li>
                ))}
              </ul>
            ) : (
              <p className="yds-spick-score__empty">—</p>
            )}
          </div>
          <div>
            <p className="yds-spick-score__why-title yds-spick-score__why-title--warn">제외·약점</p>
            {detail.excludeReasons.length ? (
              <ul className="yds-spick-score__why-list yds-spick-score__why-list--warn">
                {detail.excludeReasons.map((r) => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
            ) : (
              <p className="yds-spick-score__empty">특별 제외 사유 없음</p>
            )}
          </div>
        </div>
        <blockquote className="yds-spick-score__interpret">{detail.interpretation}</blockquote>
      </section>
    </article>
  )
}
