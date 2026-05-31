/**
 * @param {{
 *   chips: { icon: string; label: string; tone?: string }[]
 *   className?: string
 * }} props
 */
export default function TacticalTodayActionChips({ chips = [], className = "" }) {
  if (!chips.length) return null

  return (
    <ul
      className={["tactical-today-chips", className].filter(Boolean).join(" ")}
      aria-label="오늘 행동 항목"
    >
      {chips.map((chip) => (
        <li
          key={chip.label}
          className={[
            "tactical-today-chips__chip",
            chip.tone ? `tactical-today-chips__chip--${chip.tone}` : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span className="tactical-today-chips__icon" aria-hidden>
            {chip.icon}
          </span>
          <span className="tactical-today-chips__label">{chip.label}</span>
        </li>
      ))}
    </ul>
  )
}
