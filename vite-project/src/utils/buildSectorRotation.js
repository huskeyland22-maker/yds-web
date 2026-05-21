/**
 * YDS Sector Rotation — Cycle + 패닉 최종 (채권·유동성 판단·섹터 결정 없음)
 */
import { resolveCyclePosition } from "../market-os/positionLabels.js"
import { sectorFlowStocks } from "./sectorFlowNav.js"
import { computeMarketAction } from "./panicMarketActionEngine.js"

/** @typedef {'watch' | 'neutral' | 'caution' | 'alert'} SectorRotationState */

/**
 * @typedef {{
 *   id: string
 *   label: string
 *   state: SectorRotationState
 *   stateLabel: string
 *   score: number
 *   reasons: string[]
 *   picks: { name: string; code?: string; note?: string }[]
 *   koreaSectorId?: string
 * }} RotationSectorCard
 */

/**
 * @typedef {{
 *   ready: boolean
 *   regimeLabel: string
 *   watchSummary: string
 *   cautionSummary: string
 *   sectors: RotationSectorCard[]
 *   primaryWatchId: string | null
 * }} SectorRotationResult
 */

/** @type {Record<SectorRotationState, string>} */
export const ROTATION_STATE_LABELS = {
  watch: "관심",
  neutral: "중립",
  caution: "주의",
  alert: "경고",
}

/** @type {{ id: string; label: string; koreaSectorId?: string; picks: { name: string; code?: string; note?: string }[] }[]} */
export const ROTATION_SECTOR_DEFS = [
  {
    id: "ai",
    label: "AI",
    koreaSectorId: "ai-semiconductor",
    picks: [
      { name: "엔비디아", note: "AI GPU" },
      { name: "TSMC", note: "파운드리" },
      { name: "성장 ETF", note: "QQQ·SOXX" },
      { name: "SK하이닉스", code: "000660", note: "HBM" },
    ],
  },
  {
    id: "semi",
    label: "반도체",
    koreaSectorId: "ai-semiconductor",
    picks: [
      { name: "SK하이닉스", code: "000660" },
      { name: "삼성전자", code: "005930" },
      { name: "한미반도체", code: "042700" },
      { name: "리노공업", code: "058470" },
    ],
  },
  {
    id: "power",
    label: "전력",
    koreaSectorId: "power-infra",
    picks: [
      { name: "HD현대일렉트릭", code: "267260" },
      { name: "LS ELECTRIC", code: "010120" },
      { name: "효성중공업", code: "298040" },
    ],
  },
  {
    id: "value",
    label: "가치",
    picks: [
      { name: "KODEX 200", note: "대형 가치" },
      { name: "삼성전자", code: "005930", note: "배당·대형" },
      { name: "현대차", code: "005380", note: "저평가 사이클" },
    ],
  },
  {
    id: "defense",
    label: "방산",
    koreaSectorId: "defense-space",
    picks: [
      { name: "한화에어로스페이스", code: "012450" },
      { name: "LIG넥스원", code: "079550" },
      { name: "현대로템", code: "064350" },
    ],
  },
  {
    id: "ship",
    label: "조선",
    koreaSectorId: "shipbuilding",
    picks: [
      { name: "HD한국조선해양", code: "009540" },
      { name: "한화오션", code: "042660" },
      { name: "HD현대중공업", code: "329180" },
    ],
  },
  {
    id: "bio",
    label: "바이오",
    koreaSectorId: "bio-healthcare",
    picks: [
      { name: "삼성바이오로직스", code: "207940" },
      { name: "셀트리온", code: "068270" },
      { name: "유한양행", code: "000100" },
    ],
  },
  {
    id: "battery",
    label: "2차전지",
    koreaSectorId: "battery-materials",
    picks: [
      { name: "LG에너지솔루션", code: "373220" },
      { name: "에코프로비엠", code: "247540" },
      { name: "포스코퓨처엠", code: "003670" },
    ],
  },
  {
    id: "cash",
    label: "현금",
    picks: [
      { name: "머니마켓", note: "유동성" },
      { name: "KODEX 단기채", note: "단기채" },
      { name: "현금성 ETF", note: "방어" },
    ],
  },
]

const ROTATION_IDS = ROTATION_SECTOR_DEFS.map((d) => d.id)

/**
 * @param {{
 *   cycleScore?: number | null
 *   panicData?: object | null
 * }} input
 */
function buildMarketContext({ cycleScore, panicData }) {
  const cycle = resolveCyclePosition(cycleScore)
  const action = computeMarketAction(panicData)

  const c = Number(cycleScore)
  const fearLate = Number.isFinite(c) && c > 15 && c <= 32
  const fear = action?.regime === "fear" || action?.regime === "extreme_fear"
  const greed = action?.regime === "greed" || action?.regime === "extreme_greed"

  return { cycle, action, fearLate, fear, greed, cycleScore: c }
}

