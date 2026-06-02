/**
 * 종목 추천·TOP5 표시용 근거 문구 (점수·랭킹 로직과 분리)
 */

/** @type {Record<string, string>} */
const SYMBOL_SECTOR_THEME = {
  NVDA: "AI",
  AVGO: "반도체",
  META: "AI",
  SMH: "반도체",
  PLTR: "AI",
  TSLA: "성장",
  "실리콘투": "반도체",
}

/** @param {string[]} reasons @param {number} limit */
function pickTopDisplayReasons(reasons, limit = 3) {
  const skip = /섹터|연계|구간 일치|⚠/
  const unique = [...new Set(reasons)].filter((r) => r && !skip.test(r))
  /** @type {((s: string) => boolean)[]} */
  const priority = [
    (s) => /섹터 강세/.test(s),
    (s) => /추세 유지/.test(s),
    (s) => /거래량 증가/.test(s),
    (s) => /20일선/.test(s),
    (s) => /눌림/.test(s),
  ]
  const picked = []
  for (const test of priority) {
    const hit = unique.find((r) => test(r))
    if (hit && !picked.includes(hit)) picked.push(hit)
    if (picked.length >= limit) return picked
  }
  for (const r of unique) {
    if (!picked.includes(r)) picked.push(r)
    if (picked.length >= limit) break
  }
  return picked
}

/**
 * @param {import("./tacticalTradingZoneData.js").TradingZonePosition} position
 * @param {import("./tradingZoneStockEvaluation.js").TradingZoneStockEvaluation | undefined} ev
 * @param {{ regimeBoost?: boolean; focusStage?: string; limit?: number }} [ctx]
 * @returns {string[]}
 */
export function buildStockDisplayReasons(position, ev, ctx = {}) {
  const limit = ctx.limit ?? 3
  /** @type {string[]} */
  const reasons = []

  if (ev?.dataReady && ev.strengthHighlights?.length) {
    reasons.push(...ev.strengthHighlights)
  }
  if (ev?.dataReady && ev.entryRationale?.length) {
    for (const line of ev.entryRationale) {
      const normalized = line.replace(/20MA/gi, "20일선")
      if (!reasons.includes(normalized)) reasons.push(normalized)
    }
  }

  if (ev?.dataReady && ev.auxStrip?.length) {
    const ma = ev.auxStrip.find((x) => x.key === "20MA")
    if (ma?.display === "▲" && !reasons.some((r) => /20일선|20MA/.test(r))) {
      reasons.push("20일선 위")
    }
    const vol = ev.auxStrip.find((x) => x.key === "거래량")
    if (vol?.display === "▲" && !reasons.some((r) => /거래량/.test(r))) {
      reasons.push("거래량 증가")
    }
  }

  const sector = SYMBOL_SECTOR_THEME[position.symbol]
  if (ctx.regimeBoost && sector && !reasons.some((r) => /섹터/.test(r))) {
    reasons.push(`${sector} 섹터 강세`)
  }

  if (position.stage === "trend" || position.stage === "pullback") {
    if (!reasons.some((r) => /추세/.test(r))) reasons.push("추세 유지")
  }

  const histLen = position.stageHistory?.length ?? 0
  if (histLen >= 2 && !reasons.some((r) => /거래량/.test(r))) {
    reasons.push("거래량 증가")
  }

  return pickTopDisplayReasons(reasons, limit)
}
