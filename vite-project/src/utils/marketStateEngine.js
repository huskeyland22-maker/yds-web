/**
 * 패닉지표 기반 시장 상태 자동 계산 (하드코딩 UI 금지 — 규칙은 본 모듈만).
 */

import { formatMarketBasisKst, resolveMarketTimestampDisplay } from "./marketTimestamp.js"

export { formatMarketBasisKst } from "./marketTimestamp.js"

const CYCLE_HISTORY_KEY = "yds-cycle-metric-history-v1"
const DAILY_STATE_KEY = "yds-market-state-daily-v1"

/** @typedef {"risk_on"|"neutral"|"fear_dominant"|"volatility_expansion"|"defensive"|"insufficient"} MarketStateKey */

export const MARKET_STATE_RULES = {
  riskOn: { vixMax: 18, fearGreedMin: 65, bofaMin: 5 },
  neutral: { vixMin: 18, vixMax: 24, fearGreedMin: 40, fearGreedMax: 65 },
  fearDominant: { vixMin: 25, fearGreedMax: 35 },
  volatility: {
    vixSurgeAbs: 3,
    vixSurgePct: 0.1,
    putCallRiseAbs: 0.05,
    putCallElevated: 1.0,
  },
  defensive: { hySpreadRiseAbs: 0.2, bofaFallAbs: 0.35 },
}

const STATE_META = {
  risk_on: {
    label: "Risk-on",
    shortLabel: "Risk-on",
    color: "#34d399",
    risk: "낮음",
    headline: "위험선호 확대 · 변동성 억제 구간",
    keySignalRisk: "ON",
    mood: "확장",
    volatility: "낮음",
  },
  neutral: {
    label: "중립",
    shortLabel: "중립",
    color: "#94a3b8",
    risk: "보통",
    headline: "방향성 혼조 · 섹터별 차별화",
    keySignalRisk: "혼합",
    mood: "중립",
    volatility: "안정",
  },
  fear_dominant: {
    label: "공포 우세",
    shortLabel: "공포 우세",
    color: "#f87171",
    risk: "높음",
    headline: "공포 심리 우세 · 방어 우선",
    keySignalRisk: "OFF",
    mood: "방어",
    volatility: "확대",
  },
  volatility_expansion: {
    label: "변동성 확대",
    shortLabel: "변동성 확대",
    color: "#fb923c",
    risk: "높음",
    headline: "변동성 급등 · 헤지·분할 대응",
    keySignalRisk: "OFF",
    mood: "경계",
    volatility: "확대",
  },
  defensive: {
    label: "방어 모드",
    shortLabel: "방어 모드",
    color: "#fbbf24",
    risk: "주의",
    headline: "신용·심리 방어 · 현금 탄력",
    keySignalRisk: "OFF",
    mood: "방어",
    volatility: "확대",
  },
  insufficient: {
    label: "데이터 부족",
    shortLabel: "—",
    color: "#64748b",
    risk: "—",
    headline: "지표 동기화 대기",
    keySignalRisk: "—",
    mood: "—",
    volatility: "—",
  },
}

function toNum(v) {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** @param {unknown} data */
export function extractPanicMetrics(data) {
  return {
    vix: toNum(data?.vix),
    fearGreed: toNum(data?.fearGreed),
    bofa: toNum(data?.bofa),
    putCall: toNum(data?.putCall),
    highYield: toNum(data?.highYield),
    updatedAt: data?.updatedAt ?? data?.updated_at ?? null,
  }
}

function kstDayKey(iso) {
  const d = iso ? new Date(iso) : new Date()
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d)
}

function delta(cur, prev) {
  if (cur == null || prev == null) return null
  return cur - prev
}

function pctDelta(cur, prev) {
  if (cur == null || prev == null || prev === 0) return null
  return (cur - prev) / Math.abs(prev)
}

function matchesRiskOn(m) {
  const r = MARKET_STATE_RULES.riskOn
  return m.vix != null && m.vix < r.vixMax && m.fearGreed != null && m.fearGreed > r.fearGreedMin && m.bofa != null && m.bofa > r.bofaMin
}