/**
 * @param {ReturnType<typeof buildMarketContext>} ctx
 * @returns {Record<string, { score: number; reasons: string[] }>}
 */
function scoreRotationSectors(ctx) {
  /** @type {Record<string, { score: number; reasons: string[] }>} */
  const out = Object.fromEntries(ROTATION_IDS.map((id) => [id, { score: 0, reasons: [] }]))

  const add = (id, pts, reason) => {
    if (!out[id]) return
    out[id].score += pts
    if (reason && !out[id].reasons.includes(reason)) out[id].reasons.push(reason)
  }

  if (ctx.fearLate) {
    add("ai", 3, "공포 후반")
    add("semi", 3, "눌림 관심")
    add("value", 2, "가치 우호")
    add("battery", 1, "분할 관찰")
  }

  if (ctx.fear) {
    add("value", 2, "공포 구간")
    add("cash", 2, "방어")
    add("bio", 1, "바이오 방어")
    add("ai", 1, "눌림 대기")
    add("semi", 1, "소액 분할")
  }

  if (ctx.greed) {
    add("ai", 2, "Risk-on")
    add("semi", 2, "성장")
    add("power", 1, "전력 수요")
    add("ship", 1, "사이클")
  }

  if (Number.isFinite(ctx.cycleScore)) {
    const c = ctx.cycleScore
    if (c >= 55) {
      add("cash", 2, "과열·현금")
      add("ai", -1, "추격 주의")
      add("semi", -1, "과열")
    }
    if (c <= 28) add("cash", 2, "극단 공포")
    if (c >= 48 && c < 58) add("defense", 1, "방산 관찰")
    if (c >= 40 && c < 52) add("ship", 1, "조선")
    if (c >= 35 && c < 50) add("power", 1, "전력")
  }

  if (!ctx.fear && !ctx.greed && !ctx.fearLate) {
    add("power", 1, "중립")
    add("ship", 1, "중립")
  }

  return out
}

/** @param {number} score */
function scoreToState(score) {
  if (score >= 2) return "watch"
  if (score <= -3) return "alert"
  if (score <= -1) return "caution"
  return "neutral"
}

/** @param {string} id */
function picksForSector(id) {
  const def = ROTATION_SECTOR_DEFS.find((d) => d.id === id)
  if (!def) return []
  if (def.koreaSectorId) {
    const fromFlow = sectorFlowStocks(def.koreaSectorId).map((s) => ({
      name: s.name,
      code: s.code,
    }))
    if (fromFlow.length) return fromFlow.slice(0, 4)
  }
  return def.picks.slice(0, 4)
}

/** @param {RotationSectorCard[]} sectors @param {SectorRotationState} state */
function summarizeByState(sectors, state) {
  return sectors
    .filter((s) => s.state === state)
    .map((s) => s.label)
    .join(" · ")
}

/**
 * @param {{
 *   panicData?: object | null
 *   cycleScore?: number | null
 *   snapshot?: import("../macro-risk/engine.js").MacroRiskSnapshot | null
 * }} input
 * @returns {SectorRotationResult}
 */
export function buildSectorRotation({ panicData = null, cycleScore = null }) {
  const ctx = buildMarketContext({ cycleScore, panicData })
  const scored = scoreRotationSectors(ctx)

  const sectors = ROTATION_SECTOR_DEFS.map((def) => {
    const row = scored[def.id] ?? { score: 0, reasons: [] }
    const state = scoreToState(row.score)
    return {
      id: def.id,
      label: def.label,
      state,
      stateLabel: ROTATION_STATE_LABELS[state],
      score: row.score,
      reasons: row.reasons,
      picks: picksForSector(def.id),
      koreaSectorId: def.koreaSectorId,
    }
  })

  const regimeParts = []
  if (ctx.cycle.position && ctx.cycle.position !== "데이터 대기") regimeParts.push(ctx.cycle.position)
  if (ctx.action?.regimeLabel) regimeParts.push(ctx.action.regimeLabel)

  const watchSummary = summarizeByState(sectors, "watch") || "—"
  const cautionParts = [
    ...sectors.filter((s) => s.state === "alert").map((s) => s.label),
    ...sectors.filter((s) => s.state === "caution").map((s) => s.reasons[0]).filter(Boolean),
  ]
  const cautionSummary =
    cautionParts.length > 0
      ? [...new Set(cautionParts)].slice(0, 4).join(" · ")
      : "특이 없음"

  const primaryWatch = sectors.find((s) => s.state === "watch") ?? null

  const hasCycle = Number.isFinite(Number(cycleScore))
  const hasPanic = Boolean(ctx.action)
  const ready = hasCycle || hasPanic

  return {
    ready,
    regimeLabel: regimeParts.join(" · ") || "시장 데이터 대기",
    watchSummary,
    cautionSummary,
    sectors,
    primaryWatchId: primaryWatch?.id ?? null,
  }
}
