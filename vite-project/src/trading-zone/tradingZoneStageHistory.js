/**
 * 실전 매매 존 — 단계 이력 표시 (자동 기록용 스키마)
 */
import { TRADING_STAGE_META } from "./tacticalTradingZoneData.js"

/** @param {string | undefined} iso */
export function formatStageHistoryDate(iso) {
  if (!iso) return ""
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[2]}/${m[3]}`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${mm}/${dd}`
}

/**
 * @param {import("./tacticalTradingZoneData.js").TradingStageHistoryEntry} entry
 * @param {number} index
 * @param {import("./tacticalTradingZoneData.js").TradingStageId | null} prevStage
 */
export function buildStageHistoryMessage(entry, index, prevStage) {
  if (entry.note?.trim()) return entry.note.trim()

  const meta = TRADING_STAGE_META[entry.stage]
  const label = meta?.label ?? entry.stage

  if (index === 0) {
    if (entry.stage === "interest") return `${label}진입`
    return label
  }
  if (prevStage === entry.stage) return `${label}유지`
  if (entry.stage === "interest" && prevStage !== "interest") return label
  return label
}

/**
 * 타임라인 한 칸: `05/18 관심진입`
 * @param {{ dateLabel: string; message: string; stage: string }} item
 */
export function formatStageHistoryTimelineSegment(item) {
  const text = item.message.replace(/\s+/g, "")
  return item.dateLabel ? `${item.dateLabel} ${text}` : text
}

/**
 * 타임라인 chip: `05/18 관심`
 * @param {{ dateLabel: string; stage: import("./tacticalTradingZoneData.js").TradingStageId }} item
 */
export function formatStageHistoryChipLabel(item) {
  const meta = TRADING_STAGE_META[item.stage]
  const label = meta?.label ?? item.stage
  return item.dateLabel ? `${item.dateLabel} ${label}` : label
}

/**
 * 칩 표시: `🟢 05/22 관심`
 * @param {{ dateLabel: string; stage: import("./tacticalTradingZoneData.js").TradingStageId }} item
 */
export function formatStageHistoryChipDisplay(item) {
  const meta = TRADING_STAGE_META[item.stage]
  const emoji = meta?.emoji ?? "⚪"
  return `${emoji} ${formatStageHistoryChipLabel(item)}`
}

/**
 * 배지 행 표시: `● 05/22 관심`
 * @param {{ dateLabel: string; stage: import("./tacticalTradingZoneData.js").TradingStageId }} item
 */
export function formatStageHistoryBadgeDisplay(item) {
  const meta = TRADING_STAGE_META[item.stage]
  const label = meta?.label ?? item.stage
  const date = item.dateLabel ?? ""
  return date ? `● ${date} ${label}` : `● ${label}`
}

/**
 * 타임라인 표시: `🟢05/18 관심`
 * @param {{ dateLabel: string; stage: import("./tacticalTradingZoneData.js").TradingStageId }} item
 */
export function formatStageHistoryTimelineDisplay(item) {
  const meta = TRADING_STAGE_META[item.stage]
  const emoji = meta?.emoji ?? "⚪"
  const label = meta?.label ?? item.stage
  const date = item.dateLabel ?? ""
  return date ? `${emoji}${date} ${label}` : `${emoji}${label}`
}

/** @param {string | number | null | undefined} raw */
function formatHistoryTooltipPrice(raw) {
  if (raw == null || raw === "") return null
  const n = Number(String(raw).replace(/,/g, ""))
  if (Number.isFinite(n)) {
    return n >= 1000 ? Math.round(n).toLocaleString("ko-KR") : String(Math.round(n * 10) / 10)
  }
  return String(raw).trim()
}

/**
 * @param {{
 *   stage: import("./tacticalTradingZoneData.js").TradingStageId
 *   dateLabel: string
 *   message: string
 *   label: string
 *   price: string | null
 *   score: string | null
 * }} item
 */
export function buildStageHistoryTooltipLines(item) {
  return {
    price: item.price ?? "—",
    score: item.score ?? "—",
    state: item.message || item.label,
  }
}

/**
 * @param {import("./tacticalTradingZoneData.js").TradingStageHistoryEntry[]} history
 */
export function formatStageHistoryLog(history) {
  if (!history?.length) return []

  return history.map((h, i) => {
    const prev = i > 0 ? history[i - 1].stage : null
    const meta = TRADING_STAGE_META[h.stage]
    const price = formatHistoryTooltipPrice(h.price)
    const score =
      h.score != null && h.score !== "" ? String(h.score).trim() : null
    return {
      stage: h.stage,
      dateLabel: formatStageHistoryDate(h.at),
      message: buildStageHistoryMessage(h, i, prev),
      label: meta?.label ?? h.stage,
      price,
      score,
    }
  })
}
