import { getFinalScore } from "../utils/tradingScores.js"
import { getVixV3FinalScore, VIX_V3_ENGINE_ID, VIX_V3_ENGINE_LABEL } from "./ydsVixV3Engine.js"

export const VIX_V3_ENGINE_FLAG_KEY = "VITE_USE_VIX_V3_ENGINE"
export const LEGACY_ENGINE_ID = "legacy"
export const LEGACY_ENGINE_LABEL = "Legacy (getFinalScore)"

const LS_OVERRIDE_KEY = "yds-use-vix-v3-engine"

function truthy(v) {
  return v === "1" || v === "true" || v === true
}

/** Build-time flag: VITE_USE_VIX_V3_ENGINE=true|1 */
export function isVixV3EngineEnabledFromEnv() {
  return truthy(import.meta.env?.[VIX_V3_ENGINE_FLAG_KEY])
}

/** Dev/runtime override via localStorage (검증·스테이징용) */
export function isVixV3EngineEnabledFromStorage() {
  if (typeof window === "undefined") return false
  try {
    return truthy(window.localStorage.getItem(LS_OVERRIDE_KEY))
  } catch {
    return false
  }
}

/** Active engine — env OR localStorage override. Default: legacy. */
export function isUseVixV3EngineEnabled() {
  return isVixV3EngineEnabledFromEnv() || isVixV3EngineEnabledFromStorage()
}

export function setVixV3EngineLocalOverride(enabled) {
  if (typeof window === "undefined") return
  try {
    if (enabled) window.localStorage.setItem(LS_OVERRIDE_KEY, "true")
    else window.localStorage.removeItem(LS_OVERRIDE_KEY)
  } catch {
    // ignore
  }
}

export function getActiveEngineId() {
  return isUseVixV3EngineEnabled() ? VIX_V3_ENGINE_ID : LEGACY_ENGINE_ID
}

export function getActiveEngineLabel() {
  return isUseVixV3EngineEnabled() ? VIX_V3_ENGINE_LABEL : LEGACY_ENGINE_LABEL
}

/**
 * Feature-flagged YDS score. Default = legacy getFinalScore.
 * @param {{ vix?: number; putCall?: number; fearGreed?: number; bofa?: number; highYield?: number }} data
 * @param {{ forceEngine?: "legacy" | "v3" | "active" }} [options]
 */
export function getActiveYdsScore(data, options = {}) {
  const force = options.forceEngine ?? "active"
  if (force === "legacy") return getFinalScore(data ?? {})
  if (force === "v3") return getVixV3FinalScore(data ?? {})
  return isUseVixV3EngineEnabled() ? getVixV3FinalScore(data ?? {}) : getFinalScore(data ?? {})
}

/** @deprecated alias */
export const getYdsScore = getActiveYdsScore

export function describeEngineFeatureFlagState() {
  return {
    envEnabled: isVixV3EngineEnabledFromEnv(),
    localOverride: isVixV3EngineEnabledFromStorage(),
    active: isUseVixV3EngineEnabled(),
    activeEngineId: getActiveEngineId(),
    activeEngineLabel: getActiveEngineLabel(),
    flagKey: VIX_V3_ENGINE_FLAG_KEY,
    localOverrideKey: LS_OVERRIDE_KEY,
  }
}
