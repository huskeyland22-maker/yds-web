/**
 * @param {{ reasons?: string[]; className?: string; max?: number }} props
 */
export default function StockPickReasonList({ reasons = [], className = "", max = 3 }) {
  const lines = (reasons ?? []).filter(Boolean).slice(0, max)
  if (!lines.length) return null

  return (
    <ul className={["stock-pick-reasons", className].filter(Boolean).join(" ")}>
      {lines.map((line) => (
        <li key={line} className="stock-pick-reasons__item">
          <span className="stock-pick-reasons__mark" aria-hidden>
            ✓
          </span>
          {line}
        </li>
      ))}
    </ul>
  )
}
