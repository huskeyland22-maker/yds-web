/**
 * 8대 패닉지표 → 단기 / 중기 / 장기 타점 (0~100 점수 + 행동)
 */
import { pickMetricValue } from "./panicMarketActionEngine.js"
import {
  compositeRatesInterestScore,
  dxyInterestScore,
  liquidityInterestScore,
  pickDxyValue,
  pickUs10yValue,
  us10yInterestScore,
} from "./macroTimingAuxScores.js"
import { buildTacticalTimingScoreDebug } from "./panicTacticalTimingEngine.js"

/** @typedef {"short" | "mid" | "long"} TimingHorizon */

/**
 * @typedef {{
 *   horizon: TimingHorizon
 *   label: string
 *   score: number
 *   status: string
 *   interpretation: string
 *   action: string
 *   actionShort: string
 *   marketState: string
 *   marketContext: string | null
 *   risk: string
 *   sectors: string[]
 *   allocations: AllocationWeight[]
 *   metricsUsed: string[]
 * }} TimingSignal
 */

/** @typedef {{ label: string; pct: number }} AllocationWeight */

/**
 * @typedef {{
 *   short: TimingSignal
 *   mid: TimingSignal
 *   long: TimingSignal
 * }} MarketTimingGuide
 */

function clamp(n, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n))
}

function avg(nums) {
  const v = nums.filter(Number.isFinite)
  if (!v.length) return null
  return v.reduce((a, b) => a + b, 0) / v.length
}

/** @param {{ label: string; w: number }[]} items @returns {AllocationWeight[]} */
function normalizeAlloc(items) {
  const sum = items.reduce((a, b) => a + b.w, 0)
  if (!sum) return []
  const rows = items.map((i) => ({
    label: i.label,
    pct: Math.round((i.w / sum) * 100),
  }))
  const diff = 100 - rows.reduce((a, b) => a + b.pct, 0)
  if (diff !== 0 && rows.length) rows[0].pct = Math.max(0, rows[0].pct + diff)
  return rows.filter((r) => r.pct > 0).sort((a, b) => b.pct - a.pct)
}

/** @param {number} score — 0~100 타점 점수 */
function scoreTilt(score) {
  return clamp((score - 50) / 50, -1, 1)
}

/**
 * @param {{ label: string; w: number }[]} base
 * @param {number} score
 * @param {{ cash?: number; growth?: number }} [bias]
 */
function tiltAlloc(base, score, bias = {}) {
  const t = scoreTilt(score)
  const cashShift = (bias.cash ?? 12) * -t
  const growthShift = (bias.growth ?? 10) * t
  const mapped = base.map((row) => {
    let w = row.w
    if (row.label === "현금" || row.label === "채권" || row.label === "방어") w += cashShift
    if (
      row.label === "성장" ||
      row.label === "공격" ||
      row.label === "AI" ||
      row.label === "반도체" ||
      row.label === "성장주" ||
      row.label === "사이클"
    ) {
      w += growthShift
    }
    return { label: row.label, w: Math.max(4, w) }
  })
  return normalizeAlloc(mapped)
}

/** @param {string} label */
export function allocationBarClass(label) {
  switch (label) {
    case "현금":
      return "bg-emerald-500/85"
    case "ETF":
      return "bg-blue-500/80"
    case "AI":
      return "bg-violet-500/85"
    case "반도체":
      return "bg-cyan-500/85"
    case "대형주":
      return "bg-slate-400/85"
    case "성장":
    case "성장주":
      return "bg-sky-500/85"
    case "공격":
      return "bg-orange-500/85"
    case "사이클":
      return "bg-amber-500/85"
    case "방어":
      return "bg-rose-500/75"
    case "채권":
      return "bg-teal-500/80"
    case "배당":
      return "bg-indigo-500/80"
    case "필수소비":
      return "bg-lime-500/75"
    case "핵심섹터":
      return "bg-slate-500/80"
    default:
      return "bg-slate-500/70"
  }
}

/** @param {number} score @param {string} action @param {string[]} sectors */
function buildShortAllocations(score, action, sectors) {
  if (/익절/.test(action)) {
    return tiltAlloc(
      [
        { label: "현금", w: 40 },
        { label: "ETF", w: 30 },
        { label: "성장", w: 20 },
        { label: "공격", w: 10 },
      ],
      score,
      { cash: 14, growth: 12 },
    )
  }
  if (/공포/.test(action)) {
    return tiltAlloc(
      [
        { label: "현금", w: 32 },
        { label: "방어", w: 28 },
        { label: "대형주", w: 22 },
        { label: "공격", w: 18 },
      ],
      score,
    )
  }
  if (score >= 68) {
    const s = sectors.filter((x) => !["현금", "ETF"].includes(x))
    if (s.length >= 2) {
      return tiltAlloc(
        [
          { label: "현금", w: 18 },
          { label: "ETF", w: 22 },
          { label: s[0], w: 30 },
          { label: s[1], w: 30 },
        ],
        score,
      )
    }
    return tiltAlloc(
      [
        { label: "성장", w: 30 },
        { label: "공격", w: 26 },
        { label: "ETF", w: 26 },
        { label: "현금", w: 18 },
      ],
      score,
    )
  }
  if (score >= 50) {
    return tiltAlloc(
      [
        { label: "ETF", w: 30 },
        { label: "대형주", w: 26 },
        { label: "성장", w: 24 },
        { label: "현금", w: 20 },
      ],
      score,
    )
  }
  return tiltAlloc(
    [
      { label: "현금", w: 38 },
      { label: "ETF", w: 32 },
      { label: "대형주", w: 20 },
      { label: "성장", w: 10 },
    ],
    score,
  )
}

