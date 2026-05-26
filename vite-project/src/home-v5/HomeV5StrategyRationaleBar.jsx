import { useId, useState } from "react"

/**
 * @param {{ strategy: import("./homeV5DeskModel.js").HomeV5StrategyModel }} props
 */
export default function HomeV5StrategyRationaleBar({ strategy }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <div className="home-v5-strategy-bar" style={{ "--home-v5-regime-color": strategy.color }}>
      <button
        type="button"
        className="home-v5-strategy-bar__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        근거 보기
        <span aria-hidden>{open ? " ▲" : " ▼"}</span>
      </button>
      {open ? (
        <ul id={panelId} className="home-v5-strategy-bar__list">
          {strategy.rationale.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
