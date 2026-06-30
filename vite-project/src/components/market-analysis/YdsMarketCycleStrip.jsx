import { formatCycleStageLabel } from "../../content/ydsMarketStateCycleVisual.js"

/**
 * @param {{
 *   cycleStrip: import("../../content/ydsMarketStateCycleVisual.js").ReturnType<
 *     import("../../content/ydsMarketStateCycleVisual.js").buildMarketCycleStrip
 *   >
 *   title?: string
 *   className?: string
 *   compact?: boolean
 *   meta?: {
 *     entryDate?: string | null
 *     durationDays?: number | null
 *     previousLabel?: string | null
 *   } | null
 *   description?: {
 *     label?: string | null
 *     lines?: string[]
 *   } | null
 * }} props
 */
export default function YdsMarketCycleStrip({
  cycleStrip,
  title = "시장 사이클",
  className = "",
  compact = false,
  meta = null,
  description = null,
}) {
  const scoreSuffix =
    cycleStrip.marketScore != null ? ` (${cycleStrip.marketScore}점)` : ""

  return (
    <div
      className={[
        "yds-market-state-cycle-block",
        compact ? "yds-market-state-cycle-block--compact" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {title ? <p className="yds-market-state-cycle-block__title">{title}</p> : null}

      <div className="yds-market-state-cycle-strip" aria-label="시장 사이클">
        <div className="yds-market-state-cycle-strip__track">
          {cycleStrip.stages.map((stage, index) => {
            const isCurrent = stage.id === cycleStrip.currentId
            return (
              <div
                key={stage.id}
                className={[
                  "yds-market-state-cycle-strip__step",
                  isCurrent ? "yds-market-state-cycle-strip__step--current" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ "--cycle-color": stage.color }}
              >
                {index > 0 ? (
                  <span className="yds-market-state-cycle-strip__dash" aria-hidden>
                    ─
                  </span>
                ) : null}
                <span className="yds-market-state-cycle-strip__label">
                  {stage.emoji} {stage.label}
                </span>
                {isCurrent ? (
                  <span className="yds-market-state-cycle-strip__marker">
                    ▲ 현재{scoreSuffix}
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      {meta?.entryDate != null || meta?.durationDays != null || meta?.previousLabel ? (
        <dl className="yds-market-state-cycle-block__meta">
          {meta.entryDate ? (
            <div>
              <dt>진입일</dt>
              <dd className="font-mono tabular-nums">{meta.entryDate}</dd>
            </div>
          ) : null}
          {meta.durationDays != null ? (
            <div>
              <dt>유지기간</dt>
              <dd className="font-mono tabular-nums">{meta.durationDays}일</dd>
            </div>
          ) : null}
          {meta.previousLabel ? (
            <div className="yds-market-state-cycle-block__meta-prev">
              <dt>이전 단계</dt>
              <dd>{formatCycleStageLabel(meta.previousLabel)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {description?.label || description?.lines?.length ? (
        <div className="yds-market-state-cycle-block__desc">
          {description.label ? (
            <p className="yds-market-state-cycle-block__desc-label">
              {formatCycleStageLabel(description.label)}
            </p>
          ) : null}
          {description.lines?.map((line) => (
            <p key={line} className="yds-market-state-cycle-block__desc-line">
              {line}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}
