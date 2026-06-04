import { useMemo } from "react"
import { Link } from "react-router-dom"
import { panicDataFromCycleRow } from "../../utils/cycleHistoryUtils.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildAlertCenterReport,
  ALERT_CENTER_LABEL,
} from "../../trading-zone/ydsAlertCenterEngine.js"

/**
 * @param {{
 *   events?: import("../../trading-zone/ydsHistoricalEventTypes.js").EventDetailData[]
 *   latestCycleRow?: Record<string, unknown> | null
 *   historyRows?: object[]
 * }} props
 */
export default function YdsAlertCenterPhase36Section({
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
      buildAlertCenterReport(events, {
        latestSnapshot,
        extraRows: historyRows,
        sync: typeof window !== "undefined",
      }),
    [events, latestSnapshot, historyRows],
  )

  return (
    <div className="yds-alert-center yds-alert-center--lab">
      <p className="yds-alert-center__kicker">{ALERT_CENTER_LABEL}</p>
      <p className="yds-alert-center__sub">
        히스토리 {report.historyCount}건 · S {report.sectionA.counts.S} / A{" "}
        {report.sectionA.counts.A} ·{" "}
        <Link to="/alert-center" className="yds-alert-center__link">
          Alert Center →
        </Link>
      </p>
      {report.sectionA.items.slice(0, 5).map((a) => (
        <p key={a.id} className="yds-alert-center__lab-line">
          <span className={`yds-alert-center__grade yds-alert-center__grade--${a.grade}`}>
            {a.grade}
          </span>{" "}
          {a.title} — {a.body.slice(0, 48)}
        </p>
      ))}
    </div>
  )
}
