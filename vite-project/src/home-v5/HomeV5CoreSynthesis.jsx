/**
 * @param {{ synthesis: import("./homeV5CoreSynthesis.js").HomeV5CoreSynthesisModel }} props
 */
export default function HomeV5CoreSynthesis({ synthesis }) {
  if (!synthesis?.headline && !synthesis?.signalLine) return null

  return (
    <aside
      className={[
        "home-v5-core-synthesis",
        synthesis.tone ? `home-v5-core-synthesis--${synthesis.tone}` : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="종합 판단"
    >
      <p className="home-v5-core-synthesis__headline">
        <span className="home-v5-core-synthesis__pin" aria-hidden="true">
          📌
        </span>
        {synthesis.headline ?? "—"}
      </p>
      {synthesis.signalLine ? (
        <p className="home-v5-core-synthesis__signals">{synthesis.signalLine}</p>
      ) : null}
    </aside>
  )
}