function matchesNeutral(m) {
  const r = MARKET_STATE_RULES.neutral
  const vixOk = m.vix != null && m.vix >= r.vixMin && m.vix <= r.vixMax
  const fgOk = m.fearGreed != null && m.fearGreed >= r.fearGreedMin && m.fearGreed <= r.fearGreedMax
  return vixOk && fgOk
}

function matchesFearDominant(m) {
  const r = MARKET_STATE_RULES.fearDominant
  return m.vix != null && m.vix > r.vixMin && m.fearGreed != null && m.fearGreed < r.fearGreedMax
}

function matchesVolatilityExpansion(m, prev) {
  const r = MARKET_STATE_RULES.volatility
  if (m.vix != null && prev?.vix != null) {
    const d = delta(m.vix, prev.vix)
    const p = pctDelta(m.vix, prev.vix)
    if (d != null && (d >= r.vixSurgeAbs || (p != null && p >= r.vixSurgePct))) return true
  }
  if (m.putCall != null && prev?.putCall != null) {
    const d = delta(m.putCall, prev.putCall)
    if (d != null && d >= r.putCallRiseAbs) return true
  }
  if (m.putCall != null && m.putCall >= r.putCallElevated && prev?.putCall != null && prev.putCall < r.putCallElevated - 0.03) {
    return true
  }
  return false
}

function matchesDefensive(m, prev) {
  const r = MARKET_STATE_RULES.defensive
  if (m.highYield != null && prev?.highYield != null) {
    const d = delta(m.highYield, prev.highYield)
    if (d != null && d >= r.hySpreadRiseAbs) return true
  }
  if (m.bofa != null && prev?.bofa != null) {
    const d = delta(m.bofa, prev.bofa)
    if (d != null && d <= -r.bofaFallAbs) return true
  }
  return false
}

/**
 * @param {ReturnType<typeof extractPanicMetrics>} metrics
 * @param {ReturnType<typeof extractPanicMetrics> | null} [previous]
 */
export function computeMarketState(metrics, previous = null) {
  const m = metrics ?? {}
  const prev = previous ?? null
  const hasCore = m.vix != null && m.fearGreed != null
  if (!hasCore) {
    return buildResult("insufficient", ["핵심 지표(VIX·Fear&Greed) 부족"], m)
  }

  /** @type {string[]} */
  const reasons = []

  if (matchesVolatilityExpansion(m, prev)) {
    if (m.vix != null && prev?.vix != null && delta(m.vix, prev.vix) >= MARKET_STATE_RULES.volatility.vixSurgeAbs) {
      reasons.push(`VIX 급등 (${prev.vix.toFixed(2)} → ${m.vix.toFixed(2)})`)
    }
    if (m.putCall != null && prev?.putCall != null && delta(m.putCall, prev.putCall) >= MARKET_STATE_RULES.volatility.putCallRiseAbs) {
      reasons.push(`Put/Call 상승 (${prev.putCall.toFixed(2)} → ${m.putCall.toFixed(2)})`)
    }
    return buildResult("volatility_expansion", reasons, m)
  }

  if (matchesDefensive(m, prev)) {
    if (m.highYield != null && prev?.highYield != null && delta(m.highYield, prev.highYield) >= MARKET_STATE_RULES.defensive.hySpreadRiseAbs) {
      reasons.push(`HY Spread 상승 (${prev.highYield.toFixed(2)} → ${m.highYield.toFixed(2)})`)
    }
    if (m.bofa != null && prev?.bofa != null && delta(m.bofa, prev.bofa) <= -MARKET_STATE_RULES.defensive.bofaFallAbs) {
      reasons.push(`BofA 하락 (${prev.bofa.toFixed(2)} → ${m.bofa.toFixed(2)})`)
    }
    return buildResult("defensive", reasons, m)
  }

  if (matchesFearDominant(m)) {
    reasons.push(`VIX ${m.vix?.toFixed(2)} > ${MARKET_STATE_RULES.fearDominant.vixMin}`)
    reasons.push(`Fear&Greed ${m.fearGreed} < ${MARKET_STATE_RULES.fearDominant.fearGreedMax}`)
    return buildResult("fear_dominant", reasons, m)
  }

  if (matchesRiskOn(m)) {
    reasons.push(`VIX < ${MARKET_STATE_RULES.riskOn.vixMax}`)
    reasons.push(`Fear&Greed > ${MARKET_STATE_RULES.riskOn.fearGreedMin}`)
    reasons.push(`BofA > ${MARKET_STATE_RULES.riskOn.bofaMin}`)
    return buildResult("risk_on", reasons, m)
  }

  if (matchesNeutral(m)) {
    reasons.push(`VIX ${MARKET_STATE_RULES.neutral.vixMin}~${MARKET_STATE_RULES.neutral.vixMax}`)
    reasons.push(`Fear&Greed ${MARKET_STATE_RULES.neutral.fearGreedMin}~${MARKET_STATE_RULES.neutral.fearGreedMax}`)
    return buildResult("neutral", reasons, m)
  }

  reasons.push("복합 구간 — 기본 중립 분류")
  return buildResult("neutral", reasons, m)
}

