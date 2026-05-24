/**
 * 패닉·거시·실전·장기 참고 — 단일 업데이트 시각 (panic hub updatedAt)
 */
import { formatMarketBasisKst } from "./marketTimestamp.js"

/**
 * @param {unknown} panicData
 * @returns {{
 *   iso: string | null
 *   basisNote: string
 *   kstLabel: string | null
 * }}
 */
export function resolveMarketUpdateTime(panicData) {
  const iso =
    panicData?.updatedAt ??
    panicData?.updated_at ??
    panicData?.marketUpdateTime ??
    null

  const kstRaw = formatMarketBasisKst(iso)
  const kstLabel = kstRaw !== "—" ? kstRaw : null

  return {
    iso: iso != null ? String(iso) : null,
    basisNote: "미국장 종가 기준",
    kstLabel,
  }
}
