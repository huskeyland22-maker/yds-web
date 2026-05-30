/**
 * @param {{ bar: import("./homeV5DeskModel.js").HomeV5StrategyStatusBarModel }} props
 */
export default function HomeV5CoreStrategyBar({ bar }) {
  if (!bar?.segments?.length) return null

  return (
    <div
      className={[
        "home-v5-core-strategy-bar",
        bar.regimeId ? `home-v5-core-strategy-bar--${bar.regimeId}` : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--home-v5-strategy-accent": bar.color }}
      role="status"
      aria-label={`YDS 전략: ${bar.segments.join(", ")}`}
    >
      <p className="m-0 home-v5-core-strategy-bar__line">
        {bar.segments.map((segment, idx) => (
          <span key={`${segment}-${idx}`} className="home-v5-core-strategy-bar__unit">
            {idx > 0 ? (
              <span className="home-v5-core-strategy-bar__sep" aria-hidden="true">
                {" "}
                ·{" "}
              </span>
            ) : null}
            <span className={idx === 0 ? "home-v5-core-strategy-bar__stage" : "home-v5-core-strategy-bar__item"}>
              {segment}
            </span>
          </span>
        ))}
      </p>
    </div>
  )
}
