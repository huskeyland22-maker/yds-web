import { useId, useMemo, useState } from "react"
import { formatMetricValue } from "../components/macroCycleChartUtils.js"
import { getStatus } from "../utils/panicIndicatorStatus.js"
import { EXPERT_METRICS } from "../utils/panicDeskMetrics.js"

function fmt(key, v) {
  if (v == null || !Number.isFinite(Number(v))) return "—"
  return formatMetricValue(key, Number(v))
}

/**
 * @param {{ panicData?: object | null }} props
 */
export default function HomeV5MarketAnalysis({ panicData = null }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  const marketRows = useMemo(
    () => [
      { key: "bofa", label: "BofA Bull & Bear" },
      { key: "putCall", label: "Put/Call Ratio" },
      ...EXPERT_METRICS.filter((m) => ["move", "skew", "vxn"].includes(m.key)),
    ],
    [],
  )

  return (
    <section className={`home-v5-market home-v5-market--hero${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="home-v5-market__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="home-v5-market__toggle-main">
          <span className="home-v5-market__title">시장 분석</span>
          <span aria-hidden>{open ? "▲" : "▼"}</span>
        </span>
        {!open ? (
          <span className="home-v5-market__hint">BofA · Put/Call · MOVE · SKEW · 실험</span>
        ) : null}
      </button>
      <div id={panelId} className="home-v5-market__panel" role="region" aria-label="시장 분석" hidden={!open}>
        <ul className="home-v5-market__list">
          {marketRows.map(({ key, label }) => {
            const raw = panicData?.[key]
            const st = getStatus(key, raw)
            return (
              <li key={key} className="home-v5-market__row">
                <span className="home-v5-market__name">{label}</span>
                <span className="home-v5-market__num">{fmt(key, raw)}</span>
                <span className={`home-v5-market__st home-v5-market__st--${st.className}`}>{st.label}</span>
              </li>
            )
          })}
        </ul>
        <p className="home-v5-market__lab">실험 · 준비 중 — Breadth, 신고가/신저가</p>
      </div>
    </section>
  )
}
