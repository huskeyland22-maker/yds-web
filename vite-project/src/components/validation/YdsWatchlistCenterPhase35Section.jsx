import { useMemo } from "react"
import { Link } from "react-router-dom"
import { panicDataFromCycleRow } from "../../utils/cycleHistoryUtils.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildWatchlistCenterReport,
  WATCHLIST_CENTER_LABEL,
} from "../../trading-zone/ydsWatchlistCenterEngine.js"

/**
 * @param {{
 *   events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[]
 *   latestCycleRow?: Record<string, unknown> | null
 *   historyRows?: object[]
 * }} props
 */
export default function YdsWatchlistCenterPhase35Section({
  events = YDS_VALIDATION_EVENT_DATASET,
  latestCycleRow = null,
  historyRows = [],
}) {
  const latestSnapshot = useMemo(() => {
    if (!latestCycleRow) return null
    const panic = panicDataFromCycleRow(latestCycleRow)
    if (panic) return { ...latestCycleRow, ...panic, date: latestCycleRow.date ?? panic.updatedAt }
    return latestCycleRow
  }, [latestCycleRow])

  const report = useMemo(
    () =>
      buildWatchlistCenterReport(events, {
        latestSnapshot,
        extraRows: historyRows,
      }),
    [events, latestSnapshot, historyRows],
  )

  if (!report.available) {
    return <p className="yds-watchlist__empty">관심종목을 생성할 수 없습니다.</p>
  }

  return (
    <div className="yds-watchlist yds-watchlist--lab">
      <p className="yds-watchlist__kicker">{WATCHLIST_CENTER_LABEL}</p>
      <p className="yds-watchlist__sub">
        {report.stage.display} · Top {report.sectionA.items.length} ·{" "}
        <Link to="/watchlist" className="yds-watchlist__link">
          관심종목 열기 →
        </Link>
      </p>
      <ol className="yds-watchlist__top-list">
        {report.sectionA.items.slice(0, 5).map((item) => (
          <li key={item.id}>
            <span className="font-mono tabular-nums">{item.rank}</span>
            <span className="yds-watchlist__top-name">{item.name}</span>
            <span className={`yds-watchlist__pill yds-watchlist__pill--${item.watchStateTone}`}>
              {item.watchStateLabel}
            </span>
            <span className="font-mono tabular-nums">{item.adjustedScoreDisplay}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
