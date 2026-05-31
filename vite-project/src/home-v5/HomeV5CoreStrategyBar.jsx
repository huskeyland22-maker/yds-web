/**
 * @param {{ bar: import("./homeV5DeskModel.js").HomeV5StrategyStatusBarModel }} props
 */
export default function HomeV5CoreStrategyBar({ bar }) {
  if (!bar?.segments?.length) return null

  const stage = bar.segments[0] ?? "—"
  const primaryHint =
    bar.segments.find((s) => /탐색|종목|우선/.test(String(s))) ??
    bar.segments[1] ??
    bar.segments[bar.segments.length - 1] ??
    "—"
  const restSegments = bar.segments.slice(1)

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
      <div className="home-v5-core-strategy-bar__mobile-hero">
        <span className="home-v5-core-strategy-bar__mobile-stage">{stage}</span>
        <span className="home-v5-core-strategy-bar__mobile-hint">{primaryHint}</span>
      </div>

      {restSegments.length > 0 ? (
        <details className="home-v5-core-strategy-bar__mobile-more">
          <summary className="home-v5-core-strategy-bar__mobile-more-summary">세부</summary>
          <p className="m-0 home-v5-core-strategy-bar__mobile-more-body">{bar.segments.join(" · ")}</p>
        </details>
      ) : null}

      <p className="m-0 home-v5-core-strategy-bar__line home-v5-core-strategy-bar__line--desktop">
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