/** @param {number} score @param {string} action @param {string[]} sectors */
function buildMidAllocations(score, action, sectors) {
  if (/축소/.test(action) || score < 38) {
    return tiltAlloc(
      [
        { label: "현금", w: 45 },
        { label: "채권", w: 25 },
        { label: "방어", w: 18 },
        { label: "ETF", w: 12 },
      ],
      score,
    )
  }
  if (score >= 68 || /확대/.test(action)) {
    const s = sectors.filter((x) => !["현금", "ETF", "채권"].includes(x))
    const growthA = s[0] ?? "AI"
    const growthB = s[1] ?? "반도체"
    return tiltAlloc(
      [
        { label: "ETF", w: 35 },
        { label: growthA, w: 25 },
        { label: growthB, w: 20 },
        { label: "현금", w: 20 },
      ],
      score,
    )
  }
  return tiltAlloc(
    [
      { label: "ETF", w: 38 },
      { label: "대형주", w: 28 },
      { label: "현금", w: 22 },
      { label: "성장", w: 12 },
    ],
    score,
  )
}

/** @param {number} score @param {string} action @param {string[]} sectors */
function buildLongAllocations(score, action, sectors) {
  if (/과열/.test(action) || score < 20) {
    return tiltAlloc(
      [
        { label: "현금", w: 45 },
        { label: "ETF", w: 28 },
        { label: "대형주", w: 18 },
        { label: "방어", w: 9 },
      ],
      score,
    )
  }
  if (/방어/.test(action) || score < 40) {
    return tiltAlloc(
      [
        { label: "현금", w: 40 },
        { label: "채권", w: 30 },
        { label: "대형주", w: 20 },
        { label: "ETF", w: 10 },
      ],
      score,
    )
  }
  if (/분할/.test(action) || score >= 80) {
    return tiltAlloc(
      [
        { label: "배당", w: 30 },
        { label: "대형주", w: 30 },
        { label: "ETF", w: 25 },
        { label: "현금", w: 15 },
      ],
      score,
    )
  }
  if (score >= 60 || /적립/.test(action)) {
    const growth = sectors.find((s) => ["AI", "반도체", "성장", "성장주"].includes(s)) ?? "AI"
    return tiltAlloc(
      [
        { label: "ETF", w: 40 },
        { label: "대형주", w: 30 },
        { label: growth, w: 20 },
        { label: "현금", w: 10 },
      ],
      score,
    )
  }
  return tiltAlloc(
    [
      { label: "ETF", w: 35 },
      { label: "대형주", w: 30 },
      { label: "핵심섹터", w: 20 },
      { label: "현금", w: 15 },
    ],
    score,
  )
}

/** @param {string} action */
function compactAction(action) {
  return String(action)
    .replace("눌림 매수 가능", "눌림 매수")
    .replace("공포 분할매수", "분할매수")
    .trim()
}

/** @param {object} data @returns {"low" | "moderate" | "elevated" | "high"} */
function systemRiskLevel(data) {
  let stress = 0
  const hy = pickMetricValue(data, "highYield")
  const vix = pickMetricValue(data, "vix")
  const move = pickMetricValue(data, "move")

  if (hy != null) {
    if (hy >= 6.5) stress += 3
    else if (hy >= 4.8) stress += 2
    else if (hy >= 3.8) stress += 1
  }
  if (vix != null) {
    if (vix >= 30) stress += 3
    else if (vix >= 24) stress += 2
    else if (vix >= 20) stress += 1
  }
  if (move != null) {
    if (move >= 125) stress += 2
    else if (move >= 112) stress += 1
  }
  if (stress >= 5) return "high"
  if (stress >= 3) return "elevated"
  if (stress >= 1) return "moderate"
  return "low"
}

/** @param {"low" | "moderate" | "elevated" | "high"} level */
function systemRiskLabel(level) {
  switch (level) {
    case "low":
      return "시스템 리스크 낮음"
    case "moderate":
      return "시스템 리스크 보통"
    case "elevated":
      return "시스템 리스크 상승"
    case "high":
      return "시스템 리스크 확대"
    default:
      return "시스템 리스크 —"
  }
}

/** @param {"low" | "moderate" | "elevated" | "high"} level */
function longRiskLabel(level, score) {
  if (score >= 70 && level === "low") return "리스크 낮음"
  if (score >= 55 && level !== "high") return "리스크 제한적"
  if (level === "high") return "구조 리스크 확대"
  if (level === "elevated") return "리스크 상승"
  if (score < 40) return "리스크 경계"
  return "리스크 보통"
}

/** @param {number} score */
export function timingScoreTextClass(score) {
  if (score >= 80) return "text-emerald-400"
  if (score >= 60) return "text-cyan-300"
  if (score >= 30) return "text-orange-300"
  return "text-rose-400"
}

