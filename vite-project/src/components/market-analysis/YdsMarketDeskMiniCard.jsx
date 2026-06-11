/**
 * 시장분석 상단 미니 카드 — 큰 수치 + 단계 레일만
 * @param {{
 *   title: string
 *   score: number
 *   stages: Array<{ id: string; emoji: string; label: string; color: string; active?: boolean }>
 *   variant?: "state" | "panic"
 *   embedded?: boolean
 *   ariaLabel?: string
 * }} props
 */
export default function YdsMarketDeskMiniCard({
  title,
  score,
  stages,
  variant = "state",
  embedded = false,
  ariaLabel,
}) {
  return (
    <article
      className={[
        "yds-market-hero__score-card",
        "yds-market-hero__score-card--minimal",
        variant === "state" ? "yds-market-hero__score-card--state" : "yds-market-hero__score-card--panic",
        embedded ? "yds-market-hero__score-card--embedded" : "yds-market-hero__score-card--solo",
      ].join(" ")}
      aria-label={ariaLabel ?? `${title} ${score}`}
    >
      <p className="yds-market-hero__card-label">{title}</p>
      <p className="yds-market-hero__score font-mono tabular-nums">{score}</p>
      <ul className="yds-market-hero__stage-rail" aria-label={`${title} 단계`}>
        {stages.map((step) => (
          <li
            key={step.id}
            className={[
              "yds-market-hero__stage-rail-item",
              step.active ? "yds-market-hero__stage-rail-item--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={step.active ? { "--stage-color": step.color } : undefined}
            aria-current={step.active ? "step" : undefined}
          >
            <span aria-hidden>{step.emoji}</span> {step.label}
          </li>
        ))}
      </ul>
    </article>
  )
}
