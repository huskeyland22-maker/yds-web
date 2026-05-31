import { buildHomeV5DeskModel } from "../home-v5/homeV5DeskModel.js"
import { resolveHomeV5StrategyRegime } from "../home-v5/homeV5StrategyRegime.js"
import { resolveMarketTimestampDisplay } from "./marketTimestamp.js"

/**
 * @typedef {{
 *   ready: boolean
 *   headline: string
 *   stageLabel: string
 *   regimeId: string | null
 *   accentColor: string | null
 *   actionLines: string[]
 *   updateLine: string
 *   basisLine: string
 * }} AiReportMarketStatus
 */

/** @param {string} line */
function normalizeActionLine(line) {
  const t = String(line ?? "").trim()
  if (!t) return ""
  if (t === "추격 금지") return "추격매수 제한"
  if (t === "추격 진입 제한") return "추격매수 제한"
  return t.replace(/\s+우선$/u, " 우선")
}

/**
 * @param {string[]} segments
 * @param {string} stageLabel
 */
function pickActionGuideLines(segments, stageLabel) {
  const plainStage = stageLabel.replace(/\s*구간$/u, "").trim()
  const rest = segments
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .filter((s) => {
      const stripped = s.replace(/^[\p{Extended_Pictographic}\s]+/u, "").trim()
      if (stripped === stageLabel || stripped === plainStage) return false
      if (stageLabel && s.includes(stageLabel)) return false
      return true
    })

  const tactical = rest.filter((s) => /탐색|추격|금지|제한|눌림|분할|현금|방어|익절|관망/.test(s))
  const generic = rest.filter((s) => !/기본비중|유지|관찰/.test(s))
  const pool = tactical.length ? tactical : generic.length ? generic : rest

  const unique = []
  for (const line of pool) {
    const norm = normalizeActionLine(line)
    if (norm && !unique.includes(norm)) unique.push(norm)
    if (unique.length >= 2) break
  }
  return unique
}

/**
 * AI 리포트·사이드바 — YDS 단계 + 행동 가이드 (VIX/F&G 수치 제외)
 * @param {object | null | undefined} panicData
 * @param {object[]} [historyRows]
 * @returns {AiReportMarketStatus}
 */
export function buildAiReportMarketStatus(panicData, historyRows = []) {
  const ts = resolveMarketTimestampDisplay(panicData)
  const updateLine =
    ts.basisLabelKst && ts.basisLabelKst !== "—"
      ? `업데이트 ${ts.basisLabelKst}`
      : "업데이트 —"

  const band = resolveHomeV5StrategyRegime(panicData)
  if (!band) {
    return {
      ready: false,
      headline: "현재 시장",
      stageLabel: "—",
      regimeId: null,
      accentColor: null,
      actionLines: [],
      updateLine,
      basisLine: ts.basisLine,
    }
  }

  const model = buildHomeV5DeskModel(panicData, historyRows)
  const segments = model.strategyBar?.segments ?? []
  const actionLines = pickActionGuideLines(segments, band.label)

  return {
    ready: true,
    headline: `${band.emoji} 현재 시장`,
    stageLabel: band.label,
    regimeId: band.id,
    accentColor: band.color,
    actionLines,
    updateLine,
    basisLine: ts.basisLine,
  }
}
