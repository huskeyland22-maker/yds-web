import { useMemo } from "react"
import { useAppDataStore } from "../../store/appDataStore.js"
import { resolveMarketUpdateTime } from "../../utils/marketUpdateTime.js"

/** @param {string | undefined} badge */
function resolveOpsLiveLabel(badge, fallbackLabel) {
  if (badge === "live") return "Live"
  if (badge === "cached") return "Cached"
  if (badge === "local-fallback" || badge === "none") return "Local"
  return fallbackLabel?.replace(/\s*\([^)]*\)/, "") ?? "—"
}

/**
 * @param {{ panicData?: object | null }} props
 */
export default function YdsMarketAnalysisOpsMeta({ panicData = null }) {
  const reliability = useAppDataStore((s) => s.cycleDataReliability)
  const marketTime = useMemo(() => resolveMarketUpdateTime(panicData), [panicData])

  const badge = reliability?.badge ?? "none"
  const liveLabel = resolveOpsLiveLabel(badge, reliability?.badgeLabel)
  const clientRows = reliability?.pipeline?.clientRows ?? 0

  const title = [
    reliability?.badgeLabel,
    marketTime.basisNote,
    marketTime.kstLabel ? `동기화 ${marketTime.kstLabel}` : null,
    clientRows > 0 ? `히스토리 ${clientRows}행` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div className="yds-market-analysis__ops" title={title || undefined} aria-label="데이터 동기화 상태">
      <p className="yds-market-analysis__ops-live">
        <span
          className={["yds-market-analysis__ops-dot", `yds-market-analysis__ops-dot--${badge}`].join(" ")}
          aria-hidden
        >
          ●
        </span>
        {liveLabel}
      </p>
      <p className="yds-market-analysis__ops-time font-mono tabular-nums">
        {marketTime.kstLabel ?? "—"}
      </p>
    </div>
  )
}
