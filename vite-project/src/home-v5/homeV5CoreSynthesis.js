import { resolveCoreMetricDataStatus } from "./homeV5CoreMetricLayers.js"
import { buildMarketPolicy } from "../trading-zone/marketPolicyEngine.js"

/** @typedef {"fearGreed" | "vix" | "bofa"} HomeV5CoreMetricKey */

/** @typedef {{
 *   headline: string
 *   signalLine: string
 *   tone: "panic" | "caution" | "pullback" | "neutral" | "overheat"
 * }} HomeV5CoreSynthesisModel */

/** @type {Record<string, string>} */
const FG_SIGNAL = {
  "극단 탐욕": "탐욕 과열",
  탐욕: "심리 강세",
  중립: "심리 중립",
  "공포 경계": "공포 경계",
  "극단 공포": "공포 확대",
}

/** @type {Record<string, string>} */
const VIX_SIGNAL = {
  "높은 변동성": "변동성 확대",
  "확대된 변동성": "변동성 확대",
  "보통 변동성": "변동성 보통",
  "낮은 변동성": "변동성 축소",
}

/** @type {Record<string, string>} */
const BOFA_SIGNAL = {
  "극단 낙관": "낙관 과열",
  "낙관 우세": "낙관 우세",
  중립: "신용 중립",
  보수: "보수 우세",
  "극단 공포": "신용 위축",
}

/** @type {Record<import("../trading-zone/marketPolicyEngine.js").MarketState, string>} */
const VERDICT_BY_STATE = {
  overheat: "과열 구간 · 추격 금지 · 눌림 대기",
  caution: "경계 구간 · 추격 금지 · 선별 대기",
  neutral: "중립 구간 · 추격보다 눌림 우세",
  pullback: "눌림 구간 · 분할 진입 · 추격 제한",
  panic: "패닉 구간 · 분할 대응 · 추격 금지",
}

/**
 * @param {HomeV5CoreMetricKey} key
 * @param {string} statusLabel
 */
function shortenSignal(key, statusLabel) {
  if (!statusLabel || statusLabel === "—") return null
  if (key === "fearGreed") return FG_SIGNAL[statusLabel] ?? statusLabel
  if (key === "vix") return VIX_SIGNAL[statusLabel] ?? statusLabel
  return BOFA_SIGNAL[statusLabel] ?? statusLabel
}

/**
 * @param {string} fg
 * @param {string} vix
 * @param {string} bofa
 * @param {import("../trading-zone/marketPolicyEngine.js").MarketState} marketState
 */
function resolveContextVerdict(fg, vix, bofa, marketState) {
  const greed = /탐욕|강세/.test(fg)
  const fear = /공포/.test(fg)
  const lowVol = vix === "변동성 축소"
  const highVol = /확대/.test(vix)
  const bull = /낙관/.test(bofa)
  const bear = /보수|위축/.test(bofa)

  if (marketState === "panic" || (fear && highVol)) {
    return "패닉·변동 확대 · 분할 대응 · 추격 금지"
  }
  if (marketState === "overheat" || (greed && bull && /과열/.test(fg + bofa))) {
    return "과열 압력 · 추격 금지 · 현금 확보"
  }
  if (greed && lowVol && bull) {
    return "낙관·저변동 · 추격보다 눌림 우세"
  }
  if (greed && lowVol) {
    return "탐욕·저변동 · 추격보다 눌림 우세"
  }
  if (fear && lowVol && !bear) {
    return "공포 완화 · 선별 분할 검토"
  }
  if (highVol && !fear) {
    return "변동성 확대 · 신규 진입 제한"
  }
  if (bear && fear) {
    return "보수·공포 · 현금·분할 우선"
  }
  if (bull && !greed && lowVol) {
    return "낙관 우세 · 눌림 대기 우선"
  }

  return VERDICT_BY_STATE[marketState] ?? VERDICT_BY_STATE.neutral
}

/**
 * @param {string} verdict
 * @param {import("../trading-zone/marketPolicyEngine.js").MarketState} marketState
 * @param {string} fg
 * @param {string} vix
 * @param {string} bofa
 */
function resolveSynthesisHeadline(verdict, marketState, fg, vix, bofa) {
  const greed = /탐욕|강세/.test(fg)
  const lowVol = vix === "변동성 축소"
  const bull = /낙관/.test(bofa)

  if (greed && lowVol && bull) return "눌림 대기 우위"
  if (greed && lowVol) return "눌림 대기 우위"
  if (marketState === "overheat") return "추격 금지 우위"
  if (marketState === "panic") return "분할 대응 우위"
  if (marketState === "pullback") return "눌림 분할 우위"
  if (marketState === "caution") return "선별 대기 우위"
  if (/추격보다 눌림/.test(verdict)) return "눌림 대기 우위"
  if (/추격 금지/.test(verdict)) return "추격 금지 우위"
  if (/현금/.test(verdict)) return "현금 확보 우위"
  if (/분할/.test(verdict)) return "분할 대응 우위"

  const parts = verdict.split("·").map((s) => s.trim()).filter(Boolean)
  const action = parts[parts.length - 1] ?? parts[0] ?? "관망"
  return action.includes("우위") ? action : `${action} 우위`
}

/**
 * @param {object | null | undefined} panicData
 * @param {ReturnType<typeof buildMarketPolicy> | null | undefined} [marketPolicy]
 * @returns {HomeV5CoreSynthesisModel}
 */
export function buildHomeV5CoreSynthesis(panicData, marketPolicy = null) {
  const policy = marketPolicy ?? buildMarketPolicy({ panicData })
  const state = policy.marketState ?? "neutral"

  const fgRaw = resolveCoreMetricDataStatus("fearGreed", panicData?.fearGreed)
  const vixRaw = resolveCoreMetricDataStatus("vix", panicData?.vix)
  const bofaRaw = resolveCoreMetricDataStatus("bofa", panicData?.bofa)

  const fg = shortenSignal("fearGreed", fgRaw)
  const vix = shortenSignal("vix", vixRaw)
  const bofa = shortenSignal("bofa", bofaRaw)
  const parts = [fg, vix, bofa].filter(Boolean)

  if (!parts.length) {
    return {
      headline: "데이터 확인 중",
      signalLine: "지표 동기화 중",
      tone: "neutral",
    }
  }

  const signalLine = parts.join(" + ")
  const verdict = resolveContextVerdict(fg ?? "", vix ?? "", bofa ?? "", state)
  const headline = resolveSynthesisHeadline(verdict, state, fg ?? "", vix ?? "", bofa ?? "")

  return {
    headline,
    signalLine,
    tone: state,
  }
}
