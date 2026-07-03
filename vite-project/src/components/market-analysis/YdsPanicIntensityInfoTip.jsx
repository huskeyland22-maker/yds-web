import { useId, useState } from "react"
import { PANIC_INTENSITY_LEGEND_STAGES } from "../../content/ydsPanicIntensityLegend.js"

/**
 * 패닉 강도 단계 설명 (ⓘ)
 * @param {{ className?: string }} props
 */
export default function YdsPanicIntensityInfoTip({ className = "" }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <div
      className={["yds-panic-intensity-info", className].filter(Boolean).join(" ")}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="yds-panic-intensity-info__btn"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="패닉 강도 단계 설명"
        onClick={() => setOpen((value) => !value)}
      >
        ⓘ
      </button>

      {open ? (
        <div
          id={panelId}
          className="yds-panic-intensity-info__panel"
          role="tooltip"
        >
          <p className="yds-panic-intensity-info__panel-title">패닉 강도 단계</p>
          <ul className="yds-panic-intensity-info__list">
            {PANIC_INTENSITY_LEGEND_STAGES.map((stage) => (
              <li key={stage.id} className="yds-panic-intensity-info__item">
                <p className="yds-panic-intensity-info__item-title">
                  {stage.emoji} {stage.label} ({stage.min}~{stage.max})
                </p>
                <p className="yds-panic-intensity-info__item-text">{stage.tooltipText}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
