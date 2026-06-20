/**
 * 종목 현재 위치 — 품질과 별개의 차트·이평·수급·모멘텀 상태
 * (이동평균 · 52주 상대위치 · 거래량 · RSI/돌파/눌림)
 */

/** @typedef {'earlyRise' | 'rising' | 'pullback' | 'sideways' | 'overheat' | 'downturn'} StockPositionId */

/**
 * @typedef {{
 *   id: StockPositionId
 *   label: string
 *   tone: string
 *   color: string
 *   interpretation: string
 * }} StockPositionView
 */

/**
 * @typedef {{
 *   close: number | null
 *   ma20: number | null
 *   ma60: number | null
 *   ma120: number | null
 *   rsi14: number | null
 *   drawdownPct: number | null
 *   position52w: number | null
 *   volRatio: number | null
 *   trendScore: number
 *   relativeStrength: number
 * }} PositionInputs
 */

export const STOCK_POSITION_VIEWS = {
  earlyRise: {
    id: "earlyRise",
    label: "상승초기",
    tone: "green",
    color: "#22c55e",
    interpretation: "진입 가능",
  },
  rising: {
    id: "rising",
    label: "상승진행",
    tone: "green-mid",
    color: "#4ade80",
    interpretation: "추세 유지 · 분할 보유",
  },
  pullback: {
    id: "pullback",
    label: "눌림목",
    tone: "blue",
    color: "#60a5fa",
    interpretation: "눌림 확인 · 분할 접근",
  },
  sideways: {
    id: "sideways",
    label: "횡보",
    tone: "gray",
    color: "#94a3b8",
    interpretation: "방향 확인 후 접근",
  },
  overheat: {
    id: "overheat",
    label: "과열",
    tone: "orange",
    color: "#f97316",
    interpretation: "추격 주의",
  },
  downturn: {
    id: "downturn",
    label: "하락전환",
    tone: "red",
    color: "#ef4444",
    interpretation: "관망",
  },
}

