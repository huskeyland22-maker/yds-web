import {
  MACRO_V1_STATUS_BANDS,
  resolveMacroV1Status,
} from "../../panic-v2/panicMacroV1Status.js"
import { resolveMacroStageAllocation } from "../../trading-zone/macroStageAllocation.js"

/** @type {{ id: string; short: string }[]} */
const MACRO_PROGRESS_STEPS = [
  { id: "overheated", short: "과열" },
  { id: "neutral", short: "중립" },
  { id: "interest", short: "관심" },
  { id: "dca", short: "분할매수" },
  { id: "panicBuy", short: "패닉매수" },
]

/**
 * @param {{ panicScore?: number | null }} props
 */
export default function TacticalMacroProgress({ panicScore = null }) {
  const current = resolveMacroV1Status(panicScore)
  const allocation = resolveMacroStageAllocation(current?.id)
  const currentId = current?.id ?? null
  const currentIndex = currentId != null ? MACRO_V1_STATUS_BANDS.findIndex((b) => b.id === currentId) : -1

  return (
    <section
      className="tactical-zone-macro-progress"
      aria-label="거시 단계 진행도"
      style={current ? { "--macro-current-color": current.color } : undefined}
    >
      {current ? (
        <p className="m-0 tactical-zone-macro-progress__current" role="status">
          <span className="tactical-zone-macro-progress__current-badge">현재</span>
          <span className="tactical-zone-macro-progress__current-emoji" aria-hidden>
            {current.emoji}
          </span>
          <span className="tactical-zone-macro-progress__current-label">{current.label}</span>
          {Number.isFinite(panicScore) ? (
            <span className="tactical-zone-macro-progress__current-score font-mono tabular-nums">
              {Math.round(panicScore)}
            </span>
          ) : null}
        </p>
      ) : null}

      {allocation ? (
        <p className="m-0 tactical-zone-macro-progress__allocation" role="status">
          <span className="tactical-zone-macro-progress__allocation-label">권장 비중</span>
          <span className="tactical-zone-macro-progress__allocation-val">
            {allocation.stockLabel} · {allocation.cashLabel}
          </span>
        </p>
      ) : null}

      <ol className="m-0 tactical-zone-macro-progress__rail" aria-hidden={!current}>
        {MACRO_PROGRESS_STEPS.map((step, index) => {
          const band = MACRO_V1_STATUS_BANDS.find((b) => b.id === step.id)
          const active = step.id === currentId
          const passed = currentIndex > index
          return (
            <li
              key={step.id}
              className={[
                "tactical-zone-macro-progress__step",
                active ? "tactical-zone-macro-progress__step--active" : "",
                passed ? "tactical-zone-macro-progress__step--passed" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={active && band ? { "--macro-step-color": band.color } : undefined}
              aria-current={active ? "step" : undefined}
            >
              <span className="tactical-zone-macro-progress__dot" aria-hidden />
              <span className="tactical-zone-macro-progress__label">{step.short}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