/** @param {number} score */
export function timingScoreBarClass(score) {
  if (score >= 80) return "bg-emerald-500"
  if (score >= 60) return "bg-cyan-500"
  if (score >= 30) return "bg-orange-500"
  return "bg-rose-500"
}

/** @param {number} score */
export function timingScoreBorderClass(score) {
  if (score >= 80) return "border-emerald-500/30"
  if (score >= 60) return "border-cyan-500/25"
  if (score >= 30) return "border-orange-500/25"
  return "border-rose-500/25"
}

/** ——— 단기: VIX, P/C, F&G, MOVE ——— */

/** @param {number} v */
function shortVixScore(v) {
  if (v <= 14) return 72
  if (v <= 18) return 88
  if (v <= 22) return 74
  if (v <= 26) return 52
  if (v <= 32) return 34
  return 18
}

/** @param {number} v */
function shortPutCallScore(v) {
  if (v <= 0.52) return 28
  if (v <= 0.65) return 48
  if (v <= 0.82) return 78
  if (v <= 0.95) return 58
  return 42
}

/** @param {number} v */
function shortFearGreedScore(v) {
  if (v <= 22) return 38
  if (v <= 35) return 52
  if (v <= 48) return 72
  if (v <= 62) return 82
  if (v <= 72) return 68
  if (v <= 82) return 42
  return 22
}

/** @param {number} v */
function shortMoveScore(v) {
  if (v < 88) return 85
  if (v < 102) return 78
  if (v < 115) return 62
  if (v < 128) return 44
  return 26
}

/** @param {object} data */
function shortClues(data) {
  const parts = []
  const vix = pickMetricValue(data, "vix")
  const pc = pickMetricValue(data, "putCall")
  const fg = pickMetricValue(data, "fearGreed")
  const move = pickMetricValue(data, "move")

  if (vix != null) {
    if (vix <= 18) parts.push("VIX 안정")
    else if (vix >= 26) parts.push("VIX 확대")
    else parts.push(`VIX ${vix.toFixed(1)}`)
  }
  if (fg != null) {
    if (fg >= 72) parts.push("탐욕 과열")
    else if (fg <= 28) parts.push("극단 공포")
    else if (fg >= 55) parts.push("탐욕 완화")
    else parts.push("공포 완화")
  }
  if (parts.length < 2 && pc != null) {
    if (pc >= 0.88) parts.push("풋콜 헤지 쏠림")
    else if (pc <= 0.58) parts.push("콜 과열")
    else parts.push(`P/C ${pc.toFixed(2)}`)
  }
  if (parts.length < 2 && move != null) {
    if (move >= 118) parts.push("채권 변동성 부담")
    else if (move < 100) parts.push("채권 변동성 안정")
  }
  return parts.slice(0, 2).join(" + ") || "단기 지표 혼재"
}

/** @param {object} data @param {number} score */
function resolveShortAction(data, score) {
  const vix = pickMetricValue(data, "vix")
  const pc = pickMetricValue(data, "putCall")
  const fg = pickMetricValue(data, "fearGreed")

  const fearExtreme =
    (fg != null && fg <= 25) || (vix != null && vix >= 28) || (pc != null && pc >= 0.92)
  const heatExtreme =
    (fg != null && fg >= 78) || (pc != null && pc <= 0.54) || (vix != null && vix <= 13)

  if (fearExtreme && score < 55) {
    return {
      action: "공포 매수",
      status: "공포 구간",
      sectors: ["방어", "배당", "대형주"],
    }
  }
  if (heatExtreme) {
    return {
      action: "익절 관리",
      status: "과열 경계",
      sectors: ["대형주", "현금", "ETF"],
    }
  }
  if (score >= 68) {
    return {
      action: "눌림 매수 가능",
      status: "단기 기회",
      sectors: ["AI", "반도체", "성장"],
    }
  }
  if (score >= 52) {
    return {
      action: "눌림 매수 가능",
      status: "선별 매수",
      sectors: ["대형주", "성장", "ETF"],
    }
  }
  return {
    action: "관망",
    status: "중립 관망",
    sectors: ["ETF", "대형주"],
  }
}

/** @param {object} data @param {number} score @param {{ action: string; status: string }} resolved */
function buildShortMeta(data, score, resolved) {
  const vix = pickMetricValue(data, "vix")
  const pc = pickMetricValue(data, "putCall")
  const fg = pickMetricValue(data, "fearGreed")
  const move = pickMetricValue(data, "move")

  let marketState = resolved.status
  if (fg != null && fg >= 78) marketState = "과열 조정"
  else if (fg != null && fg >= 65) marketState = "탐욕 구간"
  else if (fg != null && fg <= 25) marketState = "극단 공포"
  else if (vix != null && vix <= 18 && (fg == null || fg >= 40)) marketState = "변동성 안정"
  else if (vix != null && vix >= 26) marketState = "변동성 확대"
  else if (pc != null && pc >= 0.88) marketState = "헤지 쏠림"
  else if (pc != null && pc <= 0.55) marketState = "콜 과열"

  let risk = "이벤트 변동 주의"
  if (fg != null && fg >= 68) risk = "탐욕 유지"
  else if (fg != null && fg <= 28) risk = "공포 지속"
  else if (vix != null && vix >= 26) risk = "변동성 부담"
  else if (pc != null && pc >= 0.9) risk = "풋콜 과열"
  else if (move != null && move >= 118) risk = "금리 변동성"
  else if (score >= 65) risk = "리스크 제한적"
  else if (score < 45) risk = "단기 노이즈"

  return {
    marketState,
    marketContext: null,
    risk,
    actionShort: compactAction(resolved.action),
  }
}

