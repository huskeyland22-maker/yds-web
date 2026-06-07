import {
  YDS_PHILOSOPHY_DEFENSE_LINE,
  YDS_PHILOSOPHY_EXECUTION_LINE,
  YDS_PHILOSOPHY_HEADER_TITLE,
  YDS_PHILOSOPHY_LAYER_STEPS,
  YDS_PHILOSOPHY_LAYERS_TAG,
} from "../../content/ydsCyclePhilosophy.js"

/**
 * 시장분석 최상단 — YDS 철학 헤더 (Hero 바로 위)
 */
export default function YdsBrandHero() {
  return (
    <section className="yds-philosophy-header" aria-label="YDS 철학">
      <h2 className="yds-philosophy-header__title">{YDS_PHILOSOPHY_HEADER_TITLE}</h2>

      <div className="yds-philosophy-header__body">
        <p className="yds-philosophy-header__line yds-philosophy-header__line--primary">
          {YDS_PHILOSOPHY_EXECUTION_LINE}
        </p>
        <p className="yds-philosophy-header__line">{YDS_PHILOSOPHY_DEFENSE_LINE}</p>
      </div>

      <div className="yds-philosophy-header__layers" aria-label="3계층 시장 해석">
        <div className="yds-philosophy-header__layer-flow">
          {YDS_PHILOSOPHY_LAYER_STEPS.map((step, index) => (
            <span key={step.label} className="yds-philosophy-header__layer-step">
              {index > 0 ? (
                <span className="yds-philosophy-header__layer-arrow" aria-hidden>
                  →
                </span>
              ) : null}
              <span className="yds-philosophy-header__layer-label">{step.label}</span>
            </span>
          ))}
        </div>
        <p className="yds-philosophy-header__layer-tag">{YDS_PHILOSOPHY_LAYERS_TAG}</p>
      </div>
    </section>
  )
}
