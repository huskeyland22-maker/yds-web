/**
 * AI 상세분석 — 통일 카드 래퍼
 * @param {{ title: string; children: import("react").ReactNode; className?: string; tone?: 'default' | 'info' | 'rec' | 'risk' }} props
 */
export default function YdsStockPickAiDetailCard({
  title,
  children,
  className = "",
  tone = "default",
}) {
  return (
    <section
      className={[
        "yds-ai-detail-card",
        tone !== "default" ? `yds-ai-detail-card--${tone}` : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <h2 className="yds-ai-detail-card__title">{title}</h2>
      <div className="yds-ai-detail-card__body">{children}</div>
    </section>
  )
}

/**
 * @param {{ items: { label: string; value: string; tone?: string; emphasize?: boolean }[] }} props
 */
export function AiDetailMetricGrid({ items }) {
  return (
    <dl className="yds-ai-detail-card__metrics">
      {items.map((item) => (
        <div key={item.label} className="yds-ai-detail-card__metric-row">
          <dt>{item.label}</dt>
          <dd
            className={[
              "font-mono tabular-nums",
              item.emphasize ? "yds-ai-detail-card__value--bold" : "",
              item.tone ? `yds-ai-detail-card__tone--${item.tone}` : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