function buildResult(stateKey, reasons, metrics) {
  const meta = STATE_META[stateKey] ?? STATE_META.insufficient
  const basisAt = metrics.updatedAt ?? new Date().toISOString()
  const ts = resolveMarketTimestampDisplay({ updatedAt: basisAt })
  return {
    stateKey,
    label: meta.label,
    shortLabel: meta.shortLabel,
    color: meta.color,
    risk: meta.risk,
    headline: meta.headline,
    keySignalRisk: meta.keySignalRisk,
    marketMood: meta.mood,
    volatility: meta.volatility,
    reasons,
    basisAt,
    basisLabelKst: ts.basisLabelKst,
    basisNote: ts.basisNote,
    updateTimestampLine: ts.updateLine,
    basisLine: ts.basisLine,
    rulesVersion: "panic-v1",
  }
}

/** @returns {ReturnType<typeof extractPanicMetrics> | null} */
export function readPreviousCycleMetrics(currentDayKey) {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(CYCLE_HISTORY_KEY)
    if (!raw) return null
    const rows = JSON.parse(raw)
    if (!Array.isArray(rows) || rows.length < 2) return null
    const sorted = [...rows].sort((a, b) => String(a.date).localeCompare(String(b.date)))
    const prior = sorted.filter((r) => String(r.date) < String(currentDayKey))
    const row = prior.length ? prior[prior.length - 1] : sorted[sorted.length - 2]
    if (!row) return null
    return {
      vix: toNum(row.vix),
      fearGreed: toNum(row.fearGreed),
      bofa: toNum(row.bofa),
      putCall: toNum(row.putCall),
      highYield: toNum(row.highYield),
      updatedAt: row.ts ?? null,
    }
  } catch {
    return null
  }
}

/**
 * 당일(KST) 1회 계산·캐시 (패닉 데이터 갱신 시 재계산).
 * @param {unknown} panicData
 */
export function resolveMarketState(panicData) {
  const metrics = extractPanicMetrics(panicData)
  const dayKey = kstDayKey(metrics.updatedAt)
  const previous = readPreviousCycleMetrics(dayKey)
  const dataUpdated = metrics.updatedAt ? String(metrics.updatedAt) : ""

  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(DAILY_STATE_KEY)
      if (raw) {
        const cached = JSON.parse(raw)
        if (
          cached?.dayKey === dayKey &&
          cached?.dataUpdatedAt === dataUpdated &&
          cached?.result?.stateKey
        ) {
          return { ...cached.result, cached: true, previous }
        }
      }
    } catch {
      /* ignore */
    }
  }

  const result = computeMarketState(metrics, previous)

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        DAILY_STATE_KEY,
        JSON.stringify({
          dayKey,
          dataUpdatedAt: dataUpdated,
          computedAt: new Date().toISOString(),
          result,
        }),
      )
    } catch {
      /* ignore */
    }
  }

  return { ...result, cached: false, previous }
}
