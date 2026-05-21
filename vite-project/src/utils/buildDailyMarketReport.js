/**
 * YDS Daily Market Report — 판단 → 행동 즉시 연결 (Cycle 우선, 채권 참고)
 */
import { buildBondReferenceDisplay } from "../market-os/bondLiquidityReference.js"
import { resolveCycleZone } from "./cycleZoneLabels.js"
import { compactPhrase, phrasesEqual, uniquePhrases } from "./dailyReportCopy.js"
import { computeMarketAction } from "./panicMarketActionEngine.js"
import { computeMarketTiming } from "./panicMarketTimingEngine.js"
import { buildSectorRotation } from "./buildSectorRotation.js"

/**
 * @typedef {{
 *   market: string
 *   bond: string
 *   leaders: string
 * }} DailyMarketToday
 */

/**
 * @typedef {{
 *   today: string
 *   ai: string
 *   cash: string
 *   risk: string
 * }} DailyActionToday
 */

/**
 * @typedef {{
 *   short: string
 *   mid: string
 *   long: string
 *   practical: string
 * }} DailyStrategy
 */

/**
 * @typedef {{
 *   leaders: string[]
 *   caution: string[]
 * }} DailySectorFocus
 */

/**
 * @typedef {{
 *   ready: boolean
 *   marketToday: DailyMarketToday
 *   actionToday: DailyActionToday
 *   strategy: DailyStrategy
 *   sectors: DailySectorFocus
 *   oneLiner: string[]
 * }} DailyMarketReport
 */

const LEADER_SECTOR_ORDER = ["AI", "반도체", "전력", "방산", "조선", "가치", "바이오", "2차전지"]

/** @param {number} c */
function cashRange(c) {
  if (!Number.isFinite(c)) return "20~30"
  if (c <= 28) return "25~35"
  if (c <= 38) return "18~28"
  if (c <= 48) return "12~22"
  if (c <= 58) return "10~18"
  return "8~15"
}

/**
 * @param {import("./cycleZoneLabels.js").CycleZoneId | null} zone
 * @param {import("./panicMarketActionEngine.js").MarketRegime} regime
 * @param {number} cycleScore
 */
function buildActionToday(zone, regime, cycleScore) {
  const c = Number(cycleScore)
  let today = "관망"
  let ai = "선별 관망"
  let risk = "변동성 감시"

  if (zone === "low") {
    today = "추격 금지"
    ai = "눌림 대기"
  } else if (zone === "high" || regime === "greed" || regime === "extreme_greed") {
    today = "추격 금지"
    ai = "익절·비중 조절"
    risk = "과열 잔존 감시"
  } else if (zone === "transition") {
    today = "추세 확인"
    ai = "분할 관심"
  }

  if (regime === "extreme_fear" || regime === "fear") {
    today = "추격 금지"
    ai = "눌림 대기"
    risk = "헤지·변동성"
  }

  return {
    today: compactPhrase(today),
    ai: compactPhrase(ai),
    cash: cashRange(c),
    risk: compactPhrase(risk),
  }
}

/** @param {import("./panicMarketTimingEngine.js").MarketTimingGuide | null} timing */
function buildStrategy(timing) {
  let short = compactPhrase(timing?.short?.actionShort || timing?.short?.action || "관망")
  let mid = compactPhrase(timing?.mid?.actionShort || timing?.mid?.action || "관망")
  let long = compactPhrase(timing?.long?.actionShort || timing?.long?.action || "관망")

  if (phrasesEqual(short, mid)) short = "익절·조정"
  if (phrasesEqual(long, mid)) long = "적립 유지"
  if (phrasesEqual(short, long)) short = "단기 대응"

  const practical = uniquePhrases(
    [
      short.includes("분할") || short.includes("대기") ? "분할 대기" : null,
      mid.includes("확대") ? "분할 관심" : "분할 관심",
      short.includes("익절") ? null : "익절 검토",
    ].filter(Boolean),
    2,
  ).join(" · ")

  return {
    short,
    mid,
    long,
    practical: practical || "분할 대기 · 분할 관심",
  }
}

