import { useMemo } from "react"
import { useAppDataStore } from "../../store/appDataStore.js"
import { formatMarketBasisKst } from "../../utils/marketTimestamp.js"
import {
  classifyPanicScoreState,
  hasConfirmedCollection,
  isPlaceholderUpdatedAt,
  panicAsOfDate,
} from "../../utils/panicDataFreshness.js"

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
  const scoreState = useMemo(() => classifyPanicScoreState(panicData), [panicData])
  const asOfDate = panicAsOfDate(panicData)
  const showCollectionClock =
    scoreState === "LIVE" && hasConfirmedCollection(panicData) && !isPlaceholderUpdatedAt(panicData)
  const collectionLabel = showCollectionClock
    ? formatMarketBasisKst(panicData?.updatedAt ?? panicData?.updated_at)
    : null

  const badge = reliability?.badge ?? "none"
  const liveLabel = resolveOpsLiveLabel(badge, reliability?.badgeLabel)
  const clientRows = reliability?.pipeline?.clientRows ?? 0

  const title = [
    reliability?.badgeLabel,
    scoreState,
    asOfDate ? `기준일 ${asOfDate}` : "기준일 없음",
    collectionLabel ? `수집 ${collectionLabel}` : "수집 시각 없음",
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
        {!asOfDate && scoreState === "MISSING"
          ? "최신 데이터 없음"
          : `${scoreState} · ${asOfDate ? `기준일 ${asOfDate}` : "기준일 없음"}${
              collectionLabel ? ` · 수집 ${collectionLabel}` : " · 수집 시각 없음"
            }`}
      </p>
    </div>
  )
}