/** @param {unknown} v */
function toNum(v) {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** @param {import("./ydsStockPickModel.js").StockPickView} stock */
function readPositionInputs(stock) {
  const snap = stock.snapshot ?? {}
  const diag = stock.statusDiag?.inputs ?? {}
  const timingDebug = stock.timingScore?.debug ?? {}

  const close = toNum(snap.price ?? snap.close ?? diag.close)
  const ma20 = toNum(snap.ma20 ?? diag.ma20)
  const ma60 = toNum(snap.ma60 ?? diag.ma60)
  const ma120 = toNum(snap.ma120)
  const rsi14 = toNum(diag.rsi14)
  const drawdownPct = toNum(diag.drawdownPct)
  const position52w = toNum(diag.position52w)
  const volRatio = toNum(timingDebug.volRatio ?? diag.volumeRatio)

  const trendScore = Number(stock.scores?.trendScore) || 0

  let relativeStrength = 50
  if (position52w != null) relativeStrength = position52w * 0.55 + (trendScore / 40) * 100 * 0.45
  const rank = stock.pickMeta?.sectorRank?.rank
  if (rank != null && rank <= 5) relativeStrength += 8
  else if (rank != null && rank <= 12) relativeStrength += 4
  relativeStrength = Math.min(100, Math.max(0, Math.round(relativeStrength)))

  return {
    close,
    ma20,
    ma60,
    ma120,
    rsi14,
    drawdownPct,
    position52w,
    volRatio,
    trendScore,
    relativeStrength,
  }
}

/**
 * @param {PositionInputs} i
 * @returns {StockPositionId}
 */
export function derivePositionId(i) {
  const { close, ma20, ma60, rsi14, drawdownPct, position52w, volRatio, trendScore, relativeStrength } =
    i

  if (close == null || ma20 == null || ma60 == null) return "sideways"

  const bullAlign = close > ma20 && ma20 > ma60
  const above60 = close > ma60
  const below60 = close < ma60
  const below20 = close < ma20
  const ma20Near60 = ma20 >= ma60 * 0.97
  const flatMa = Math.abs(ma20 - ma60) / ma60 <= 0.025
  const flatPrice = Math.abs(close - ma20) / ma20 <= 0.025
  const dd = drawdownPct ?? 0
  const vol = volRatio ?? 0
  const pos = position52w ?? 50
  const rsi = rsi14 ?? 50

  const overheated =
    rsi > 70 ||
    (pos >= 97 && dd <= 3) ||
    (vol >= 1.4 && dd <= 2 && pos >= 90) ||
    (bullAlign && dd <= 1.5 && pos >= 95)

  if (overheated) return "overheat"

  const downturn =
    (below60 && ma20 < ma60) ||
    (below20 && ma20 < ma60) ||
    (below60 && dd > 15) ||
    (trendScore < 14 && below20) ||
    (relativeStrength < 38 && below60)

  if (downturn) return "downturn"

  const pullback =
    above60 &&
    ((dd >= 5 && dd <= 15) ||
      (close > ma60 && close < ma20) ||
      (dd >= 4 && !bullAlign && ma20Near60))

  if (pullback) return "pullback"

  if (bullAlign && dd < 5 && relativeStrength >= 55 && trendScore >= 28) {
    return "rising"
  }

  const earlyRise =
    (close > ma20 && ma20Near60 && !bullAlign) ||
    (above60 && !bullAlign && relativeStrength >= 45 && trendScore >= 20) ||
    (bullAlign && pos < 72 && vol >= 1.05)

  if (earlyRise) return "earlyRise"

  if ((flatMa && flatPrice) || (flatMa && trendScore >= 16 && trendScore <= 24)) {
    return "sideways"
  }

  if (bullAlign) return "rising"
  if (above60) return "earlyRise"
  if (below60 && dd <= 8) return "sideways"

  return "sideways"
}

/**
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 * @returns {StockPositionView & { inputs: PositionInputs; signals: string[] }}
 */
export function resolveStockPosition(stock) {
  const inputs = readPositionInputs(stock)
  const timingChecks = stock.timingScore?.checks ?? []
  const pullbackPass = timingChecks.find((c) => c.id === "pullback")?.pass

  if (pullbackPass && inputs.drawdownPct != null && inputs.drawdownPct >= 5) {
    const id = derivePositionId({ ...inputs, drawdownPct: inputs.drawdownPct })
    if (id !== "overheat" && id !== "downturn") {
      return buildPositionResult("pullback", inputs, stock)
    }
  }

  const id = derivePositionId(inputs)
  return buildPositionResult(id, inputs, stock)
}

/**
 * @param {StockPositionId} id
 * @param {PositionInputs} inputs
 * @param {import("./ydsStockPickModel.js").StockPickView} stock
 */
function buildPositionResult(id, inputs, stock) {
  const view = STOCK_POSITION_VIEWS[id] ?? STOCK_POSITION_VIEWS.sideways
  /** @type {string[]} */
  const signals = []

  if (inputs.close != null && inputs.ma20 != null) {
    signals.push(inputs.close > inputs.ma20 ? "20일선 위" : "20일선 아래")
  }
  if (inputs.ma20 != null && inputs.ma60 != null) {
    signals.push(inputs.ma20 > inputs.ma60 ? "20>60 정배열" : "20·60 역배열")
  }
  if (inputs.volRatio != null) {
    signals.push(
      inputs.volRatio >= 1.1 ? "거래량 증가" : inputs.volRatio < 0.85 ? "거래량 위축" : "거래량 보통",
    )
  }
  signals.push(`상대강도 ${inputs.relativeStrength}`)
  if (inputs.rsi14 != null) signals.push(`RSI ${Math.round(inputs.rsi14)}`)
  if (inputs.drawdownPct != null) signals.push(`고점 대비 −${inputs.drawdownPct.toFixed(1)}%`)

  const highBreak = stock.timingScore?.checks?.find((c) => c.id === "highBreak")?.pass
  if (highBreak) signals.push("신고가 돌파")

  return { ...view, inputs, signals: signals.slice(0, 5) }
}
