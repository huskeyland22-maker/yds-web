import { useAppDataStore } from "../../store/appDataStore.js"

/**
 * V1.6.1 — Hero 우측 데이터 소스 배지
 * 🟢 Live (Supabase) · 🟡 Cached · 🔴 Local Fallback
 */
export default function YdsDataSourceBadge() {
  const reliability = useAppDataStore((s) => s.cycleDataReliability)
  const clientRows = reliability?.pipeline?.clientRows ?? 0

  const emoji = reliability?.badgeEmoji ?? "🔴"
  const label = reliability?.badgeLabel ?? "Local Fallback"

  return (
    <span
      className={`yds-data-source-badge yds-data-source-badge--${reliability?.badge ?? "none"}`}
      title={
        clientRows > 0
          ? `히스토리 ${clientRows}행 · ${reliability?.fallbackUsed ? `fallback: ${reliability.fallbackReason ?? "yes"}` : "live pipeline"}`
          : reliability?.diagnosis?.summary ?? "데이터 없음"
      }
      aria-label={`데이터 소스: ${label}`}
    >
      <span className="yds-data-source-badge__emoji" aria-hidden>
        {emoji}
      </span>
      <span className="yds-data-source-badge__label">{label}</span>
    </span>
  )
}
