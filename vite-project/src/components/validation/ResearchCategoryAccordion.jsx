import { useId, useState } from "react"

/**
 * Research Lab 카테고리 접기 — Phase 번호 없음
 *
 * @param {{
 *   title: string
 *   description?: string
 *   defaultOpen?: boolean
 *   children: import("react").ReactNode
 * }} props
 */
export default function ResearchCategoryAccordion({
  title,
  description = "",
  defaultOpen = false,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()

  return (
    <div className={`research-category-accordion${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="research-category-accordion__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="research-category-accordion__chevron" aria-hidden>
          {open ? "▼" : "▶"}
        </span>
        <span className="research-category-accordion__title">{title}</span>
        {!open && description ? (
          <span className="research-category-accordion__desc">{description}</span>
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          className="research-category-accordion__panel"
          role="region"
          aria-label={title}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}
