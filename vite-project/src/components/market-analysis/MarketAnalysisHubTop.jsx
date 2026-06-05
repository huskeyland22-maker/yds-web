import { Link } from "react-router-dom"
import { buildMarketHubTopViewModel } from "../../utils/ydsMarketHubPresentation.js"
import ConfidenceBadge from "../trust/ConfidenceBadge.jsx"
import ConfidenceExplainPanel from "../trust/ConfidenceExplainPanel.jsx"
import WhyExplainButton from "../trust/WhyExplainButton.jsx"
import YdsV1ReleaseBadge from "../trust/YdsV1ReleaseBadge.jsx"
import StockRadarPickCard from "../stock-radar/StockRadarPickCard.jsx"
import MarketDashboardSummary from "./MarketDashboardSummary.jsx"
import RecommendationJourneyStrip from "../journey/RecommendationJourneyStrip.jsx"
import YdsEmptyState from "../trust/YdsEmptyState.jsx"
import YdsRiskPatternLabel from "../validation/YdsRiskPatternLabel.jsx"
import { getPatternProfile } from "../../trading-zone/ydsPatternExplain.js"
import { UI_BTN, UI_PAGE } from "../../utils/ydsUiLabels.js"
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
 *   marketOnly?: boolean
 * }} props
 */
export default function MarketAnalysisHubTop({ report, simplified = false, marketOnly = false }) {
  const hub = buildMarketHubTopViewModel(report)
  if (!hub.available) {
    return (
      <YdsEmptyState
        icon="⏳"
        title="시장분석 준비 중"
        description="Cycle 스냅샷을 불러오는 중입니다. 잠시 후 다시 시도하거나 시작 가이드를 확인하세요."
        primaryTo="/start"
        primaryLabel="시작 가이드"
        secondaryTo="/faq"
        secondaryLabel="FAQ"
      />
    )
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

      {!marketOnly ? <MarketDashboardSummary hub={hub} report={report} compact={simplified} /> : null}

      {!marketOnly ? <RecommendationJourneyStrip step="hub" /> : (
        <nav className="yds-journey-strip" aria-label="다음 단계">
          <span className="yds-journey-strip__label">다음 단계</span>
          <div className="yds-journey-strip__links">
            <Link to="/stock-picks" className="yds-journey-strip__link yds-journey-strip__link--primary">
              {UI_PAGE.stockPicks?.title ?? "종목추천"}
            </Link>
            <Link to="/alert-center" className="yds-journey-strip__link">
              알림
            </Link>
          </div>
        </nav>
      )}

      <details className="yds-hub-top__details" open={marketOnly || undefined}>
        <summary>{marketOnly ? "시장 해설 · 국면 · 패턴" : `${UI_BTN.detail} · 점수 구성 · 해석 · 패턴`}</summary>

        {!marketOnly && hub.hasStocks ? (
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

        <section className="yds-hub-top__card yds-hub-top__card--pattern">
          <div className="yds-hub-top__card-head">
            <h2 className="yds-hub-top__h2">위험 패턴</h2>
            {patternExplain ? (
              <WhyExplainButton label="왜 이 패턴?" lines={patternExplain.whyLines} />
            ) : null}
          </div>
          {topPattern?.label || topPattern?.id ? (
            <div className="yds-hub-top__pattern-profile">
              <p className="yds-hub-top__pattern-line">
                <YdsRiskPatternLabel
                  patternId={topPattern.id}
                  patternLabel={topPattern.label}
                  showInfo={false}
                />
              </p>
              {(() => {
                const pid = topPattern.id ?? patternLabelToId(topPattern.label)
                const profile = getPatternProfile(pid)
                return profile ? (
                  <p className="yds-hub-top__pattern-explain">
                    <span className="yds-hub-top__pattern-tagline">({profile.tagline})</span>{" "}
                    {profile.explain}
                  </p>
                ) : null
              })()}
              {topPattern.similarity != null ? (
                <p className="yds-hub-top__pattern-sim font-mono tabular-nums">
                  유사도 {Math.round(topPattern.similarity)}%
                </p>
              ) : null}
            </div>
          ) : (
            <p className="yds-hub-top__muted">우세 위험 패턴 없음</p>
          )}
          {patternExplain?.contributors?.length ? (
            <ul className="yds-hub-top__reasons">
              {patternExplain.contributors.map((c) => (
                <li key={c.metric}>
                  {c.metric} — {c.note}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

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
