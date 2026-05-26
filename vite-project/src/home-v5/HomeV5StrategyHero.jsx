import { useId, useState } from "react"

/**
 * @param {{ strategy: import("./homeV5DeskModel.js").HomeV5StrategyModel }} props
 */
export default function HomeV5StrategyHero({ strategy }) {
  const [rationaleOpen, setRationaleOpen] = useState(false)
  const panelId = useId()

  return (
    <section
      className="home-v5-strategy home-v5-strategy--hero trading-card-shell"
      style={{ "--home-v5-regime-color": strategy.color }}
      aria-label="투자 전략 엔진"
    >
      <p className="home-v5-strategy__regime">
        <span className="home-v5-strategy__emoji" aria-hidden>
          {strategy.emoji}
        </span>
        <span className="home-v5-strategy__label">{strategy.label}</span>
      </p>
      <p className="home-v5-strategy__action">{strategy.action}</p>
      <button
        type="button"
        className="home-v5-strategy__toggle"
        aria-expanded={rationaleOpen}
        aria-controls={panelId}
        onClick={() => setRationaleOpen((v) => !v)}
      >
        근거 보기
        <span aria-hidden>{rationaleOpen ? " ▲" : " ▼"}</span>
      </button>
      {rationaleOpen ? (
        <ul id={panelId} className="home-v5-strategy__rationale">
          {strategy.rationale.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