/** @param {object} data */
function computeShortTiming(data) {
  const scores = []
  const used = []
  const vix = pickMetricValue(data, "vix")
  const pc = pickMetricValue(data, "putCall")
  const fg = pickMetricValue(data, "fearGreed")
  const move = pickMetricValue(data, "move")

  if (vix != null) {
    scores.push(shortVixScore(vix))
    used.push("VIX")
  }
  if (pc != null) {
    scores.push(shortPutCallScore(pc))
    used.push("P/C")
  }
  if (fg != null) {
    scores.push(shortFearGreedScore(fg))
    used.push("F&G")
  }
  if (move != null) {
    scores.push(shortMoveScore(move))
    used.push("MOVE")
  }
  if (scores.length < 2) return null

  const score = Math.round(avg(scores))
  const resolved = resolveShortAction(data, score)
  const meta = buildShortMeta(data, score, resolved)

  return {
    horizon: "short",
    label: "단기",
    score,
    status: resolved.status,
    interpretation: shortClues(data),
    action: resolved.action,
    actionShort: meta.actionShort,
    marketState: meta.marketState,
    marketContext: meta.marketContext,
    risk: meta.risk,
    sectors: resolved.sectors,
    allocations: buildShortAllocations(score, resolved.action, resolved.sectors),
    metricsUsed: used,
  }
}

/** ——— 중기: HY OAS, BofA, MOVE ——— */

/** @param {number} v */
function midHyScore(v) {
  if (v < 3) return 82
  if (v < 4.2) return 72
  if (v < 5.5) return 55
  if (v < 7) return 35
  return 18
}

/** @param {number} v */
function midBofaScore(v) {
  if (v <= 2.5) return 28
  if (v <= 4) return 48
  if (v <= 6) return 72
  if (v < 8) return 58
  return 38
}

/** @param {number} v */
function midMoveScore(v) {
  if (v < 95) return 80
  if (v < 112) return 65
  if (v < 122) return 48
  return 30
}

/** @param {object} data */
function midClues(data) {
  const parts = []
  const hy = pickMetricValue(data, "highYield")
  const bofa = pickMetricValue(data, "bofa")
  const move = pickMetricValue(data, "move")

  if (hy != null) {
    if (hy < 3.5) parts.push("신용 안정")
    else if (hy >= 6) parts.push("신용 스트레스")
    else parts.push(`OAS ${hy.toFixed(2)}%`)
  }
  if (bofa != null) {
    if (bofa >= 7) parts.push("BofA 탐욕")
    else if (bofa <= 3) parts.push("BofA 위축")
    else parts.push("심리 중립")
  }
  if (parts.length < 2 && move != null) {
    if (move >= 118) parts.push("금리 변동성 부담")
    else parts.push("금리 변동성 양호")
  }
  return parts.slice(0, 2).join(" + ") || "중기 지표 혼재"
}

/** @param {number} score */
function resolveMidAction(score) {
  if (score >= 68) {
    return {
      action: "비중 확대",
      status: "중기 우호",
      sectors: ["성장", "사이클", "반도체"],
    }
  }
  if (score >= 38) {
    return {
      action: "중립",
      status: "중기 중립",
      sectors: ["ETF", "대형주"],
    }
  }
  return {
    action: "비중 축소",
    status: "중기 방어",
    sectors: ["현금", "채권", "방어"],
  }
}

/** @param {object} data @param {number} score @param {{ action: string; status: string }} resolved */
function buildMidMeta(data, score, resolved) {
  const hy = pickMetricValue(data, "highYield")
  const bofa = pickMetricValue(data, "bofa")
  const level = systemRiskLevel(data)

  let marketState = midClues(data).split(" + ")[0] || resolved.status
  if (hy != null && hy < 3.2) marketState = "신용 안정"
  else if (hy != null && hy >= 6) marketState = "신용 스트레스"
  else if (bofa != null && bofa >= 7.5) marketState = "심리 과열"

  let risk = "변동성 제한적"
  if (score < 40 || level === "high") risk = "신용·금리 부담"
  else if (score >= 68 && level === "low") risk = "리스크 제한적"
  else if (level === "elevated") risk = "구조 리스크 주의"

  return {
    marketState,
    marketContext: systemRiskLabel(level),
    risk,
    actionShort: compactAction(resolved.action),
  }
}

/**
 * @param {object} data
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null | undefined} snapshot
 */
