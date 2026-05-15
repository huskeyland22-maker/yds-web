/**
 * 사이트 공통 — 패닉지표(updatedAt) 기준 KST 시각·기준 문구.
 * value-chain-heat.json mock 날짜는 UI에 사용하지 않음.
 */

/** @param {string | null | undefined} iso */
export function formatMarketBasisKst(iso) {
  const raw = iso ? new Date(iso) : new Date()
  const d = Number.isFinite(raw.getTime()) ? raw : new Date()
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d)
  const y = parts.find((p) => p.type === "year")?.value
  const mo = parts.find((p) => p.type === "month")?.value
  const day = parts.find((p) => p.type === "day")?.value
  const h = parts.find((p) => p.type === "hour")?.value
  const mi = parts.find((p) => p.type === "minute")?.value
  if (!y || !mo || !day) return "—"
  return `${y}-${mo}-${day} ${h ?? "00"}:${mi ?? "00"} KST`
}

/** @param {string | null | undefined} iso */
function kstHour(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return null
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(d)
  const h = Number(parts.find((p) => p.type === "hour")?.value)
  return Number.isFinite(h) ? h : null
}

/**
 * @param {unknown} panicData
 * @returns {{
 *   updateLine: string
 *   basisLine: string
 *   basisLabelKst: string
 *   basisNote: string
 *   updatePrefix: string
 *   sourceIso: string | null
 * }}
 */
export function resolveMarketTimestampDisplay(panicData) {
  const sourceIso = panicData?.updatedAt ?? panicData?.updated_at ?? null
  const basisLabelKst = formatMarketBasisKst(sourceIso)
  const hour = kstHour(sourceIso)

  let updatePrefix = "매크로 업데이트"
  let basisNote = "미국장 종가 기준"

  if (hour != null && hour >= 15 && hour < 20) {
    updatePrefix = "시장 상태 기준"
    basisNote = "국내장 마감 기준"
  } else if (hour != null && hour >= 6 && hour < 12) {
    updatePrefix = "매크로 업데이트"
    basisNote = "미국장 종가 기준"
  }

  const updateLine = basisLabelKst !== "—" ? `${updatePrefix} · ${basisLabelKst}` : `${updatePrefix} · —`

  return {
    updateLine,
    basisLine: basisNote,
    basisLabelKst,
    basisNote,
    updatePrefix,
    sourceIso: sourceIso ? String(sourceIso) : null,
  }
}
