import { buildTodayActionBarRows } from "../../trading-zone/marketPolicyEngine.js"

/**
 * @param {{
 *   marketPolicy?: {
 *     stockActionRange?: { newEntry?: string; chase?: string; splitBuy?: string; cash?: string }
 *     sectorBias?: { label?: string; sectors?: string[] }
 *   } | null
 * }} props
 */
export default function TacticalTodayActionBar({ marketPolicy = null }) {
  const rows = buildTodayActionBarRows(marketPolicy?.stockActionRange)
  const sectors = marketPolicy?.sectorBias?.sectors?.filter(Boolean) ?? []

  if (!rows.length && !sectors.length) return null

  return (
    <section className="tactical-zone-today-action" aria-label="오늘 행동">
      <p className="m-0 tactical-zone-today-action__head">오늘 행동</p>
      {rows.length ? (
        <ul className="m-0 tactical-zone-today-action__list">
          {rows.map((row) => (
            <li
              key={row.text}
              className={["tactical-zone-today-action__item", `tactical-zone-today-action__item--${row.tone}`].join(
                " ",
              )}
            >
              <span className="tactical-zone-today-action__icon" aria-hidden>
                {row.icon}
              </span>
              <span>{row.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {sectors.length ? (
        <p className="m-0 tactical-zone-today-action__sectors">
          <span className="tactical-zone-today-action__sectors-k">우선 섹터:</span>
          <span className="tactical-zone-today-action__sectors-v">{sectors.join(" / ")}</span>
        </p>
      ) : null}
    </section>
  )
}
