import {
  historyChangeToneClass,
  HIGHER_IS_BAD,
} from "../../utils/panicHistoryStats.js"

/**
 * @param {{
 *   header: {
 *     currentText: string
 *     statusLabel: string
 *     badge: { id: string; label: string; toneClass: string; color: string }
 *     fiveDayText: string
 *     fiveDayPct: number | null
 *     fiveDayPending?: boolean
 *     positionLabel: string
 *   }
 *   changeStrip: { label: string; text: string; pct: number | null; pending?: boolean; isPosition?: boolean }[]
 *   interpretationLines: string[]
 *   bottomInsight: string
 *   metricKey: string
 *   accent?: string
 * }} props
 */
export default function PanicHistoryInsightPanel({
  header,
  changeStrip,
  interpretationLines,
  bottomInsight,
  metricKey,
  accent = "#22d3ee",
}) {
  const higherIsBad = HIGHER_IS_BAD[metricKey] ?? true

  return (
    <div className="panic-history-insight">
      <div className="panic-history-insight__hero">
        <div className="panic-history-insight__hero-main">
          <p className="panic-history-insight__hero-label">현재값</p>
          <p
            className="panic-history-insight__hero-value font-mono tabular-nums"
            style={{ color: accent }}
          >
            {header.currentText}
          </p>
        </div>
        <div className="panic-history-insight__hero-meta">
          <InsightMini label="상태" value={header.statusLabel} />
          <InsightMini
            label="5D"
            value={header.fiveDayText}
            valueClassName={historyChangeToneClass(
              header.fiveDayPct,
              higherIsBad,
              header.fiveDayPending,
            )}
          />
          <InsightMini label="위치" value={header.positionLabel} />
        </div>
        <span
          className={["panic-badge panic-history-insight__badge", header.badge.toneClass].join(" ")}
          title={`패닉 상태 · ${header.badge.label}`}
        >
          {header.badge.label}
        </span>
      </div>

      {interpretationLines.length > 0 ? (
        <div className="panic-history-insight__interpret">
          {interpretationLines.map((line) => (
            <p key={line} className="panic-history-insight__interpret-line">
              {line}
            </p>
          ))}
        </div>
      ) : null}

      <div className="panic-history-insight__changes">
        {changeStrip.map((c) => (
          <div key={c.label} className="panic-history-insight__change-cell">
            <span className="panic-history-insight__change-label">{c.label}</span>
            <span
              className={[
                "panic-history-insight__change-value font-mono tabular-nums",
                c.isPosition
                  ? "text-slate-200"
                  : historyChangeToneClass(c.pct, higherIsBad, c.pending),
              ].join(" ")}
            >
              {c.text}
            </span>
          </div>
        ))}
      </div>

      {bottomInsight ? (
        <p className="panic-history-insight__footer">{bottomInsight}</p>
      ) : null}
    </div>
  )
}

/** @param {{ label: string; value: string; valueClassName?: string }} props */
function InsightMini({ label, value, valueClassName = "text-slate-100" }) {
  return (
    <div className="panic-history-insight__mini">
      <span className="panic-history-insight__mini-label">{label}</span>
      <span className={["panic-history-insight__mini-value font-mono tabular-nums", valueClassName].join(" ")}>
        {value}
      </span>
    </div>
  )
}
