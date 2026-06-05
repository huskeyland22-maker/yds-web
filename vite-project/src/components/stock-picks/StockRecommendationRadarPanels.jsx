import { Link } from "react-router-dom"
import { formatSectorRadarScore } from "../../trading-zone/ydsPrecursorEnginePhase25.js"
import { formatStockRadarScore } from "../../trading-zone/ydsPrecursorEnginePhase26.js"
import StockRadarPickCard from "../stock-radar/StockRadarPickCard.jsx"
import YdsEmptyState from "../trust/YdsEmptyState.jsx"

/**
 * @param {{
 *   report: ReturnType<typeof import("../../trading-zone/ydsCurrentMarketAnalysis.js").buildCurrentMarketAnalysisReport>
 * }} props
 */
export default function StockRecommendationRadarPanels({ report }) {
  const sectors = report.sectorRadar?.topSectors ?? []
  const stocks = report.stockRadar?.topBuys ?? []

  return (
    <>
      <section className="yds-stock-reco__section" aria-labelledby="stock-reco-sector">
        <h2 id="stock-reco-sector" className="yds-stock-reco__h2">
          추천 섹터
        </h2>
        {sectors.length ? (
          <ol className="yds-stock-reco__sector-list">
            {sectors.slice(0, 5).map((s) => (
              <li key={s.id}>
                <span className="font-mono tabular-nums">{s.rank}</span>
                <span>{s.label}</span>
                <span className="font-mono tabular-nums">{formatSectorRadarScore(s.score)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <YdsEmptyState
            icon="📂"
            title="추천 섹터 없음"
            description="시장분석 데이터가 준비되면 섹터 순위가 표시됩니다."
            primaryTo="/market-analysis"
            primaryLabel="시장분석"
            className="yds-empty-state--inline"
          />
        )}
      </section>

      <section className="yds-stock-reco__section" aria-labelledby="stock-reco-picks">
        <div className="yds-stock-reco__section-head">
          <h2 id="stock-reco-picks" className="yds-stock-reco__h2">
            종목 추천
          </h2>
          <Link to="/glossary#stock-radar" className="yds-stock-reco__glossary">
            산식 설명
          </Link>
        </div>
        {stocks.length ? (
          <div className="yds-stock-reco__cards">
            {stocks.map((s) => (
              <StockRadarPickCard key={s.id} pick={s} showJourney={false} />
            ))}
          </div>
        ) : (
          <YdsEmptyState
            icon="⭐"
            title="추천 종목 없음"
            description="시장분석을 먼저 확인한 뒤 종목 점수를 산출합니다."
            primaryTo="/market-analysis"
            primaryLabel="시장분석"
            className="yds-empty-state--inline"
          />
        )}
        {stocks.length ? (
          <p className="yds-stock-reco__hint font-mono tabular-nums">
            Top {stocks.length} · 점수 {formatStockRadarScore(stocks[0]?.score)}~
            {formatStockRadarScore(stocks[stocks.length - 1]?.score)}
          </p>
        ) : null}
      </section>
    </>
  )
}
