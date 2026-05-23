/**
 * 서버용 시장 상태 (marketStateEngine computeMarketState 규칙 이식, window 없음)
 */

import { getAction, getFinalScore, getMidScore, getShortScore } from "./panicScores.js"

const RULES = {
  riskOn: { vixMax: 18, fearGreedMin: 65, bofaMin: 5 },
  neutral: { vixMin: 18, vixMax: 24, fearGreedMin: 40, fearGreedMax: 65 },
  fearDominant: { vixMin: 25, fearGreedMax: 35 },
  volatility: { vixSurgeAbs: 3, vixSurgePct: 0.1, putCallRiseAbs: 0.05, putCallElevated: 1.0 },
  defensive: { hySpreadRiseAbs: 0.2, bofaFallAbs: 0.35 },
}

const META = {
  risk_on: { risk: "낮음", volatility: "낮음", keySignalRisk: "ON" },
  neutral: { risk: "보통", volatility: "안정", keySignalRisk: "혼합" },
  fear_dominant: { risk: "높음", volatility: "확대", keySignalRisk: "OFF" },
  volatility_expansion: { risk: "높음", volatility: "확대", keySignalRisk: "OFF" },
  defensive: { risk: "주의", volatility: "확대", keySignalRisk: "OFF" },
  insufficient: { risk: "—", volatility: "—", keySignalRisk: "—" },
}

function toNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function extractPanicMetrics(data) {
  return {
    vix: toNum(data?.vix),
    fearGreed: toNum(data?.fearGreed ?? data?.fear_greed),
    bofa: toNum(data?.bofa),
    putCall: toNum(data?.putCall ?? data?.put_call),
    highYield: toNum(data?.highYield ?? data?.hy_oas ?? data?.high_yield),
    updatedAt: data?.updatedAt ?? data?.updated_at ?? null,
  }
}

function delta(cur, prev) {
  if (cur == null || prev == null) return null
  return cur - prev
}

function pctDelta(cur, prev) {
  if (cur == null || prev == null || prev === 0) return null
  return (cur - prev) / Math.abs(prev)
}

export function historyRowToMetrics(row) {
  if (!row) return null
  return extractPanicMetrics({
    vix: row.vix,
    fearGreed: row.fear_greed ?? row.fearGreed,
    bofa: row.bofa,
    putCall: row.put_call ?? row.putCall,
    highYield: row.hy_oas ?? row.highYield ?? row.hyOas,
    updatedAt: row.updated_at,
  })
}

export function computeMarketState(metrics, previous = null) {
  const m = metrics ?? {}
  const prev = previous ?? null
  if (m.vix == null || m.fearGreed == null) {
    return { stateKey: "insufficient", ...META.insufficient, headline: "지표 부족" }
  }

  const r = RULES
  if (prev) {
    if (m.vix != null && prev.vix != null) {
      const d = delta(m.vix, prev.vix)
      const p = pctDelta(m.vix, prev.vix)
      if (d != null && (d >= r.volatility.vixSurgeAbs || (p != null && p >= r.volatility.vixSurgePct))) {
        return { stateKey: "volatility_expansion", ...META.volatility_expansion, headline: "변동성 급등" }
      }
    }
    if (m.putCall != null && prev.putCall != null && delta(m.putCall, prev.putCall) >= r.volatility.putCallRiseAbs) {
      return { stateKey: "volatility_expansion", ...META.volatility_expansion, headline: "Put/Call 급등" }
    }
    if (m.highYield != null && prev.highYield != null && delta(m.highYield, prev.highYield) >= r.defensive.hySpreadRiseAbs) {
      return { stateKey: "defensive", ...META.defensive, headline: "신용 스프레드 확대" }
    }
    if (m.bofa != null && prev.bofa != null && delta(m.bofa, prev.bofa) <= -r.defensive.bofaFallAbs) {
      return { stateKey: "defensive", ...META.defensive, headline: "BofA 하락" }
    }
  }

  if (m.vix > r.fearDominant.vixMin && m.fearGreed < r.fearDominant.fearGreedMax) {
    return { stateKey: "fear_dominant", ...META.fear_dominant, headline: "공포 우세" }
  }
  if (m.vix < r.riskOn.vixMax && m.fearGreed > r.riskOn.fearGreedMin && m.bofa != null && m.bofa > r.riskOn.bofaMin) {
    return { stateKey: "risk_on", ...META.risk_on, headline: "Risk-on" }
  }
  if (
    m.vix >= r.neutral.vixMin &&
    m.vix <= r.neutral.vixMax &&
    m.fearGreed >= r.neutral.fearGreedMin &&
    m.fearGreed <= r.neutral.fearGreedMax
  ) {
    return { stateKey: "neutral", ...META.neutral, headline: "중립" }
  }

  return { stateKey: "neutral", ...META.neutral, headline: "복합 중립" }
}

/** @param {ReturnType<typeof import('./panicSnapshot.js').normalizePanicPayload>} snap */
export function buildMarketCyclePayload(snap, previousHistoryRow, source = "api") {
  const data = {
    vix: snap.vix,
    fearGreed: snap.fearGreed,
    putCall: snap.putCall,
    bofa: snap.bofa,
    highYield: snap.highYield,
    updatedAt: snap.updatedAt,
  }
  const metrics = extractPanicMetrics(data)
  const prev = historyRowToMetrics(previousHistoryRow)
  const state = computeMarketState(metrics, prev)
  const panicScore = getFinalScore(data)
  const shortScore = getShortScore(data.vix, data.putCall)
  const midScore = getMidScore(data.fearGreed, data.bofa, data.highYield)
  const recommendation = getAction(panicScore)

  return {
    date: snap.tradeDate,
    panic_score: panicScore,
    market_state: state.stateKey,
    risk_signal: state.keySignalRisk,
    sector: null,
    volatility: state.volatility,
    short_score: shortScore,
    mid_score: midScore,
    long_score: panicScore,
    recommendation,
    source,
    updated_at: snap.updatedAt,
  }
}

/** panic_index_history 행 보강 필드 */
export function enrichPanicHistoryRow(baseRow, snap, previousHistoryRow) {
  const data = {
    vix: snap.vix,
    fearGreed: snap.fearGreed,
    putCall: snap.putCall,
    bofa: snap.bofa,
    highYield: snap.highYield,
  }
  const metrics = extractPanicMetrics(data)
  const prev = historyRowToMetrics(previousHistoryRow)
  const state = computeMarketState(metrics, prev)
  const panicScore = getFinalScore(data)
  return {
    ...baseRow,
    panic_score: baseRow.panic_score ?? panicScore,
    market_phase: baseRow.market_phase ?? state.stateKey,
    risk_level: baseRow.risk_level ?? state.risk,
    strategy: baseRow.strategy ?? getAction(panicScore),
  }
}
