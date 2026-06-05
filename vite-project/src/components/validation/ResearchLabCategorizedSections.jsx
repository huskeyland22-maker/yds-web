import ResearchCategoryAccordion from "./ResearchCategoryAccordion.jsx"
import ResearchSectionAccordion from "./ResearchSectionAccordion.jsx"
import { VALIDATION_PHASE_SUBTITLES } from "./ValidationPhaseAccordion.jsx"
import YdsPrecursorEnginePhase1Section from "./YdsPrecursorEnginePhase1Section.jsx"
import YdsPrecursorEnginePhase2Section from "./YdsPrecursorEnginePhase2Section.jsx"
import YdsPrecursorEnginePhase3Section from "./YdsPrecursorEnginePhase3Section.jsx"
import YdsPrecursorEnginePhase4Section from "./YdsPrecursorEnginePhase4Section.jsx"
import YdsPrecursorEnginePhase5Section from "./YdsPrecursorEnginePhase5Section.jsx"
import YdsPrecursorEnginePhase6Section from "./YdsPrecursorEnginePhase6Section.jsx"
import YdsPrecursorEnginePhase7Section from "./YdsPrecursorEnginePhase7Section.jsx"
import YdsPrecursorEnginePhase8Section from "./YdsPrecursorEnginePhase8Section.jsx"
import YdsPrecursorEnginePhase9Section from "./YdsPrecursorEnginePhase9Section.jsx"
import YdsPrecursorEnginePhase10Section from "./YdsPrecursorEnginePhase10Section.jsx"
import YdsPrecursorEnginePhase11Section from "./YdsPrecursorEnginePhase11Section.jsx"
import YdsPrecursorEnginePhase13Section from "./YdsPrecursorEnginePhase13Section.jsx"
import YdsPrecursorEnginePhase15Section from "./YdsPrecursorEnginePhase15Section.jsx"
import YdsPrecursorEnginePhase16Section from "./YdsPrecursorEnginePhase16Section.jsx"
import YdsPrecursorEnginePhase17Section from "./YdsPrecursorEnginePhase17Section.jsx"
import YdsPrecursorEnginePhase18Section from "./YdsPrecursorEnginePhase18Section.jsx"
import YdsPrecursorEnginePhase20Section from "./YdsPrecursorEnginePhase20Section.jsx"
import YdsPrecursorEnginePhase21Section from "./YdsPrecursorEnginePhase21Section.jsx"
import YdsPrecursorEnginePhase22Section from "./YdsPrecursorEnginePhase22Section.jsx"
import ResearchAnalyticsTools from "./ResearchAnalyticsTools.jsx"

/**
 * @param {{
 *   events: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[]
 *   latestCycleRow: Record<string, unknown> | null
 *   historyRows: object[]
 * }} props
 */