/** @param {ReturnType<typeof buildSectorRotation>} rotation */
function buildSectorFocus(rotation) {
  const watchLabels = rotation.sectors
    .filter((s) => s.state === "watch")
    .map((s) => s.label)

  const orderedLeaders = LEADER_SECTOR_ORDER.filter((l) => watchLabels.includes(l))
  const extra = watchLabels.filter((l) => !orderedLeaders.includes(l))
  const leaders = [...orderedLeaders, ...extra].slice(0, 5)

  /** @type {string[]} */
  const caution = []
  for (const s of rotation.sectors) {
    if (s.state !== "caution" && s.state !== "alert") continue
    if (s.id === "ai" || s.id === "semi" || s.id === "battery") {
      if (!caution.includes("고베타 성장")) caution.push("고베타 성장")
      if (!caution.includes("금리 민감 성장")) caution.push("금리 민감 성장")
    } else if (s.reasons[0]) {
      const r = compactPhrase(s.reasons[0])
      if (r !== "—" && !caution.includes(r)) caution.push(r)
    }
  }
  if (!caution.length) caution.push("특이 없음")

  return { leaders, caution: caution.slice(0, 3) }
}

/**
 * @param {{
 *   zoneLabel: string
 *   leaders: string[]
 *   bondLine: string
 *   actionToday: DailyActionToday
 * }} ctx
 */
function buildOneLiner({ zoneLabel, leaders, bondLine, actionToday }) {
  const lines = uniquePhrases(
    [
      `${zoneLabel} 구간.`,
      leaders.length ? `${leaders.slice(0, 2).join("·")} 리더 유지.` : null,
      bondLine && bondLine !== "—" ? `${bondLine.replace(/ · /g, " ")} 참고.` : null,
      actionToday.today.includes("추격")
        ? "추격보다 눌림 우선."
        : `${actionToday.ai} 우선.`,
    ],
    4,
  )
  return lines.length ? lines : ["데이터 입력 후 브리핑 생성."]
}

/**
 * @param {{
 *   panicData?: object | null
 *   cycleScore?: number | null
 *   snapshot?: import("../macro-risk/engine.js").MacroRiskSnapshot | null
 * }} input
 * @returns {DailyMarketReport}
 */
export function buildDailyMarketReport({ panicData = null, cycleScore = null, snapshot = null }) {
  const zone = resolveCycleZone(cycleScore)
  const action = computeMarketAction(panicData)
  const timing = computeMarketTiming(panicData)
  const rotation = buildSectorRotation({ panicData, cycleScore })
  const bondRef = buildBondReferenceDisplay(snapshot)

  const hasCycle = Number.isFinite(Number(cycleScore))
  const hasPanic = Boolean(action && timing)
  const ready = hasCycle || hasPanic

  const bondLine =
    bondRef.statusLabels.length > 0
      ? bondRef.statusLabels.join(" · ")
      : bondRef.hintLines[0] ?? "—"

  const leaders = buildSectorFocus(rotation).leaders
  const actionToday = buildActionToday(zone.zone, action?.regime ?? "neutral", Number(cycleScore))
  const strategy = buildStrategy(timing)

  if (bondRef.statusLabels.includes("금리 재평가") || bondRef.statusLabels.includes("장기채 경고")) {
    actionToday.risk = "금리 우선 감시"
  } else if (bondRef.statusLabels.includes("유동성 주의")) {
    actionToday.risk = "유동성·외인 감시"
  }

  const sectors = buildSectorFocus(rotation)

  const marketToday = {
    market: zone.zoneLabel,
    bond: bondLine,
    leaders: leaders.length ? `${leaders.join(" · ")} 유지` : "—",
  }

  const oneLiner = buildOneLiner({
    zoneLabel: zone.zoneLabel,
    leaders,
    bondLine,
    actionToday,
  })

  return {
    ready,
    marketToday,
    actionToday,
    strategy,
    sectors,
    oneLiner,
  }
}
