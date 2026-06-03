import { getVixVariantFinalScore, VIX_EXPERIMENT_V3_ANCHORS } from "./ydsVixSensitivityLab.js"

/** VIX V3 Production Candidate scoring path (legacy getFinalScore unchanged) */
export const VIX_V3_ENGINE_ID = "vix-v3"
export const VIX_V3_ENGINE_LABEL = "VIX V3 Production Candidate"
export const VIX_V3_ENGINE_NOTE =
  "scoreVIX 40→100 · 50→125 · 60→155 · 70→195 · 80→250 + 기존 HY/동적가중 · 단기·중기 합성"

/**
 * @param {{ vix?: number; putCall?: number; fearGreed?: number; bofa?: number; highYield?: number }} data
 */
export function getVixV3FinalScore(data) {
  return getVixVariantFinalScore(data ?? {}, VIX_EXPERIMENT_V3_ANCHORS)
}

export { VIX_EXPERIMENT_V3_ANCHORS }