function computeMidTiming(data, snapshot) {
  const scores = []
  const used = []
  const hy = pickMetricValue(data, "highYield")
  const dxy = pickDxyValue(data)
  const move = pickMetricValue(data, "move")
  const y10 = pickUs10yValue(data, snapshot)
  const liq = liquidityInterestScore(snapshot)

  if (hy != null) {
    scores.push(midHyScore(hy))
    used.push("HY OAS")
  }
  if (dxy != null) {
    scores.push(dxyInterestScore(dxy))
    used.push("DXY")
  }
  if (move != null) {
    scores.push(midMoveScore(move))
    used.push("MOVE")
  }
  if (y10 != null) {
    scores.push(us10yInterestScore(y10))
    used.push("10Y")
  }
  if (liq != null) {
    scores.push(liq)
    used.push("유동성")
  }
  if (scores.length < 2) return null

  const score = Math.round(avg(scores))
  const resolved = resolveMidAction(score)
  const meta = buildMidMeta(data, score, resolved)

  return {
    horizon: "mid",
    label: "중기",
    score,
    status: resolved.status,
    interpretation: midClues(data),
    action: resolved.action,
    actionShort: meta.actionShort,
    marketState: meta.marketState,
    marketContext: meta.marketContext,
    risk: meta.risk,
    sectors: resolved.sectors,
    allocations: buildMidAllocations(score, resolved.action, resolved.sectors),
    metricsUsed: used,
  }
}

/** ——— 장기: 구조 지표 가중 (HY·BofA·VIX·MOVE) ——— */

/** @type {{ key: string; label: string; weight: number; score: (v: number) => number }[]} */
const LONG_CORE_WEIGHTS = [
  { key: "highYield", label: "HY OAS", weight: 0.375, score: longHyScore },
  { key: "bofa", label: "BofA", weight: 0.3125, score: longBofaScore },
  { key: "vix", label: "VIX", weight: 0.1875, score: longVixScore },
  { key: "move", label: "MOVE", weight: 0.125, score: longMoveScore },
]

/** F&G·P/C — 장기 영향 최소 (코어 5개 모두 있을 때만 합산 5%) */
const LONG_TAIL_WEIGHTS = [
  { key: "fearGreed", label: "F&G", weight: 0.03, score: longFearGreedTailScore },
  { key: "putCall", label: "P/C", weight: 0.02, score: longPutCallTailScore },
]

/** @param {number} v — 낮을수록 신용 안정 → 장기 우호 */
function longHyScore(v) {
  if (v < 2.5) return 90
  if (v < 3.2) return 86
  if (v < 4) return 76
  if (v < 5.2) return 62
  if (v < 6.5) return 45
  if (v < 8) return 30
  return 18
}

/** @param {number} v */
function longBofaScore(v) {
  if (v <= 2.5) return 38
  if (v <= 4) return 52
  if (v <= 6.5) return 66
  if (v <= 7.5) return 62
  if (v < 8.5) return 52
  return 32
}

/** @param {number} v — 적정 변동성 구간 우호 */
function longVixScore(v) {
  if (v <= 13) return 68
  if (v <= 18) return 76
  if (v <= 22) return 72
  if (v <= 26) return 58
  if (v <= 32) return 42
  return 26
}

/** @param {number} v */
function longMoveScore(v) {
  if (v < 78) return 82
  if (v < 95) return 76
  if (v < 112) return 64
  if (v < 125) return 48
  return 28
}

/** @param {number} v */
function longFearGreedTailScore(v) {
  if (v <= 22) return 88
  if (v <= 35) return 72
  if (v >= 78) return 28
  if (v >= 68) return 42
  return 58
}

/** @param {number} v */
function longPutCallTailScore(v) {
  if (v >= 0.92) return 82
  if (v >= 0.82) return 68
  if (v <= 0.52) return 32
  if (v <= 0.62) return 48
  return 58
}

/** @param {object} data */
function longClues(data) {
  const parts = []
  const hy = pickMetricValue(data, "highYield")
  const bofa = pickMetricValue(data, "bofa")
  const vix = pickMetricValue(data, "vix")
  const move = pickMetricValue(data, "move")

  if (hy != null) {
    if (hy < 3.2) parts.push("신용 안정")
    else if (hy >= 6) parts.push("신용 스트레스")
    else parts.push(`OAS ${hy.toFixed(2)}%`)
  }
  if (vix != null) {
    if (vix <= 20) parts.push("VIX 안정")
    else if (vix >= 26) parts.push("VIX 부담")
    else parts.push(`VIX ${vix.toFixed(1)}`)
  }
  if (parts.length < 2 && move != null) {
    if (move < 95) parts.push("금리 변동성 양호")
    else parts.push("금리 변동성 부담")
  }
  if (parts.length < 2 && bofa != null) {
    if (bofa >= 7.5) parts.push("BofA 과열")
    else if (bofa <= 3) parts.push("BofA 위축")
    else parts.push("심리 균형")
  }
  return parts.slice(0, 2).join(" + ") || "구조 지표 혼재"
}

/** @param {number} score */
function resolveLongAction(score) {
  if (score >= 80) {
    return {
      action: "공포 분할매수",
      status: "장기 공포 기회",
      sectors: ["배당", "대형주", "필수소비"],
    }
  }
  if (score >= 60) {
    return {
      action: "장기 적립",
      status: "장기 적립",
      sectors: ["AI", "반도체", "성장"],
    }
  }
  if (score >= 40) {
    return {
      action: "중립",
      status: "장기 중립",
      sectors: ["ETF", "대형주", "핵심섹터"],
    }
  }
  if (score >= 20) {
    return {
      action: "방어",
      status: "장기 방어",
      sectors: ["방어", "채권", "현금"],
    }
  }
  return {
    action: "과열",
    status: "장기 과열",
    sectors: ["현금", "대형주", "ETF"],
  }
}

