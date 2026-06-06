import {
  YDS_BRAND_HERO_TITLE,
  YDS_CYCLE_TAGLINE,
  YDS_DUAL_CYCLE_DISCOVERY,
  YDS_HARVEST_TAGLINE,
} from "../../content/ydsCyclePhilosophy.js"

/**
 * 시장분석 최상단 — 브랜드·철학·Dual Cycle 발견
 */
export default function YdsBrandHero() {
  return (
    <section className="yds-brand-hero" aria-label="YDS 시장 사이클 투자 시스템">
      <h2 className="yds-brand-hero__title">{YDS_BRAND_HERO_TITLE}</h2>
      <p className="yds-brand-hero__motto">{YDS_CYCLE_TAGLINE}</p>
      <p className="yds-brand-hero__harvest">{YDS_HARVEST_TAGLINE}</p>
      <p className="yds-brand-hero__discovery">{YDS_DUAL_CYCLE_DISCOVERY}</p>
    </section>
  )
}
