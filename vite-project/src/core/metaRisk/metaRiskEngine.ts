/**
 * YDS Meta Risk Layer v0 — 구조만 (스켈레톤)
 *
 * 금지 (v0):
 * - YDS Core 점수 반영
 * - 추천 엔진 반영
 * - DB 저장 / API 노출
 * - UI 표시
 *
 * 향후: 거시 충격(carry, 유동성, HF, CTA) 감지용 입력 레이어
 */

export type MetaRiskLevel = "normal" | "watch" | "risk" | "shock"

/** 단일 축(캐리·유동성·HF·CTA) */
export interface MetaRiskPillar {
  enabled: boolean
  state: MetaRiskLevel
  score: number
}

export interface MetaRiskState {
  carryTrade: MetaRiskPillar
  liquidity: MetaRiskPillar
  hedgeFund: MetaRiskPillar
  cta: MetaRiskPillar
}

export const defaultMetaRisk: MetaRiskState = {
  carryTrade: {
    enabled: false,
    state: "normal",
    score: 0,
  },
  liquidity: {
    enabled: false,
    state: "normal",
    score: 0,
  },
  hedgeFund: {
    enabled: false,
    state: "normal",
    score: 0,
  },
  cta: {
    enabled: false,
    state: "normal",
    score: 0,
  },
}

/**
 * 향후 데이터 소스 (연결 예정, v0 미사용)
 *
 * carryTrade: USDJPY, JPY, BOJ
 * liquidity: TGA, RRP, QT
 * hedgeFund: CFTC, Prime Broker
 * cta: Dealer Gamma, Options Flow
 */
export const META_RISK_FUTURE_SOURCES = {
  carryTrade: ["USDJPY", "JPY", "BOJ"],
  liquidity: ["TGA", "RRP", "QT"],
  hedgeFund: ["CFTC", "Prime Broker"],
  cta: ["Dealer Gamma", "Options Flow"],
} as const

function clonePillar(p: MetaRiskPillar): MetaRiskPillar {
  return { enabled: p.enabled, state: p.state, score: p.score }
}

/** 불변 기본값 복제 */
export function createDefaultMetaRiskState(): MetaRiskState {
  return {
    carryTrade: clonePillar(defaultMetaRisk.carryTrade),
    liquidity: clonePillar(defaultMetaRisk.liquidity),
    hedgeFund: clonePillar(defaultMetaRisk.hedgeFund),
    cta: clonePillar(defaultMetaRisk.cta),
  }
}

/**
 * v0: 입력 무시, 항상 비활성 기본 상태 반환.
 * Core / 추천 / DB / API 에 연결하지 말 것.
 */
export function evaluateMetaRisk(_inputs?: unknown): MetaRiskState {
  return createDefaultMetaRiskState()
}
