import { useMemo } from "react"
import { resolveActionSignalView } from "../content/ydsActionSignalView.js"

/**
 * 현재 전략 — 지금 무엇을 해야 하는가 (3초)
 * @param {{ panicData?: object | null; historyRows?: object[] }} props
 */
export default function YdsActionSignalCenter({ panicData = null, historyRows = [] }) {
  const view = useMemo(
    () => resolveActionSignalView(panicData, historyRows),
    [panicData, historyRows],
  )

  if (!view) return null

  return (
    <section className="yds-action-signal yds-action-signal--conclusion" aria-label="현재 전략">
      <header className="yds-action-signal__header">
        <p className="m-0 yds-action-signal__title">현재 전략</p>
        <p className="m-0 yds-action-signal__lead">지금 해야 할 행동</p>
      </header>

      <div className="yds-action-signal__body">
        <p
          className="m-0 yds-action-signal__mode"
          style={{ "--signal-color": view.strategyColor }}
        >
          {view.strategyEmoji} {view.strategyLabel}
        </p>

        <ul className="yds-action-signal__list">
          {view.signals.map((line) => (
            <li key={line.text} className="yds-action-signal__item">
              <span className="yds-action-signal__emoji" aria-hidden>
                {line.emoji}
              </span>
              <span className="yds-action-signal__text">{line.text}</span>
            </li>
          ))}
        </ul>
      </div>

      {view.contextLine ? (
        <p className="m-0 yds-action-signal__context">{view.contextLine}</p>
      ) : null}
    </section>
  )
}
