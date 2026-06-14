/**
 * @param {{
 *   reasons?: string[]
 *   className?: string
 * }} props
 */
export default function YdsStockPickNoChaseReasons({ reasons = [], className = "" }) {
  if (!reasons.length) return null

  return (
    <ul className={["yds-spick-no-chase", className].filter(Boolean).join(" ")}>
      {reasons.map((reason) => (
        <li key={reason} className="yds-spick-no-chase__item">
          ⚠ {reason}
        </li>
      ))}
    </ul>
  )
}
