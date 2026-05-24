import { useMemo } from "react"
import {
  TRADING_STAGE_FLOW,
  TRADING_STAGE_META,
  TRADING_ZONE_STANDARD_AUX,
  tradingStageBadge,
} from "../../trading-zone/tacticalTradingZoneData.js"
import {
  buildTradingCoreMetrics,
  isCoreMetricPlaceholder,
  TRADING_CORE_METRIC_FIELDS,
} from "../../trading-zone/tradingZoneCoreMetrics.js"
import {
  computeTradingZoneProgress,
  resolvePositionPriceLevels,
} from "../../trading-zone/tradingZonePriceProgress.js"
import {
  formatStageHistoryLog,
  formatStageHistoryTimelineDisplay,
} from "../../trading-zone/tradingZoneStageHistory.js"
/**
 * @param {{ position: import("../../trading-zone/tacticalTradingZoneData.js").TradingZonePosition }} props
 */
export default function TacticalStockDetailPanel({ position }) {
  const badge = tradingStageBadge(position)
  const historyLog = formatStageHistoryLog(position.stageHistory ?? [])
  const levels = resolvePositionPriceLevels(position)
  const progress = computeTradingZoneProgress(levels)
  const coreMetrics = useMemo(() => buildTradingCoreMetrics(position), [position])
  const activeAux = new Set(position.aux ?? [])

  const currentStageId =
    position.stage === "interest" ||
    position.stage === "pullback" ||
    position.stage === "trend" ||
    position.stage === "takeProfit"
      ? position.stage
      : null

  let historyHighlightIndex = -1
  if (historyLog.length && currentStageId) {
    for (let i = historyLog.length - 1; i >= 0; i -= 1) {
      if (historyLog[i].stage === currentStageId) {
        historyHighlightIndex = i
        break
      }
    }
  }

  return (
    <div
      className="tactical-zone-detail tactical-zone-detail--flow"
      role="region"
      aria-label={`${position.symbol} 상세`}
      data-stage={position.stage}
    >
      <header className="tactical-zone-detail__head">
        <p className="m-0 tactical-zone-detail__name">{position.symbol}</p>
        <p className="m-0 tactical-zone-detail__current-line tactical-zone-detail__current-stage">
          <span className="tactical-zone-detail__current-label">현재단계</span>
          <span className="tactical-zone-detail__current-sep" aria-hidden>
            :
          </span>
          <span className="tactical-zone-detail__current-value">
            <span aria-hidden>{badge.emoji}</span> {badge.label}
          </span>
        </p>
      </header>

      <div className="tactical-zone-detail__stage-center">
        <div
          className="tactical-zone-stage-flow tactical-zone-stage-flow--compact tactical-zone-detail__status-flow"
          aria-label="단계 진행"
        >
          {TRADING_STAGE_FLOW.map((stageId, i) => {
            const meta = TRADING_STAGE_META[stageId]
            const isActive = position.stage === stageId
            const isInactive = !isActive
            return (
              <span key={stageId} className="tactical-zone-stage-flow__segment">
                {i > 0 ? (
                  <span className="tactical-zone-stage-flow__sep" aria-hidden>
                    ─
                  </span>
                ) : null}
                <span
                  className={[
                    "tactical-zone-stage-flow__chip",
                    isActive ? "tactical-zone-stage-flow__chip--active" : "",
                    isInactive ? "tactical-zone-stage-flow__chip--inactive" : "",
                  ].join(" ")}
                  data-stage={stageId}
                >
                  <span aria-hidden>{meta.emoji}</span> {meta.label}
                </span>
              </span>
            )
          })}
        </div>
      </div>

      {progress ? (
        <div className="tactical-zone-detail__price">
          <div
            className="tactical-zone-price-rail font-mono tabular-nums"
            style={{ "--progress-pct": `${progress.progressPct}%` }}
            data-overlap={
              progress.progressPct < 24 ? "stop" : progress.progressPct > 76 ? "target" : undefined
            }
          >
            <div className="tactical-zone-price-rail__body">
              <div className="tactical-zone-price-rail__markers">
                <div
                  className="tactical-zone-price-rail__marker tactical-zone-price-rail__marker--stop"
                  style={{ left: "0%" }}
                >
                  <span className="tactical-zone-price-rail__marker-label">손절</span>
                  <span className="tactical-zone-price-rail__marker-val">{progress.formatted.stop}</span>
                </div>
                <div
                  className="tactical-zone-price-rail__marker tactical-zone-price-rail__marker--current"
                  style={{ left: `${progress.progressPct}%` }}
                >
                  <span className="tactical-zone-price-rail__marker-label">현재</span>
                  <span className="tactical-zone-price-rail__marker-val">{progress.formatted.current}</span>
                </div>
                <div
                  className="tactical-zone-price-rail__marker tactical-zone-price-rail__marker--target"
                  style={{ left: "100%" }}
                >
                  <span className="tactical-zone-price-rail__marker-label">목표</span>
                  <span className="tactical-zone-price-rail__marker-val">{progress.formatted.target}</span>
                </div>
              </div>

              <div className="tactical-zone-progress__track-wrap">
                <div className="tactical-zone-progress__track">
                  <span className="tactical-zone-progress__rail" />
                  <span className="tactical-zone-progress__fill" />
                  <span className="tactical-zone-progress__dot tactical-zone-progress__dot--stop" />
                  <span className="tactical-zone-progress__dot tactical-zone-progress__dot--current" />
                  <span className="tactical-zone-progress__dot tactical-zone-progress__dot--target" />
                </div>
                <p className="m-0 tactical-zone-price-rail__achieve tactical-zone-price-rail__achieve--center">
                  <span className="tactical-zone-price-rail__achieve-val">{progress.progressPct}%</span>
                  <span className="tactical-zone-price-rail__achieve-label">목표달성</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <section className="tactical-zone-detail__core" aria-label="핵심 매매정보">
        <p className="m-0 tactical-zone-detail__section-label">핵심 매매정보</p>
        <dl className="tactical-zone-core-grid m-0">
          {TRADING_CORE_METRIC_FIELDS.map(({ key, label, tooltip, empty, tone }) => {
            const value = coreMetrics[key]
            const pending = isCoreMetricPlaceholder(value, empty)
            return (
              <div key={key} className="tactical-zone-core-cell">
                <dt className="tactical-zone-core-cell__label" title={tooltip}>
                  {label}
                </dt>
                <dd
                  className={[
                    "tactical-zone-core-cell__value font-mono tabular-nums",
                    pending ? "tactical-zone-core-cell__value--placeholder" : "",
                    !pending ? `tactical-zone-core-cell__value--${tone}` : "",
                  ].join(" ")}
                >
                  {value}
                </dd>
              </div>
            )
          })}
        </dl>
      </section>

      <footer className="tactical-zone-detail__foot">
        <div className="tactical-zone-detail__aux">
          <p className="m-0 tactical-zone-detail__section-label">보조지표</p>
          <div className="tactical-zone-detail__aux-tags">
            {TRADING_ZONE_STANDARD_AUX.map((tag) => (
              <span
                key={tag}
                className={[
                  "tactical-zone-aux-tag",
                  activeAux.has(tag) ? "tactical-zone-aux-tag--on" : "tactical-zone-aux-tag--off",
                ].join(" ")}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {historyLog.length ? (
          <div className="tactical-zone-detail__history">
            <p className="m-0 tactical-zone-detail__section-label">상태 이력</p>
            <div className="tactical-zone-history-timeline" aria-label="상태 이력">
              {historyLog.map((h, i) => (
                <span key={`${h.stage}-${h.dateLabel}-${i}`} className="tactical-zone-history-timeline__segment">
                  {i > 0 ? (
                    <span className="tactical-zone-history-timeline__arrow" aria-hidden>
                      →
                    </span>
                  ) : null}
                  <span
                    className={[
                      "tactical-zone-history-badge",
                      i === historyHighlightIndex
                        ? "tactical-zone-history-badge--current"
                        : "tactical-zone-history-badge--past",
                    ].join(" ")}
                    data-stage={h.stage}
                  >
                    {formatStageHistoryTimelineDisplay(h)}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </footer>
    </div>
  )
}
