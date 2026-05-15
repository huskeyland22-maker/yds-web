import { heatSortRank } from "./valueChainTree.js"
import { resolveMarketState } from "./marketStateEngine.js"

function heatRank(heat) {
  const h = String(heat || "").toUpperCase()
  if (h === "VERY HOT") return 3
  if (h === "HOT") return 2
  if (h === "WARM") return 1
  return 0
}

const AI_RELATED_IDS = new Set([
  "hbm-ai-semiconductor",
  "power-grid-hvdc",
  "nuclear-smr",
  "on-device-ai-robotics",
  "ai-datacenter-infra",
  "power-semiconductor-electronics",
  "solid-state-battery",
  "aerospace",
])

export function buildValueChainHero(sectors, panicData) {
  let aiScore = 0
  for (const s of sectors) {
    if (AI_RELATED_IDS.has(s.id)) aiScore += heatRank(s.heat)
  }

  let marketEnergy = "균형·다층 분산"
  if (aiScore >= 14) marketEnergy = "AI 인프라 집중"
  else if (aiScore >= 9) marketEnergy = "AI·전력·데이터 축 강세"
  else if (aiScore >= 5) marketEnergy = "산업 간 순환 강화"

  const hbm = sectors.find((s) => s.id === "hbm-ai-semiconductor")
  const power = sectors.find((s) => s.id === "power-grid-hvdc")
  const dc = sectors.find((s) => s.id === "ai-datacenter-infra")
  const rH = heatRank(hbm?.heat)
  const rP = heatRank(power?.heat)
  const rD = heatRank(dc?.heat)

  let coreFlow = "다수 섹터 동시에 자금 체류"
  if (rH >= 2 && rP >= 2 && rD >= 2) coreFlow = "반도체 → 전력 → 냉각·DC 확산 중"
  else if (rH >= 2 && rP >= 2) coreFlow = "반도체 → 전력 인프라로 확장"
  else if (rH >= 2) coreFlow = "메모리·HBM 채널 우선"
  else if (rP >= 2) coreFlow = "송배전·HVDC 케이블 우선"

  const fg = Number(panicData?.fearGreed)
  let riskState = "중기 심리 혼합"
  if (Number.isFinite(fg)) {
    if (fg >= 75) riskState = "중기 탐욕 진입"
    else if (fg >= 62) riskState = "위험선호 확대"
    else if (fg <= 28) riskState = "공포·방어 선호"
    else if (fg <= 40) riskState = "눌림·대기 심리 우세"
  }

  return { marketEnergy, coreFlow, riskState }
}

/**
 * 밸류체인 상단 헤더 — 좌측 요약 + 우측 매크로 스냅샷용 (히어로 2열).
 * @returns {{
 *   marketEnergy: string
 *   coreFlow: string
 *   riskState: string
 *   hotSectors: Array<{ name: string; icon?: string; heat?: string }>
 *   riskRegimeLabel: string
 *   riskRegimeDetail: string
 * }}
 */
export function buildValueChainHeaderBundle(sectors, panicData) {
  const base = buildValueChainHero(sectors, panicData)
  const sorted = [...sectors].sort((a, b) => {
    const d = heatSortRank(a.heat) - heatSortRank(b.heat)
    if (d !== 0) return d
    return (a.order ?? 0) - (b.order ?? 0)
  })
  const hotSectors = sorted.slice(0, 3).map((s) => ({ name: s.name, icon: s.icon, heat: s.heat }))

  const ms = resolveMarketState(panicData)
  const vix = Number(panicData?.vix)
  const fg = Number(panicData?.fearGreed)
  const riskRegimeLabel = ms.label
  const riskRegimeDetail =
    Number.isFinite(vix) && Number.isFinite(fg)
      ? `VIX ${vix.toFixed(1)} · F&G ${Math.round(fg)}`
      : Number.isFinite(vix)
        ? `VIX ${vix.toFixed(1)}`
        : Number.isFinite(fg)
          ? `F&G ${Math.round(fg)}`
          : "지표 동기화 대기"

  return {
    ...base,
    hotSectors,
    riskRegimeLabel,
    riskRegimeDetail,
    marketState: ms,
    basisLabelKst: ms.basisLabelKst,
    basisNote: ms.basisNote,
  }
}
