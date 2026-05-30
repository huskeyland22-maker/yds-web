import {
  MACRO_V1_STATUS_BANDS,
  resolveMacroV1Status,
} from "../../panic-v2/panicMacroV1Status.js"

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
  const currentId = current?.id ?? null

  return (
    <section className="tactical-zone-macro-progress" aria-label="거시 단계 진행도">
      <p className="m-0 tactical-zone-macro-progress__head">거시 단계</p>
      <ol className="m-0 tactical-zone-macro-progress__rail">
        {MACRO_PROGRESS_STEPS.map((step, index) => {
          const band = MACRO_V1_STATUS_BANDS.find((b) => b.id === step.id)
          const active = step.id === currentId
          const passed =
            currentId != null &&
            MACRO_V1_STATUS_BANDS.findIndex((b) => b.id === currentId) > index
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
            >
              <span className="tactical-zone-macro-progress__dot" aria-hidden />
              <span className="tactical-zone-macro-progress__label">{step.short}</span>
              {active && current ? (
                <span className="tactical-zone-macro-progress__now">
                  <span aria-hidden>{current.emoji}</span> 현재
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
