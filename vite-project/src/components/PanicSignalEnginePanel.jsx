import { useMemo } from "react"
import { buildPanicSignalEngine, panicSignalBadgeClass } from "../utils/buildPanicSignalEngine.js"

/**
 * @param {{
 *   panicData?: object | null
 *   cycleScore?: number | null
 *   snapshot?: import("../macro-risk/engine.js").MacroRiskSnapshot | null
 * }} props
 */
export default function PanicSignalEnginePanel({
  panicData = null,
  cycleScore = null,
  snapshot = null,
}) {
  const sig = useMemo(
    () => buildPanicSignalEngine({ panicData, cycleScore, snapshot }),
    [panicData, cycleScore, snapshot],
  )

  const badgeCls = panicSignalBadgeClass(sig.signalId)

  if (!sig.ready) {
    return (
      <section className="panic-signal-engine" aria-label="패닉 시그널 엔진">
        <p className="m-0 panic-signal-engine__placeholder">9대 패닉지수 입력 후 시그널 생성</p>
      </section>
    )
  }

  return (
    <section className="panic-signal-engine" aria-label="패닉 시그널 엔진">
      <header className="panic-signal-engine__head">
        <p className="m-0 daily-report-v2__block-title text-slate-200/95">패닉 시그널</p>
        <p
          className={["m-0 panic-signal-engine__badge", badgeCls].filter(Boolean).join(" ")}
          aria-live="polite"
        >
          {sig.labelEn}
        </p>
      </header>

      <div className="panic-signal-engine__hero">
        <p className="m-0 daily-report-v2__value panic-signal-engine__hero-ko">{sig.labelKo}</p>
        <p className="m-0 daily-report-v2__label">{sig.hint}</p>
      </div>

      {sig.reasons.length > 0 ? (
        <p className="m-0 panic-signal-engine__meta-line">
          {sig.reasons.join(" · ")}
        </p>
      ) : null}

      {sig.bondNote ? (
        <p className="m-0 panic-signal-engine__bond-note">
          <span className="panic-signal-engine__bond-tag">보조</span>
          {sig.bondNote}
        </p>
      ) : null}
    </section>
  )
}
