import { useId, useState } from "react"

/**
 * Research 하위 섹션 접기 — Phase 번호 미표시
 *
 * @param {{
 *   title: string
 *   defaultOpen?: boolean
 *   children: import("react").ReactNode
 * }} props
 */
export default function ResearchSectionAccordion({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()

  return (
    <div className={`research-section-accordion${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="research-section-accordion__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="research-section-accordion__chevron" aria-hidden>
          {open ? "▼" : "▶"}
        </span>
        <span className="research-section-accordion__title">{title}</span>
      </button>

      {open ? (
        <div id={panelId} className="research-section-accordion__panel" role="region" aria-label={title}>
          {children}
        </div>
      ) : null}
    </div>
  )
}
