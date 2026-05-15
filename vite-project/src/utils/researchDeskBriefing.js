/**
 * Research Desk · Korea — 패닉지표 + 섹터 Heat + 시장상태 기반 자동 브리핑.
 * Today's Key Signal과 동일 소스.
 */

import { heatSortRank } from "./valueChainTree.js"
import {
  extractPanicMetrics,
  formatMarketBasisKst,
  readPreviousCycleMetrics,
  resolveMarketState,
} from "./marketStateEngine.js"

export const DESK_CLUSTER_IDS = {
  ai: [
    "hbm-ai-semiconductor",
    "ai-datacenter-infra",
    "on-device-ai-robotics",
    "power-semiconductor-electronics",
  ],
  defensePower: ["defense", "power-grid-hvdc", "nuclear-smr", "aerospace"],
  growth: ["solid-state-battery", "biosimilar-cdmo", "autonomous-automotive"],
}

export const DESK_FLOW_TEMPLATES = [
  {
    ids: ["hbm-ai-semiconductor", "power-grid-hvdc", "ai-datacenter-infra"],
    text: "반도체 → 전력 → 냉각·DC 확산 중",
    minRank: 2,
  },
  {
    ids: ["defense", "power-grid-hvdc", "nuclear-smr"],
    text: "방산 → 전력기기 → HVDC 순환",
    minRank: 2,
  },
  {
    ids: ["hbm-ai-semiconductor", "ai-datacenter-infra"],
    text: "HBM → 서버 → 냉각 확산",
    minRank: 2,
  },
  {
    ids: ["hbm-ai-semiconductor", "power-grid-hvdc"],
    text: "반도체 → 전력 인프라로 확장",
    minRank: 2,
  },
]

const SECTOR_FLOW_SHORT = {
  "hbm-ai-semiconductor": "반도체",
  "power-grid-hvdc": "전력",
  "ai-datacenter-infra": "냉각·DC",
  defense: "방산",
  "nuclear-smr": "원전",
  aerospace: "항공",
  "solid-state-battery": "2차전지",
  "biosimilar-cdmo": "바이오",
  "on-device-ai-robotics": "로보틱스",
  "autonomous-automotive": "모빌리티",
  "power-semiconductor-electronics": "전력반도체",
  "shipbuilding-offshore": "조선",
  "entertainment-kculture": "콘텐츠",
}

const SECTOR_THEME = {
  "hbm-ai-semiconductor": "HBM 수요 확대",
  "ai-datacenter-infra": "냉각 수혜 부각",
  "power-grid-hvdc": "전력 인프라 강화",
  "on-device-ai-robotics": "온디바이스 AI 가속",
  defense: "K-방산 수출 모멘텀",
  "nuclear-smr": "원전·SMR 재평가",
  "solid-state-battery": "차세대 배터리 기대",
  "biosimilar-cdmo": "바이오 CDMO 수요",
  "autonomous-automotive": "모빌리티 전환 수혜",
}

function heatRank(heat) {
  const h = String(heat || "").toUpperCase()
  if (h === "VERY HOT") return 3
  if (h === "HOT") return 2
  if (h === "WARM") return 1
  return 0
}

function clusterScore(sectors, ids) {
  let sum = 0
  for (const s of sectors) {
    if (!ids.includes(s.id)) continue
    sum += heatRank(s.heat)
  }
  return sum
}

function sortSectorsByHeat(sectors) {
  return [...sectors].sort((a, b) => {
    const d = heatSortRank(b.heat) - heatSortRank(a.heat)
    if (d !== 0) return d
    return (a.order ?? 0) - (b.order ?? 0)
  })
}

function sectorById(sectors, id) {
  return sectors.find((s) => s.id === id)
}

function isMarketWeak(ms, sectors) {
  if (ms.stateKey === "fear_dominant" || ms.stateKey === "volatility_expansion" || ms.stateKey === "defensive") {
    return true
  }
  const hotCount = sectors.filter((s) => heatRank(s.heat) >= 2).length
  const avg = sectors.length ? sectors.reduce((a, s) => a + heatRank(s.heat), 0) / sectors.length : 0
  return hotCount <= 2 && avg < 1.15
}

