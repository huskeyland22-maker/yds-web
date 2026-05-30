import { buildTodayActionCompact } from "../../trading-zone/marketPolicyEngine.js"

/**
 * @param {{
 *   marketPolicy?: {
 *     stockActionRange?: { newEntry?: string; chase?: string; splitBuy?: string; cash?: string }
 *     sectorBias?: { label?: string; sectors?: string[] }
 *   } | null
 * }} props
 */
export default function TacticalTodayActionBar({ marketPolicy = null }) {
  const compact = buildTodayActionCompact(marketPolicy?.stockActionRange, marketPolicy?.sectorBias)
  const cells = [
    compact.entry,
    compact.split,
    compact.chase,
    { label: "우선 섹터", value: compact.sectors, tone: "sector" },
  ]

  return (
    <section className="tactical-zone-today-action tactical-zone-today-action--compact" aria-label="오늘 행동">
      <p className="m-0 tactical-zone-today-action__head">오늘 행동</p>
      <dl className="m-0 tactical-zone-today-action__grid">
        {cells.map((cell) => (
          <div
            key={cell.label}
            className={["tactical-zone-today-action__cell", cell.tone ? `tactical-zone-today-action__cell--${cell.tone}` : ""]
              .filter(Boolean)
              .join(" ")}
          >
            <dt className="tactical-zone-today-action__cell-k">{cell.label}</dt>
            <dd className="m-0 tactical-zone-today-action__cell-v">{cell.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
