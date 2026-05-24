import { Fragment, useMemo } from "react"
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
  buildStageHistoryTooltipLines,
  formatStageHistoryLog,
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
        <div className="tactical-zone-detail__trade-zone">
          <div className="tactical-zone-trade-line-container">
            <div
              className="tactical-zone-trade-line font-mono tabular-nums"
              style={{
                "--progress-pct": `${progress.progressPct}%`,
                "--profit-pct": `${100 - progress.progressPct}%`,
              }}
            >
              <div className="tactical-zone-trade-line__markers">
                <div className="tactical-zone-trade-line__marker tactical-zone-trade-line__marker--stop">
                  <span className="tactical-zone-trade-line__marker-label">손절</span>
                  <span className="tactical-zone-trade-line__marker-val">{progress.formatted.stop}</span>
                </div>
                <div
                  className="tactical-zone-trade-line__marker tactical-zone-trade-line__marker--current"
                  style={{ left: `${progress.progressPct}%` }}
                >
                  <span className="tactical-zone-trade-line__marker-label">현재</span>
                  <span className="tactical-zone-trade-line__marker-val">{progress.formatted.current}</span>
                </div>
                <div className="tactical-zone-trade-line__marker tactical-zone-trade-line__marker--target">
                  <span className="tactical-zone-trade-line__marker-label">목표</span>
                  <span className="tactical-zone-trade-line__marker-val">{progress.formatted.target}</span>
                </div>
              </div>

              <div className="tactical-zone-trade-line__track">
                <div className="tactical-zone-trade-zone-overlay" aria-hidden>
                  <span className="tactical-zone-trade-zone-overlay__danger" />
                  <span className="tactical-zone-trade-zone-overlay__profit" />
                </div>
                <span className="tactical-zone-trade-line__rail" />
                <span className="tactical-zone-trade-line__fill" />
                <span className="tactical-zone-trade-line__dot tactical-zone-trade-line__dot--stop" />
                <span className="tactical-zone-trade-line__dot tactical-zone-trade-line__dot--current" />
                <span className="tactical-zone-trade-line__dot tactical-zone-trade-line__dot--target" />
              </div>
              <div className="tactical-zone-trade-line__zone-legend" aria-hidden>
                <span className="tactical-zone-trade-line__zone-legend-item">🔴 위험존</span>
                <span className="tactical-zone-trade-line__zone-legend-item">🟡 매수존</span>
                <span className="tactical-zone-trade-line__zone-legend-item">🟢 수익존</span>
              </div>
            </div>
          </div>

          <div className="tactical-zone-detail__trade-info-block">
            <p className="m-0 tactical-zone-detail__achieve">
              <span className="tactical-zone-detail__achieve-val">{progress.progressPct}%</span>
              <span className="tactical-zone-detail__achieve-label">목표달성</span>
            </p>
            <div className="tactical-zone-trade-info-row" role="group" aria-label="핵심 매매정보">
              {TRADING_CORE_METRIC_FIELDS.map(({ key, label, tooltip, empty, tone }) => {
                const value = coreMetrics[key]
                const pending = isCoreMetricPlaceholder(value, empty)
                return (
                  <div key={key} className="tactical-zone-info-item" title={tooltip}>
                    <span className="tactical-zone-info-item__label">{label}</span>
                    <span
                      className={[
                        "tactical-zone-info-item__value font-mono tabular-nums",
                        pending ? "tactical-zone-info-item__value--placeholder" : "",
                        !pending ? `tactical-zone-info-item__value--${tone}` : "",
                      ].join(" ")}
                    >
                      {value}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}

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
          <div className="tactical-zone-detail__status-history">
            <p className="m-0 tactical-zone-detail__section-label">상태 이력</p>
            <div className="tactical-zone-status-history" aria-label="상태 이력 타임라인">
              {historyLog.map((h, i) => {
                const isActive = i === historyHighlightIndex
                const tip = buildStageHistoryTooltipLines(h)
                return (
                  <Fragment key={`${h.stage}-${h.dateLabel}-${i}`}>
                    {i > 0 ? <span className="tactical-zone-timeline-line" aria-hidden /> : null}
                    <div
                      className={[
                        "tactical-zone-timeline-step",
                        isActive ? "tactical-zone-timeline-step--active" : "",
                      ].join(" ")}
                      data-stage={h.stage}
                      tabIndex={0}
                    >
                      <span className="tactical-zone-timeline-dot" aria-hidden />
                      <span className="tactical-zone-timeline-step__label">{h.label}</span>
                      <span className="tactical-zone-timeline-step__date">
                        {h.dateLabel || "—"}
                      </span>
                      <div className="tactical-zone-timeline-step__tooltip" role="tooltip">
                        <span>가격 {tip.price}</span>
                        <span>점수 {tip.score}</span>
                        <span>상태 {tip.state}</span>
                      </div>
                    </div>
                  </Fragment>
                )
              })}
            </div>
          </div>
        ) : null}
      </footer>
    </div>
  )
}
