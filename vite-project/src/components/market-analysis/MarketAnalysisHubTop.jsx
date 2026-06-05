import { Link } from "react-router-dom"
import { buildMarketHubTopViewModel } from "../../utils/ydsMarketHubPresentation.js"
import ConfidenceBadge from "../trust/ConfidenceBadge.jsx"
import ConfidenceExplainPanel from "../trust/ConfidenceExplainPanel.jsx"
import WhyExplainButton from "../trust/WhyExplainButton.jsx"
import YdsV1ReleaseBadge from "../trust/YdsV1ReleaseBadge.jsx"
import StockRadarPickCard from "../stock-radar/StockRadarPickCard.jsx"
import MarketDashboardSummary from "./MarketDashboardSummary.jsx"
import RecommendationJourneyStrip from "../journey/RecommendationJourneyStrip.jsx"
import { buildRegimeExplainBlock } from "../../trading-zone/ydsRegimeExplain.js"
import { buildPatternExplainBlock } from "../../trading-zone/ydsPatternExplain.js"

/** @param {string | null | undefined} label */
function patternLabelToId(label) {
  if (!label) return null
  const map = {
    리먼형: "lehman",
    코로나형: "covid",
    관세형: "tariff",
    SVB형: "svb",
    강세장형: "bull",
    엔캐리형: "yen_carry",
  }
  for (const [key, id] of Object.entries(map)) {
    if (label.includes(key)) return id
  }
  return null
}

/**
 * @param {{
 *   report: ReturnType<typeof import("../../trading-zone/ydsCurrentMarketAnalysis.js").buildCurrentMarketAnalysisReport>
 *   simplified?: boolean
 * }} props
 */
export default function MarketAnalysisHubTop({ report, simplified = false }) {
  const hub = buildMarketHubTopViewModel(report)
  if (!hub.available) {
    return <p className="yds-market-analysis__empty">시장분석 데이터를 불러오는 중입니다.</p>
  }

  const regimeExplain = buildRegimeExplainBlock({
    regimeId: report.currentState?.regime?.id ?? null,
    regimeLabel: report.currentState?.regime?.label ?? null,
    reason: report.currentState?.regime?.reason ?? null,
    priA: report.currentState?.risk?.priA ?? null,
    priB: report.currentState?.risk?.priB ?? null,
    dominantPattern: report.marketEnvironment?.dominantPattern?.label ?? null,
    durationLabel: null,
  })

  const topPattern = report.stockRadar?.inputs?.dominantPattern
    ? {
        id: patternLabelToId(report.stockRadar.inputs.dominantPattern),
        label: report.stockRadar.inputs.dominantPattern,
        similarity: report.marketEnvironment?.dominantPattern?.similarity ?? null,
      }
    : report.marketEnvironment?.dominantPattern

  const patternExplain =
    topPattern?.id || topPattern?.label
      ? buildPatternExplainBlock({
          patternId: topPattern.id ?? patternLabelToId(topPattern.label),
          similarity: topPattern.similarity ?? null,
          inputs: {
            priA: report.currentState?.risk?.priA ?? null,
            priB: report.currentState?.risk?.priB ?? null,
          },
        })
      : null

  return (
    <div className={`yds-hub-top ${simplified ? "yds-hub-top--simple" : ""}`} aria-label="시장분석 Hub">
      {!simplified ? (
        <div className="yds-hub-top__head">
          <YdsV1ReleaseBadge />
          <ConfidenceBadge
            level={hub.confidence.level}
            tone={hub.confidence.tone}
            score={hub.confidenceScore}
          />
          <Link to="/glossary" className="yds-hub-top__glossary-link">
            용어
          </Link>
        </div>
      ) : null}

      <MarketDashboardSummary hub={hub} report={report} compact={simplified} />

      <RecommendationJourneyStrip step="hub" />

      <details className="yds-hub-top__details">
        <summary>상세 보기 · 종목 Breakdown · 해석 · 패턴</summary>

        {hub.hasStocks ? (
          <section className="yds-hub-top__card yds-hub-top__card--stocks">
            <h2 className="yds-hub-top__h2">추천 종목 상세</h2>
            <div className="yds-hub-top__stock-cards">
              {hub.topStocks.slice(0, 3).map((s) => (
                <StockRadarPickCard key={s.id} pick={s} showJourney />
              ))}
            </div>
          </section>
        ) : null}

        <section className="yds-hub-top__card yds-hub-top__card--interpret">
          <div className="yds-hub-top__card-head">
            <h2 className="yds-hub-top__h2">시장 해석</h2>
            <WhyExplainButton lines={hub.interpretationReasons} />
          </div>
          <p className="yds-hub-top__lead">{hub.interpretationLine}</p>
        </section>

        <section className="yds-hub-top__card">
          <div className="yds-hub-top__card-head">
            <h2 className="yds-hub-top__h2">시장 국면</h2>
            <WhyExplainButton label="왜 경계?" lines={regimeExplain.whyLines} />
          </div>
          <p className="yds-hub-top__lead">{regimeExplain.regimeLabel}</p>
          <ul className="yds-hub-top__reasons">
            {regimeExplain.changeHints30d.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>

        {patternExplain ? (
          <section className="yds-hub-top__card">
            <div className="yds-hub-top__card-head">
              <h2 className="yds-hub-top__h2">위험 패턴</h2>
              <WhyExplainButton
                label="왜 관세형?"
                lines={patternExplain.whyLines}
              />
            </div>
            <ul className="yds-hub-top__reasons">
              {patternExplain.contributors.map((c) => (
                <li key={c.metric}>
                  {c.metric} — {c.note}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <ConfidenceExplainPanel
          confidenceScore={hub.confidenceScore}
          bullSimilarity={report.marketEnvironment?.bullSimilarity ?? null}
          regimeId={report.currentState?.regime?.id ?? null}
          priA={report.currentState?.risk?.priA ?? null}
          priB={report.currentState?.risk?.priB ?? null}
          patternSimilarity={report.marketEnvironment?.dominantPattern?.similarity ?? null}
        />
      </details>
    </div>
  )
}
