import {
  YDS_BRAND_HERO_TITLE,
  YDS_CYCLE_TAGLINE,
  YDS_STAGE_FLOW_RAIL,
  YDS_STAGE_PHILOSOPHY,
} from "../../content/ydsCyclePhilosophy.js"

/**
 * 시장분석 최상단 — YDS 브랜드·사이클 철학 Hero
 */
export default function YdsBrandHero() {
  return (
    <section className="yds-brand-hero" aria-label="YDS 시장 사이클 투자 시스템">
      <p className="yds-brand-hero__eyebrow">Market Cycle System</p>
      <h2 className="yds-brand-hero__title">{YDS_BRAND_HERO_TITLE}</h2>
      <p className="yds-brand-hero__motto">{YDS_CYCLE_TAGLINE}</p>
      <div className="yds-brand-hero__flow" aria-label="5단계 사이클">
        {YDS_STAGE_FLOW_RAIL.map((step) => {
          const meta = YDS_STAGE_PHILOSOPHY[step.id]
          return (
            <div key={step.id} className="yds-brand-hero__flow-step" data-stage={step.id}>
              <span className="yds-brand-hero__flow-emoji" aria-hidden>
                {step.emoji}
              </span>
              <span className="yds-brand-hero__flow-name">{step.short}</span>
              <span className="yds-brand-hero__flow-role">{meta.flowLabel}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
