import { useMemo } from "react"
import { buildStockPickChangeReport } from "../../content/ydsStockPickChangeEngine.js"

/**
 * @param {{
 *   stock: import("../../content/ydsStockPickModel.js").StockPickView
 *   variant?: 'card' | 'detail'
 *   className?: string
 * }} props
 */
export default function YdsStockPickChangeStrip({ stock, variant = "card", className = "" }) {
  const report = useMemo(
    () => stock.pickMeta?.changeReport ?? buildStockPickChangeReport(stock),
    [stock],
  )

  const hasMultiDay =
    report.day1Display || report.day5Display || report.day20Display
  const hasGrade = report.gradeChanges.length > 0
  const hasPosition = Boolean(report.positionChange)

  if (variant === "card" && !hasMultiDay && !hasGrade && !hasPosition) {
    return (
      <div className={["yds-spick-change", "yds-spick-change--score-only", className].filter(Boolean).join(" ")}>
        <p className="yds-spick-change__score-row font-mono tabular-nums">
          <strong>{report.totalScore}</strong>점
        </p>
        <span className={`yds-spick-change__badge yds-spick-change__badge--${report.changeBadge.tone}`}>
          {report.changeBadge.label}
        </span>
      </div>
    )
  }

  return (
    <div
      className={[
        "yds-spick-change",
        variant === "detail" ? "yds-spick-change--detail" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="yds-spick-change__head">
        <p className="yds-spick-change__score-row font-mono tabular-nums">
          <strong>{report.totalScore}</strong>점
          {report.day1Arrow ? (
            <span
              className={[
                "yds-spick-change__day1",
                report.day1?.direction === "up" ? "yds-spick-change__day1--up" : "",
                report.day1?.direction === "down" ? "yds-spick-change__day1--down" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {report.day1Arrow}
            </span>
          ) : null}
        </p>
        <span className={`yds-spick-change__badge yds-spick-change__badge--${report.changeBadge.tone}`}>
          {report.changeBadge.label}
        </span>
      </div>

      {hasMultiDay ? (
        <p className="yds-spick-change__periods font-mono tabular-nums">
          {report.day1Display ? <span>1일 {report.day1Display}</span> : null}
          {report.day5Display ? <span>5일 {report.day5Display}</span> : null}
          {report.day20Display ? <span>20일 {report.day20Display}</span> : null}
        </p>
      ) : null}

      {hasGrade || hasPosition ? (
        <ul className="yds-spick-change__shifts">
          {report.gradeChanges.map((g) => (
            <li
              key={g.label}
              className={[
                "yds-spick-change__shift",
                g.direction === "up" ? "yds-spick-change__shift--up" : "",
                g.direction === "down" ? "yds-spick-change__shift--down" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="yds-spick-change__shift-label">{g.label}</span>
              <span className="font-mono tabular-nums">{g.display}</span>
            </li>
          ))}
          {report.positionChange ? (
            <li className="yds-spick-change__shift yds-spick-change__shift--position">
              <span className="yds-spick-change__shift-label">위치</span>
              <span>{report.positionChange.display}</span>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