/** @param {object} data @param {number} score @param {{ action: string; status: string; sectors: string[] }} resolved */
function buildLongMeta(data, score, resolved) {
  const hy = pickMetricValue(data, "highYield")
  const vix = pickMetricValue(data, "vix")
  const level = systemRiskLevel(data)

  let marketState = longClues(data).split(" + ")[0] || resolved.status
  if (hy != null && hy < 3.2) marketState = "신용 안정"
  else if (vix != null && vix <= 20) marketState = "변동성 안정"

  const marketContext =
    level === "low" ? systemRiskLabel(level) : longClues(data).split(" + ")[1] ?? systemRiskLabel(level)

  let risk = longRiskLabel(level, score)

  let sectors = resolved.sectors
  if (score >= 40 && score < 60) {
    sectors = ["ETF", "대형주", "핵심섹터"]
  }

  return {
    marketState,
    marketContext: marketContext !== marketState ? marketContext : null,
    risk,
    actionShort: compactAction(resolved.action),
    sectors,
  }
}

/**
 * @param {object} data
 * @param {{ key: string; label: string; weight: number; score: (v: number) => number }[]} defs
 */
function weightedLongScore(data, defs) {
  let sum = 0
  let wSum = 0
  const used = []
  for (const { key, label, weight, score: scoreFn } of defs) {
    const v = pickMetricValue(data, key)
    if (v == null) continue
    sum += scoreFn(v) * weight
    wSum += weight
    used.push(label)
  }
  if (wSum <= 0) return { score: null, used }
  return { score: Math.round(sum / wSum), used }
}

/**
 * @param {object} data
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null | undefined} snapshot
 */
function computeLongTiming(data, snapshot) {
  const scores = []
  const used = []
  const bofa = pickMetricValue(data, "bofa")
  const hy = pickMetricValue(data, "highYield")
  const dxy = pickDxyValue(data)
  const liq = liquidityInterestScore(snapshot)
  const rates = compositeRatesInterestScore(data, snapshot)

  if (bofa != null) {
    scores.push(longBofaScore(bofa))
    used.push("BofA")
  }
  if (hy != null) {
    scores.push(longHyScore(hy))
    used.push("HY OAS")
  }
  if (dxy != null) {
    scores.push(dxyInterestScore(dxy))
    used.push("DXY")
  }
  if (liq != null) {
    scores.push(liq)
    used.push("유동성")
  }
  if (rates != null) {
    scores.push(rates)
    used.push("금리")
  }
  if (scores.length < 3) return null

  const score = Math.round(avg(scores))
  const resolved = resolveLongAction(score)
  const meta = buildLongMeta(data, score, resolved)

  return {
    horizon: "long",
    label: "장기",
    score,
    status: resolved.status,
    interpretation: longClues(data),
    action: resolved.action,
    actionShort: meta.actionShort,
    marketState: meta.marketState,
    marketContext: meta.marketContext,
    risk: meta.risk,
    sectors: meta.sectors,
    allocations: buildLongAllocations(score, resolved.action, meta.sectors),
    metricsUsed: used,
  }
}

/**
 * @param {object} data
 * @param {{ key: string; label: string; scoreFn: (v: number) => number; scoreFnName: string }[]} defs
 * @param {number} minComponents
 */
function buildAvgHorizonScoreDebug(data, defs, minComponents) {
  /** @type {{ key: string; label: string; rawValue: number; componentScore: number; scoreFnName: string }[]} */
  const components = []
  for (const { key, label, scoreFn, scoreFnName } of defs) {
    const rawValue = pickMetricValue(data, key)
    if (rawValue == null) continue
    components.push({
      key,
      label,
      rawValue,
      componentScore: scoreFn(rawValue),
      scoreFnName,
    })
  }
  const componentScores = components.map((c) => c.componentScore)
  const rawAvg = avg(componentScores)
  const rawRounded = rawAvg != null ? Math.round(rawAvg) : null

  return {
    metricsUsed: components.map((c) => c.label),
    components,
    componentScores,
    rawAvg,
    rawRounded,
    minComponentsRequired: minComponents,
    hasEnoughMetrics: componentScores.length >= minComponents,
    normalization: "Math.round(avg(componentScores))",
    clamp: {
      horizonFinalScore: {
        applied: false,
        formula: "none (not passed through clamp(0,100))",
      },
      componentScores: {
        applied: true,
        formula: "piecewise lookup tables return hard-coded 0–100 tiers per metric",
      },
      allocationTiltOnly: {
        applied: true,
        formula: "clamp((score - 50) / 50, -1, 1) in scoreTilt() — affects allocation bars only, not HUD card score",
      },
    },
  }
}

