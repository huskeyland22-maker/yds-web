import { YDS_CYCLE_TAGLINE, YDS_STAGE_RAIL_LABELS } from "../content/ydsCyclePhilosophy.js"

export default function YdsPhilosophyCard() {
  return (
    <section className="yds-philosophy-card trading-card-shell panic-v2-section" aria-label="YDS 철학">
      <p className="m-0 yds-philosophy-card__title">YDS 철학</p>
      <p className="m-0 yds-philosophy-card__stages">{YDS_STAGE_RAIL_LABELS}</p>
      <p className="m-0 yds-philosophy-card__quote">{YDS_CYCLE_TAGLINE}</p>
    </section>
  )
}
