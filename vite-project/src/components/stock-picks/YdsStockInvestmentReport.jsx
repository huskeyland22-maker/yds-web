import { useMemo } from "react"
import { buildStockInvestmentReport } from "../../content/ydsStockInvestmentReportEngine.js"
import { useYdsMarketContext } from "../../hooks/useYdsMarketContext.js"

/**
 * @param {{
 *   stock: import("../../content/ydsStockPickModel.js").StockPickView
 *   compact?: boolean
 * }} props
 */
export default function YdsStockInvestmentReport({ stock, compact = false }) {
  const marketContext = useYdsMarketContext()
  const report = useMemo(
    () => buildStockInvestmentReport(stock, marketContext?.ready ? marketContext : null),
    [stock, marketContext],
  )

  if (!stock) return null

  const showHold = report.holdReasons.length > 0
  const showTiming = report.timingGaps.length > 0 && report.verdict.id !== "aggressiveBuy"

  return (
    <article
      className={["yds-inv-report", compact ? "yds-inv-report--compact" : ""].filter(Boolean).join(" ")}
      aria-label="YDS 투자 리포트"
    >
      <header className="yds-inv-report__head">
        <div>
          <p className="yds-inv-report__kicker">Investment Report · YDS</p>
          <h2 className="yds-inv-report__title">투자 리포트</h2>
        </div>
        <span className={`yds-inv-report__verdict yds-inv-report__verdict--${report.verdict.id}`}>
          {report.verdict.emoji} {report.verdict.label}
        </span>
      </header>

      <blockquote className="yds-inv-report__key">{report.keyPoint}</blockquote>

      <section className="yds-inv-report__block" aria-labelledby="inv-reasons">
        <h3 id="inv-reasons" className="yds-inv-report__h3">
          추천 이유
        </h3>
        {report.recommendReasons.length ? (
          <ol className="yds-inv-report__list yds-inv-report__list--reasons">
            {report.recommendReasons.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        ) : (
          <p className="yds-inv-report__empty">현재 추천 근거가 충분하지 않습니다 · 점수 갱신 대기</p>
        )}
      </section>

      <section className="yds-inv-report__block" aria-labelledby="inv-risks">
        <h3 id="inv-risks" className="yds-inv-report__h3">
          리스크 요인
        </h3>
        {report.riskFactors.length ? (
          <ul className="yds-inv-report__list yds-inv-report__list--risks">
            {report.riskFactors.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="yds-inv-report__empty yds-inv-report__empty--ok">특별 리스크 신호 없음</p>
        )}
      </section>

      {showHold ? (
        <section className="yds-inv-report__block yds-inv-report__block--muted" aria-labelledby="inv-hold">
          <h3 id="inv-hold" className="yds-inv-report__h3">
            보류·관망 이유
          </h3>
          <ul className="yds-inv-report__list">
            {report.holdReasons.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {showTiming ? (
        <section className="yds-inv-report__block yds-inv-report__block--muted" aria-labelledby="inv-timing">
          <h3 id="inv-timing" className="yds-inv-report__h3">
            타이밍 부족 요인
          </h3>
          <ul className="yds-inv-report__list">
            {report.timingGaps.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="yds-inv-report__block" aria-labelledby="inv-market">
        <h3 id="inv-market" className="yds-inv-report__h3">
          현재 시장상태 적합성
        </h3>
        <div className="yds-inv-report__market">
          <span className="yds-inv-report__market-grade font-mono tabular-nums">
            {report.marketFit.grade}
          </span>
          <span className="yds-inv-report__market-score font-mono tabular-nums">
            {report.marketFit.score}/{report.marketFit.max}
          </span>
        </div>
        <p className="yds-inv-report__market-text">{report.marketFit.explanation}</p>
      </section>

      <section className="yds-inv-report__block" aria-labelledby="inv-strategy">
        <h3 id="inv-strategy" className="yds-inv-report__h3">
          투자 전략
        </h3>
        <div className="yds-inv-report__strategy">
          <div className="yds-inv-report__strategy-row">
            <span className="yds-inv-report__strategy-key">보유자</span>
            <p className="yds-inv-report__strategy-val">{report.strategy.holder}</p>
          </div>
          <div className="yds-inv-report__strategy-row">
            <span className="yds-inv-report__strategy-key">미보유자</span>
            <p className="yds-inv-report__strategy-val">{report.strategy.nonHolder}</p>
          </div>
        </div>
      </section>

      <footer className="yds-inv-report__foot">
        점수·시세·시장상태 기반 자동 해설 · 투자 판단은 본인 책임
      </footer>
    </article>
  )
}
