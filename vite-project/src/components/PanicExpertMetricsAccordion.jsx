import { useId, useState } from "react"

const EXPERT_HINT = "MOVE / SKEW / BofA / GS / VXN"

/**
 * 데스크톱·모바일 공통 — 기본 접힘 · 200ms opacity + max-height
 *
 * @param {{ children: import("react").ReactNode }} props
 */
export default function PanicExpertMetricsAccordion({ children }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <div className={`panic-expert-accordion${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="panic-expert-accordion__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="panic-expert-accordion__toggle-main">
          <span className="panic-expert-accordion__title">전문가 리스크 지표</span>
          <span className="panic-expert-accordion__chevron" aria-hidden>
            {open ? "▲" : "▼"}
          </span>
        </span>
        {!open ? (
          <span className="panic-expert-accordion__hint">{EXPERT_HINT}</span>
        ) : null}
      </button>

      <div
        id={panelId}
        className="panic-expert-accordion__panel"
        role="region"
        aria-label="전문가 리스크 지표"
        aria-hidden={!open}
      >
        <div className="panic-expert-accordion__inner">
          <section className="panic-expert-accordion__body">{children}</section>
        </div>
      </div>
    </div>
  )
}
