import { useMemo } from "react"
import { resolveActionSignalView } from "../content/ydsActionSignalView.js"

/**
 * YDS 행동 신호 — 지금 무엇을 해야 하는가 (3초)
 * @param {{ panicData?: object | null; historyRows?: object[] }} props
 */
export default function YdsActionSignalCenter({ panicData = null, historyRows = [] }) {
  const view = useMemo(
    () => resolveActionSignalView(panicData, historyRows),
    [panicData, historyRows],
  )

  if (!view) return null

  return (
    <section className="yds-action-signal" aria-label="YDS 행동 신호">
      <p className="m-0 yds-action-signal__title">YDS 행동 신호</p>

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

      <div className="yds-action-signal__state">
        <p className="m-0 yds-action-signal__state-label">현재 상태</p>
        <p
          className="m-0 yds-action-signal__state-value"
          style={{ "--signal-color": view.stateColor }}
        >
          {view.stateEmoji} {view.stateLabel}
        </p>
      </div>
    </section>
  )
}
