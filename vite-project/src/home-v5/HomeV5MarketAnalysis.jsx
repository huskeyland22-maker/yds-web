import { useId, useMemo, useState } from "react"
import { formatMetricValue } from "../components/macroCycleChartUtils.js"
import { getStatus } from "../utils/panicIndicatorStatus.js"
import { CORE_METRICS } from "../utils/panicDeskMetrics.js"
import { getPanicScoreV2, resolvePanicIndexStatus } from "../utils/tradingScores.js"

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
    () => CORE_METRICS.map((m) => ({ key: m.key, label: m.label })),
    [],
  )

  const panicScore = useMemo(() => getPanicScoreV2(panicData), [panicData])
  const panicStatus = useMemo(() => resolvePanicIndexStatus(panicScore), [panicScore])

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
          <span className="home-v5-market__title">시장 공포·패닉</span>
          <span aria-hidden>{open ? "▲" : "▼"}</span>
        </span>
        {!open ? (
          <span className="home-v5-market__hint">
            {panicScore != null
              ? `Panic Index ${panicScore} · ${panicStatus?.label ?? ""}`
              : "VIX · CNN · Cboe Total P/C"}
          </span>
        ) : null}
      </button>
      <div id={panelId} className="home-v5-market__panel" role="region" aria-label="시장 공포·패닉" hidden={!open}>
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
          <li className="home-v5-market__row home-v5-market__row--total">
            <span className="home-v5-market__name">Panic Index</span>
            <span className="home-v5-market__num">
              {panicScore != null ? String(panicScore) : "데이터 입력 필요"}
            </span>
            <span className="home-v5-market__st">{panicStatus?.label ?? "—"}</span>
          </li>
        </ul>
      </div>
    </section>
  )
}