/** @param {object} data */
function buildLongHorizonScoreDebug(data) {
  /** @type {{ label: string; rawValue: number; weight: number; componentScore: number; weighted: number; scoreFnName: string }[]} */
  const coreComponents = []
  let sum = 0
  let wSum = 0
  for (const { key, label, weight, score } of LONG_CORE_WEIGHTS) {
    const rawValue = pickMetricValue(data, key)
    if (rawValue == null) continue
    const componentScore = score(rawValue)
    const weighted = componentScore * weight
    sum += weighted
    wSum += weight
    coreComponents.push({
      label,
      key,
      rawValue,
      weight,
      componentScore,
      weighted,
      scoreFnName: `long${label.replace(/\s/g, "")}Score`,
    })
  }

  const coreAvg = wSum > 0 ? sum / wSum : null
  const coreRounded = coreAvg != null ? Math.round(coreAvg) : null

  /** @type {{ label: string; rawValue: number; weight: number; componentScore: number; weighted: number }[]} */
  const tailComponents = []
  let tailSum = 0
  let tailWSum = 0
  for (const { key, label, weight, score } of LONG_TAIL_WEIGHTS) {
    const rawValue = pickMetricValue(data, key)
    if (rawValue == null) continue
    const componentScore = score(rawValue)
    tailSum += componentScore * weight
    tailWSum += weight
    tailComponents.push({ label, rawValue, weight, componentScore, weighted: componentScore * weight })
  }
  const tailAvg = tailWSum > 0 ? tailSum / tailWSum : null
  const tailRounded = tailAvg != null ? Math.round(tailAvg) : null

  const hasFullCore = coreComponents.length >= 4
  let rawRounded = coreRounded
  let blendNote = null
  if (hasFullCore && tailRounded != null) {
    rawRounded = Math.round(coreRounded * 0.95 + tailRounded * 0.05)
    blendNote = `Math.round(coreRounded(${coreRounded}) * 0.95 + tailRounded(${tailRounded}) * 0.05) = ${rawRounded}`
  }

  return {
    metricsUsed: [
      ...coreComponents.map((c) => c.label),
      ...tailComponents.map((c) => `${c.label}*`),
    ],
    coreComponents,
    tailComponents,
    coreAvg,
    coreRounded,
    tailAvg,
    tailRounded,
    rawRounded,
    hasFullCore,
    minComponentsRequired: 3,
    hasEnoughMetrics: coreComponents.length >= 3,
    normalization: hasFullCore && tailRounded != null
      ? blendNote ?? "weighted core + 5% tail blend, Math.round"
      : "Math.round(weightedAvg(coreComponents, LONG_CORE_WEIGHTS))",
    clamp: {
      horizonFinalScore: { applied: false, formula: "none" },
      componentScores: {
        applied: true,
        formula: "piecewise lookup tables (hard-coded 0–100 tiers)",
      },
      allocationTiltOnly: {
        applied: true,
        formula: "clamp((score - 50) / 50, -1, 1) in scoreTilt() — allocation only",
      },
    },
  }
}

/**
 * @param {object} data
 * @param {{
 *   key?: string
 *   label: string
 *   scoreFn: (v: number) => number
 *   scoreFnName: string
 *   getRaw?: (data: object, snapshot: import("../macro-risk/engine.js").MacroRiskSnapshot | null | undefined) => number | null
 * }[]} defs
 * @param {number} minComponents
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null | undefined} snapshot
 */
function buildAvgHorizonScoreDebugEx(data, defs, minComponents, snapshot = null) {
  /** @type {{ key: string; label: string; rawValue: number; componentScore: number; scoreFnName: string }[]} */
  const components = []
  for (const def of defs) {
    const rawValue = def.getRaw ? def.getRaw(data, snapshot) : pickMetricValue(data, def.key ?? "")
    if (rawValue == null) continue
    components.push({
      key: def.key ?? def.label,
      label: def.label,
      rawValue,
      componentScore: def.scoreFn(rawValue),
      scoreFnName: def.scoreFnName,
    })
  }
  const componentScores = components.map((c) => c.componentScore)
  const rawAvg = avg(componentScores)
  const rawRounded = rawAvg != null ? Math.round(rawAvg) : null

  return {
    metricsUsed: components.map((c) => c.label),
    components,
    componentScores,
    rawAvg,
    rawRounded,
    minComponentsRequired: minComponents,
    hasEnoughMetrics: componentScores.length >= minComponents,
    normalization: "Math.round(avg(componentScores))",
    clamp: {
      horizonFinalScore: { applied: false, formula: "none" },
      componentScores: {
        applied: true,
        formula: "piecewise lookup / macro aux → 0–100 tiers",
      },
      allocationTiltOnly: {
        applied: true,
        formula: "clamp((score - 50) / 50, -1, 1) in scoreTilt() — allocation only",
      },
    },
  }
}

/**
 * 전술 HUD — 단·중·장·실전 점수 디버그 (콘솔용)
 * @param {object | null | undefined} panicData
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null | undefined} [snapshot]
 */
