import { Fragment } from "react"

/**
 * @param {string} label
 */
function compactStageLabel(label) {
  return String(label ?? "")
    .replace(/\s+/g, "")
    .trim()
}

/**
 * 시장분석 상단 미니 카드 — 큰 수치 + 가로 단계바
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
  const activeStep = stages.find((step) => step.active)

  return (
    <article
      className={[
        "yds-market-hero__score-card",
        "yds-market-hero__score-card--minimal",
        variant === "state" ? "yds-market-hero__score-card--state" : "yds-market-hero__score-card--panic",
        embedded ? "yds-market-hero__score-card--embedded" : "yds-market-hero__score-card--solo",
      ].join(" ")}
      aria-label={ariaLabel ?? `${title} ${score}, 현재 ${activeStep?.label ?? ""}`}
    >
      <p className="yds-market-hero__card-label">{title}</p>
      <p className="yds-market-hero__score font-mono tabular-nums">{score}</p>
      <ul className="yds-market-hero__stage-rail" aria-label={`${title} 단계`}>
        {stages.map((step, index) => (
          <Fragment key={step.id}>
            {index > 0 ? (
              <li className="yds-market-hero__stage-sep" aria-hidden>
                |
              </li>
            ) : null}
            <li
              className={[
                "yds-market-hero__stage-rail-item",
                step.active ? "yds-market-hero__stage-rail-item--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={step.active ? { "--stage-color": step.color } : undefined}
              aria-current={step.active ? "step" : undefined}
              title={step.label}
            >
              {compactStageLabel(step.label)}
            </li>
          </Fragment>
        ))}
      </ul>
    </article>
  )
}