/** @param {Array<{ id: string; heat?: string }>} sectors */
export function computeMarketEnergy(sectors, ms) {
  if (isMarketWeak(ms, sectors)) return "현금·방어 선호"

  const ai = clusterScore(sectors, DESK_CLUSTER_IDS.ai)
  const defense = clusterScore(sectors, DESK_CLUSTER_IDS.defensePower)
  const growth = clusterScore(sectors, DESK_CLUSTER_IDS.growth)

  const ranked = [
    { key: "ai", score: ai, label: "AI 인프라 집중", min: 6 },
    { key: "defense", score: defense, label: "방어 인프라 순환", min: 5 },
    { key: "growth", score: growth, label: "성장주 위험선호 확대", min: 4 },
  ].sort((a, b) => b.score - a.score)

  const top = ranked[0]
  if (top && top.score >= top.min) return top.label

  const leader = sortSectorsByHeat(sectors)[0]
  if (leader && heatRank(leader.heat) >= 2 && SECTOR_THEME[leader.id]) {
    return SECTOR_THEME[leader.id]
  }

  return ms.headline || ms.label
}

function templateMatches(sectors, template) {
  return template.ids.every((id) => heatRank(sectorById(sectors, id)?.heat) >= template.minRank)
}

/** @param {Array<{ id: string; heat?: string; name?: string }>} sectors */
export function computeCoreFlow(sectors) {
  for (const t of DESK_FLOW_TEMPLATES) {
    if (templateMatches(sectors, t)) return t.text
  }

  const top = sortSectorsByHeat(sectors).filter((s) => heatRank(s.heat) >= 1).slice(0, 3)
  const labels = top.map((s) => SECTOR_FLOW_SHORT[s.id]).filter(Boolean)
  if (labels.length === 0) return "—"
  if (labels.length === 1) return `${labels[0]} 채널 우선`
  const suffix = top.some((s) => DESK_CLUSTER_IDS.defensePower.includes(s.id)) ? "순환" : "확산 중"
  return `${labels.join(" → ")} ${suffix}`
}

function hySpreadRising(metrics, previous) {
  if (metrics.highYield == null || previous?.highYield == null) return false
  return metrics.highYield - previous.highYield >= 0.2
}

/** @param {ReturnType<typeof extractPanicMetrics>} metrics */
export function computeRiskSignals(metrics, previous, ms) {
  /** @type {string[]} */
  const out = []

  if (metrics.vix != null && metrics.vix > 25) out.push("변동성 확대")
  else if (metrics.vix != null && metrics.vix >= 22) out.push("변동성 경계")

  if (metrics.fearGreed != null && metrics.fearGreed > 70) out.push("단기 과열 경계")
  else if (metrics.fearGreed != null && metrics.fearGreed < 30) out.push("공포 심리 우세")

  if (hySpreadRising(metrics, previous)) out.push("신용 스트레스 확대")

  if (metrics.putCall != null && metrics.putCall >= 1.05) out.push("옵션 방어 쏠림")

  if (metrics.bofa != null && previous?.bofa != null && metrics.bofa - previous.bofa <= -0.35) {
    out.push("투자심리 둔화")
  }

  if (ms.stateKey === "defensive" && !out.includes("신용 스트레스 확대")) {
    out.push("방어 모드 진입")
  }

  if (out.length === 0) {
    if (ms.stateKey === "risk_on") out.push("위험선호 확대")
    else if (ms.stateKey === "neutral") out.push("중기 심리 혼합")
    else out.push(ms.shortLabel || ms.label)
  }

  return [...new Set(out)].slice(0, 3).join(" · ")
}

/** @param {Array<{ id: string; heat?: string; name?: string }>} sectors */
export function computeTodaysTheme(sectors, marketEnergy) {
  if (marketEnergy === "AI 인프라 집중") return "AI 인프라 집중"
  if (marketEnergy === "방어 인프라 순환") return "방어·전력 인프라 강화"
  if (marketEnergy === "성장주 위험선호 확대") return marketEnergy
  if (marketEnergy === "현금·방어 선호") return "방어·현금 비중 확대"

  const top = sortSectorsByHeat(sectors).filter((s) => heatRank(s.heat) >= 2).slice(0, 2)
  const themes = top.map((s) => SECTOR_THEME[s.id]).filter(Boolean)
  if (themes.length >= 2) return `${themes[0]} · ${themes[1]}`
  if (themes.length === 1) return themes[0]
  const warm = sortSectorsByHeat(sectors).find((s) => heatRank(s.heat) >= 1)
  if (warm && SECTOR_THEME[warm.id]) return SECTOR_THEME[warm.id]
  return marketEnergy
}