export default function ResearchLabCategorizedSections({ events, latestCycleRow, historyRows }) {
  const cycleProps = { events, latestCycleRow, historyRows }

  return (
    <div className="research-lab-categories" aria-label="연구실 카테고리">
      <ResearchAnalyticsTools latestCycleRow={latestCycleRow} historyRows={historyRows} />

      <ResearchCategoryAccordion
        title="전조 엔진"
        description="조기경보 · 충격감지 · 행동가이드 · 신뢰도"
      >
        <ResearchSectionAccordion title={VALIDATION_PHASE_SUBTITLES[1]}>
          <YdsPrecursorEnginePhase1Section events={events} />
        </ResearchSectionAccordion>
        <ResearchSectionAccordion title={VALIDATION_PHASE_SUBTITLES[2]}>
          <YdsPrecursorEnginePhase2Section events={events} />
        </ResearchSectionAccordion>
        <ResearchSectionAccordion title={VALIDATION_PHASE_SUBTITLES[3]}>
          <YdsPrecursorEnginePhase3Section {...cycleProps} />
        </ResearchSectionAccordion>
        <ResearchSectionAccordion title={VALIDATION_PHASE_SUBTITLES[4]}>
          <YdsPrecursorEnginePhase4Section events={events} />
        </ResearchSectionAccordion>
        <ResearchSectionAccordion title={VALIDATION_PHASE_SUBTITLES[15]}>
          <YdsPrecursorEnginePhase15Section events={events} latestCycleRow={latestCycleRow} />
        </ResearchSectionAccordion>
        <ResearchSectionAccordion title={VALIDATION_PHASE_SUBTITLES[16]}>
          <YdsPrecursorEnginePhase16Section events={events} latestCycleRow={latestCycleRow} />
        </ResearchSectionAccordion>
        <ResearchSectionAccordion title={VALIDATION_PHASE_SUBTITLES[17]}>
          <YdsPrecursorEnginePhase17Section events={events} latestCycleRow={latestCycleRow} />
        </ResearchSectionAccordion>
        <ResearchSectionAccordion title={VALIDATION_PHASE_SUBTITLES[18]}>
          <YdsPrecursorEnginePhase18Section events={events} latestCycleRow={latestCycleRow} />
        </ResearchSectionAccordion>
      </ResearchCategoryAccordion>

      <ResearchCategoryAccordion title="패턴 분석" description="TP · 위험 패턴 · 국면 탐지">
        <ResearchSectionAccordion title={VALIDATION_PHASE_SUBTITLES[5]}>
          <YdsPrecursorEnginePhase5Section {...cycleProps} />
        </ResearchSectionAccordion>
        <ResearchSectionAccordion title={VALIDATION_PHASE_SUBTITLES[6]}>
          <YdsPrecursorEnginePhase6Section {...cycleProps} />
        </ResearchSectionAccordion>
        <ResearchSectionAccordion title={VALIDATION_PHASE_SUBTITLES[7]}>
          <YdsPrecursorEnginePhase7Section events={events} />
        </ResearchSectionAccordion>
        <ResearchSectionAccordion title={VALIDATION_PHASE_SUBTITLES[8]}>
          <YdsPrecursorEnginePhase8Section events={events} />
        </ResearchSectionAccordion>
        <ResearchSectionAccordion title={VALIDATION_PHASE_SUBTITLES[9]}>
          <YdsPrecursorEnginePhase9Section {...cycleProps} />
        </ResearchSectionAccordion>
        <ResearchSectionAccordion title={VALIDATION_PHASE_SUBTITLES[10]}>
          <YdsPrecursorEnginePhase10Section {...cycleProps} />
        </ResearchSectionAccordion>
      </ResearchCategoryAccordion>

      <ResearchCategoryAccordion title="타임머신" description="국면 이력 · 패닉 타임머신">
        <ResearchSectionAccordion title={VALIDATION_PHASE_SUBTITLES[11]}>
          <YdsPrecursorEnginePhase11Section {...cycleProps} />
        </ResearchSectionAccordion>
        <ResearchSectionAccordion title={VALIDATION_PHASE_SUBTITLES[20]}>
          <YdsPrecursorEnginePhase20Section events={events} />
        </ResearchSectionAccordion>
      </ResearchCategoryAccordion>

      <ResearchCategoryAccordion title="검증 리포트" description="실시장 로그 · 스코어카드 · 라이브 비교">
        <ResearchSectionAccordion title={VALIDATION_PHASE_SUBTITLES[13]}>
          <YdsPrecursorEnginePhase13Section events={events} latestCycleRow={latestCycleRow} />
        </ResearchSectionAccordion>
        <ResearchSectionAccordion title={VALIDATION_PHASE_SUBTITLES[21]}>
          <YdsPrecursorEnginePhase21Section events={events} />
        </ResearchSectionAccordion>
        <ResearchSectionAccordion title={VALIDATION_PHASE_SUBTITLES[22]}>
          <YdsPrecursorEnginePhase22Section {...cycleProps} />
        </ResearchSectionAccordion>
      </ResearchCategoryAccordion>
    </div>
  )
}
