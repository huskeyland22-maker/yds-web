/**
 * @param {{ synthesis: import("./homeV5CoreSynthesis.js").HomeV5CoreSynthesisModel }} props
 */
export default function HomeV5CoreSynthesis({ synthesis }) {
  if (!synthesis?.signalLine) return null

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
      <p className="home-v5-core-synthesis__head">종합 판단</p>
      <p className="home-v5-core-synthesis__signals">{synthesis.signalLine}</p>
      <p className="home-v5-core-synthesis__verdict">{synthesis.verdictLine}</p>
    </aside>
  )
}