export function buildTacticalHudTimingScoreDebug(panicData, snapshot = null) {
  if (!panicData || typeof panicData !== "object") {
    return {
      rawShortScore: null,
      rawMidScore: null,
      rawLongScore: null,
      rawWatchScore: null,
      rawTacticalScore: null,
      source: null,
      normalization: null,
      clamp: null,
    }
  }

  const shortDbg = buildAvgHorizonScoreDebug(
    panicData,
    [
      { key: "vix", label: "VIX", scoreFn: shortVixScore, scoreFnName: "shortVixScore" },
      { key: "putCall", label: "P/C", scoreFn: shortPutCallScore, scoreFnName: "shortPutCallScore" },
      { key: "fearGreed", label: "F&G", scoreFn: shortFearGreedScore, scoreFnName: "shortFearGreedScore" },
      { key: "move", label: "MOVE", scoreFn: shortMoveScore, scoreFnName: "shortMoveScore" },
    ],
    2,
  )

  const midDbg = buildAvgHorizonScoreDebugEx(
    panicData,
    [
      { key: "highYield", label: "HY OAS", scoreFn: midHyScore, scoreFnName: "midHyScore" },
      {
        key: "dxy",
        label: "DXY",
        scoreFn: dxyInterestScore,
        scoreFnName: "dxyInterestScore",
        getRaw: (d) => pickDxyValue(d),
      },
      { key: "move", label: "MOVE", scoreFn: midMoveScore, scoreFnName: "midMoveScore" },
      {
        key: "us10y",
        label: "10Y",
        scoreFn: us10yInterestScore,
        scoreFnName: "us10yInterestScore",
        getRaw: (d, s) => pickUs10yValue(d, s),
      },
      {
        label: "유동성",
        scoreFn: (v) => v,
        scoreFnName: "liquidityInterestScore",
        getRaw: (_d, s) => liquidityInterestScore(s),
      },
    ],
    2,
    snapshot,
  )

  const longDbg = buildAvgHorizonScoreDebugEx(
    panicData,
    [
      { key: "bofa", label: "BofA", scoreFn: longBofaScore, scoreFnName: "longBofaScore" },
      { key: "highYield", label: "HY OAS", scoreFn: longHyScore, scoreFnName: "longHyScore" },
      {
        key: "dxy",
        label: "DXY",
        scoreFn: dxyInterestScore,
        scoreFnName: "dxyInterestScore",
        getRaw: (d) => pickDxyValue(d),
      },
      {
        label: "유동성",
        scoreFn: (v) => v,
        scoreFnName: "liquidityInterestScore",
        getRaw: (_d, s) => liquidityInterestScore(s),
      },
      {
        label: "금리",
        scoreFn: (v) => v,
        scoreFnName: "compositeRatesInterestScore",
        getRaw: (d, s) => compositeRatesInterestScore(d, s),
      },
    ],
    3,
    snapshot,
  )

  const tacticalDbg = buildTacticalTimingScoreDebug(panicData)

  const rawShortScore = shortDbg.hasEnoughMetrics ? shortDbg.rawRounded : null
  const rawMidScore = midDbg.hasEnoughMetrics ? midDbg.rawRounded : null
  const rawLongScore = longDbg.hasEnoughMetrics ? longDbg.rawRounded : null
  const rawTacticalScore = tacticalDbg.rawTacticalScore
  const rawWatchScore = rawTacticalScore

  const scores = [rawShortScore, rawMidScore, rawLongScore, rawTacticalScore].filter(Number.isFinite)

  return {
    rawShortScore,
    rawMidScore,
    rawLongScore,
    rawWatchScore,
    rawTacticalScore,
    source: {
      short: {
        metrics: shortDbg.metricsUsed,
        components: shortDbg.components,
        componentScores: shortDbg.componentScores,
      },
      mid: {
        metrics: midDbg.metricsUsed,
        components: midDbg.components,
        componentScores: midDbg.componentScores,
      },
      long: {
        metrics: longDbg.metricsUsed,
        components: longDbg.components,
        componentScores: longDbg.componentScores,
      },
      tactical: tacticalDbg.source,
    },
    normalization: {
      short: shortDbg.normalization,
      mid: midDbg.normalization,
      long: longDbg.normalization,
      tactical: tacticalDbg.normalization,
    },
    clamp: {
      short: shortDbg.clamp,
      mid: midDbg.clamp,
      long: longDbg.clamp,
      tactical: tacticalDbg.clamp,
    },
    scoreSpread: scores.length >= 2 ? Math.max(...scores) - Math.min(...scores) : null,
    computeMarketTimingScores: (() => {
      const timing = computeMarketTiming(panicData, snapshot)
      if (!timing) return null
      return {
        short: timing.short?.score ?? null,
        mid: timing.mid?.score ?? null,
        long: timing.long?.score ?? null,
        shortIsPlaceholder: timing.short?.status === "데이터 부족",
        midIsPlaceholder: timing.mid?.status === "데이터 부족",
        longIsPlaceholder: timing.long?.status === "데이터 부족",
      }
    })(),
  }
}

/**
 * @param {object | null | undefined} panicData
 * @param {import("../macro-risk/engine.js").MacroRiskSnapshot | null | undefined} [snapshot]
 * @returns {MarketTimingGuide | null}
 */
export function computeMarketTiming(panicData, snapshot = null) {
  if (!panicData || typeof panicData !== "object") return null

  const short = computeShortTiming(panicData)
  const mid = computeMidTiming(panicData, snapshot)
  const long = computeLongTiming(panicData, snapshot)

  if (!short && !mid && !long) return null

  return {
    short: short ?? emptyPlaceholder("short", "단기"),
    mid: mid ?? emptyPlaceholder("mid", "중기"),
    long: long ?? emptyPlaceholder("long", "장기"),
  }
}

/** @param {TimingHorizon} horizon @param {string} label */
function emptyPlaceholder(horizon, label) {
  return {
    horizon,
    label,
    score: 0,
    status: "데이터 부족",
    interpretation: "지표 입력 필요",
    action: "—",
    actionShort: "—",
    marketState: "—",
    marketContext: null,
    risk: "—",
    sectors: [],
    allocations: [],
    metricsUsed: [],
  }
}
