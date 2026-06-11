import { buildTodayMarketMemo } from "../content/ydsTodayMarketMemo.js"
import { resolveMarketTimestampDisplay } from "./marketTimestamp.js"

/**
 * @typedef {{
 *   ready: boolean
 *   title: string
 *   memoLines: string[]
 *   updateLine: string
 *   basisLine: string
 * }} AiReportMarketStatus
 */

/**
 * AI 리포트·사이드바 — 오늘의 한줄 (시장 위치 + 패닉 강도 해석)
 * @param {object | null | undefined} panicData
 * @param {object[]} [_historyRows] — 레거시 호환 (미사용)
 * @returns {AiReportMarketStatus}
 */
export function buildAiReportMarketStatus(panicData, _historyRows = []) {
  const ts = resolveMarketTimestampDisplay(panicData)
  const updateLine =
    ts.basisLabelKst && ts.basisLabelKst !== "—"
      ? `업데이트 ${ts.basisLabelKst}`
      : "업데이트 —"

  const memo = buildTodayMarketMemo(panicData)

  if (!memo) {
    return {
      ready: false,
      title: "오늘의 해석",
      memoLines: ["시장 데이터를 불러오는 중입니다."],
      updateLine,
      basisLine: ts.basisLine,
    }
  }

  return {
    ready: true,
    title: memo.title,
    memoLines: memo.lines,
    updateLine,
    basisLine: ts.basisLine,
  }
}
