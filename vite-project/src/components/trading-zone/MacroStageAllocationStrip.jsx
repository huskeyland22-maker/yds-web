import { useMemo } from "react"
import { resolveHomeV5StrategyRegime } from "../../home-v5/homeV5StrategyRegime.js"
import { resolveMacroStageAllocation } from "../../trading-zone/macroStageAllocation.js"

/**
 * @param {{ panicData?: object | null; className?: string }} props
 */
export default function MacroStageAllocationStrip({ panicData = null, className = "" }) {
  const view = useMemo(() => {
    const regime = resolveHomeV5StrategyRegime(panicData)
    if (!regime) return null
    const alloc = resolveMacroStageAllocation(regime.id)
    if (!alloc) return null
    return {
      regimeId: regime.id,
      regimeLabel: regime.label,
      emoji: regime.emoji,
      stockLabel: alloc.stockLabel,
      cashLabel: alloc.cashLabel,
      note: alloc.note,
    }
  }, [panicData])

  if (!view) return null

  return (
    <div
      className={["macro-stage-allocation", className].filter(Boolean).join(" ")}
      role="status"
      data-regime={view.regimeId}
      aria-label={`${view.regimeLabel} 권장 비중 ${view.stockLabel} ${view.cashLabel}`}
    >
      <p className="m-0 macro-stage-allocation__stage">
        <span aria-hidden>{view.emoji}</span> {view.regimeLabel}
      </p>
      <p className="m-0 macro-stage-allocation__split">
        <span>{view.stockLabel}</span>
        <span className="macro-stage-allocation__sep" aria-hidden>
          ·
        </span>
        <span>{view.cashLabel}</span>
      </p>
      {view.note ? <p className="m-0 macro-stage-allocation__note">{view.note}</p> : null}
    </div>
  )
}