function parseKstDisplay(raw) {
  if (!raw || typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed || trimmed === "-") return null
  if (/KST/i.test(trimmed)) return trimmed.replace(/\s*KST\s*$/i, " KST").trim()
  const iso = new Date(trimmed)
  if (Number.isFinite(iso.getTime())) return formatMarketBasisKst(iso.toISOString())
  return trimmed
}

function parseToMs(label) {
  if (!label) return NaN
  const m = label.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/)
  if (!m) return NaN
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]) - 9, Number(m[5]))
}

/**
 * @param {string | null | undefined} heatUpdatedAtRaw
 * @param {unknown} panicData
 * @param {{ basisLabelKst?: string; basisNote?: string }} marketState
 */
export function resolveDeskTimestamps(heatUpdatedAtRaw, panicData, marketState) {
  const sectorAt = parseKstDisplay(heatUpdatedAtRaw)
  const macroAt = marketState.basisLabelKst || formatMarketBasisKst(panicData?.updatedAt ?? panicData?.updated_at)
  const sectorMs = parseToMs(sectorAt)
  const macroMs = parseToMs(macroAt)

  let primaryAt = macroAt
  let primaryNote = marketState.basisNote || "미국장 종가 기준"

  if (sectorAt && Number.isFinite(sectorMs)) {
    if (!Number.isFinite(macroMs) || sectorMs > macroMs) {
      primaryAt = sectorAt
      primaryNote = "섹터 Heat 갱신"
    } else if (sectorAt !== macroAt) {
      return {
        heatTimestampLine: `Heat · ${sectorAt}`,
        heatBasisLine: `매크로 · ${macroAt} · ${marketState.basisNote || "미국장 종가 기준"}`,
        sectorHeatAt: sectorAt,
        macroBasisAt: macroAt,
      }
    }
  }

  return {
    heatTimestampLine: primaryAt ? `Heat · ${primaryAt}` : "Heat · —",
    heatBasisLine: primaryNote,
    sectorHeatAt: sectorAt,
    macroBasisAt: macroAt,
  }
}

/**
 * @param {Array<{ id: string; heat?: string; name?: string; icon?: string; order?: number }>} sectors
 * @param {unknown} panicData
 * @param {{ heatUpdatedAt?: string | null }} [options]
 */
export function buildResearchDeskBriefing(sectors, panicData, options = {}) {
  const list = Array.isArray(sectors) ? sectors : []
  const metrics = extractPanicMetrics(panicData)
  const ms = resolveMarketState(panicData)
  const previous = ms.previous ?? readPreviousCycleMetrics(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
      metrics.updatedAt ? new Date(metrics.updatedAt) : new Date(),
    ),
  )

  const marketEnergy = computeMarketEnergy(list, ms)
  const coreFlow = computeCoreFlow(list)
  const riskState = computeRiskSignals(metrics, previous, ms)
  const todaysTheme = computeTodaysTheme(list, marketEnergy)
  const timestamps = resolveDeskTimestamps(options.heatUpdatedAt, panicData, ms)

  const hotSectors = sortSectorsByHeat(list)
    .slice(0, 3)
    .map((s) => ({ name: s.name, icon: s.icon, heat: s.heat, id: s.id }))

  return {
    marketEnergy,
    coreFlow,
    riskState,
    todaysTheme,
    hotSectors,
    marketState: ms,
    basisLabelKst: ms.basisLabelKst,
    basisNote: ms.basisNote,
    riskRegimeLabel: ms.label,
    riskRegimeDetail:
      metrics.vix != null && metrics.fearGreed != null
        ? `VIX ${metrics.vix.toFixed(1)} · F&G ${Math.round(metrics.fearGreed)}`
        : metrics.vix != null
          ? `VIX ${metrics.vix.toFixed(1)}`
          : metrics.fearGreed != null
            ? `F&G ${Math.round(metrics.fearGreed)}`
            : "—",
    heatTimestampLine: timestamps.heatTimestampLine,
    heatBasisLine: timestamps.heatBasisLine,
    sectorHeatAt: timestamps.sectorHeatAt,
    macroBasisAt: timestamps.macroBasisAt,
  }
}
