import { useId, useState } from "react"

/**
 * @param {{ label?: string; lines: string[] }} props
 */
export default function WhyExplainButton({ label = "왜?", lines }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  if (!lines?.length) return null

  return (
    <span className="yds-why-explain">
      <button
        type="button"
        className="yds-why-explain__btn"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>
      {open ? (
        <span id={panelId} className="yds-why-explain__panel" role="tooltip">
          <span className="yds-why-explain__title">간단 설명</span>
          <ul>
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </span>
      ) : null}
    </span>
  )
}
