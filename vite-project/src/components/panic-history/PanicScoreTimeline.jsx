import { PANIC_V2_STATUS_BANDS } from "../../panic-v2/panicV2Status.js"

/**
 * @param {{ items: { axisLabel: string; score: number; status?: string | null; statusId?: string | null }[] }} props
 */
export default function PanicScoreTimeline({ items }) {
  if (!items.length) return null

  return (
    <div className="panic-score-timeline" aria-label="최근 패닉지수">
      <div className="panic-score-timeline__track">
        {items.map((item) => (
          <div
            key={item.axisLabel}
            className={[
              "panic-score-timeline__item",
              item.statusId ? `panic-score-timeline__item--${item.statusId}` : "",
            ].join(" ")}
            title={item.status ? `${item.axisLabel} · ${item.status}` : item.axisLabel}
          >
            <span className="panic-score-timeline__date">{item.axisLabel}</span>
            <span className="panic-score-timeline__score font-mono tabular-nums">{item.score}</span>
          </div>
        ))}
      </div>
      <div className="panic-score-timeline__legend" aria-hidden>
        {PANIC_V2_STATUS_BANDS.map((b) => (
          <span key={b.id} className={`panic-score-timeline__legend-chip panic-score-timeline__legend-chip--${b.id}`}>
            {b.label}
          </span>
        ))}
      </div>
    </div>
  )
}
