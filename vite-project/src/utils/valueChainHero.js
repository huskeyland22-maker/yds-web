import { buildResearchDeskBriefing } from "./researchDeskBriefing.js"

/** @deprecated use buildResearchDeskBriefing */
export function buildValueChainHero(sectors, panicData, options) {
  const d = buildResearchDeskBriefing(sectors, panicData, options)
  return {
    marketEnergy: d.marketEnergy,
    coreFlow: d.coreFlow,
    riskState: d.riskState,
  }
}

/**
 * 밸류체인 상단 헤더 — Research Desk 브리핑 엔진과 동일 소스.
 */
export function buildValueChainHeaderBundle(sectors, panicData, options) {
  return buildResearchDeskBriefing(sectors, panicData, options)
}
