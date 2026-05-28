import { Fragment, useEffect, useMemo, useState } from "react"
import {
  TRADING_STAGE_FLOW,
  TRADING_STAGE_META,
  tradingStageBadge,
} from "../../trading-zone/tacticalTradingZoneData.js"
import TacticalZoneAuxPanel from "./TacticalZoneAuxPanel.jsx"
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
  const stageLabelById = {
    interest: "관심구간",
    pullback: "눌림구간",
    trend: "추세구간",
    takeProfit: "익절구간",
    risk: "리스크구간",
  }
  const historyLog = formatStageHistoryLog(position.stageHistory ?? [])
  const levels = resolvePositionPriceLevels(position)
  const progress = computeTradingZoneProgress(levels)
  const coreMetrics = useMemo(() => buildTradingCoreMetrics(position), [position])
  const activeAux = new Set(position.aux ?? [])
  const [expandedAux, setExpandedAux] = useState(/** @type {string | null} */ (null))
  const stageDescriptionById = {
    interest: "관심 종목 관찰 및 시그널 대기 구간",
    pullback: "단기 조정 후 재진입 가능 구간",
    trend: "추세 가속 구간, 분할 추가 대응 가능",
    takeProfit: "목표 근접, 분할 익절 중심 관리 구간",
    risk: "손절/비중 축소 우선 대응 구간",
  }
  const strategicLabelByKey = {
    expectedReturn: "단기 전략",
    upside: "중기 전략",
    stopRisk: "장기 전략",
    weight: "실행 신호",
  }

  useEffect(() => {
    setExpandedAux(null)
  }, [position.id])

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
            <span aria-hidden>{badge.emoji}</span> {stageLabelById[position.stage] ?? badge.label}
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
          <div
            className="trade-progress-group font-mono tabular-nums"
            style={{
              "--progress-pct": `${progress.progressPct}%`,
              "--profit-pct": `${100 - progress.progressPct}%`,
            }}
          >
            <p className="m-0 tactical-zone-detail__main-status">
              현재 위치:{" "}
              <span className="tactical-zone-detail__main-status-value">
                <span aria-hidden>{badge.emoji}</span> {stageLabelById[position.stage] ?? badge.label}
              </span>
            </p>
            <div className="price-label-row">
              <span className="price-marker-label marker-stop">손절{progress.formatted.stop}</span>
              <span
                className="price-marker-label marker-current"
                style={{ left: `${progress.progressPct}%` }}
              >
                ● 현재 {progress.formatted.current}
              </span>
              <span className="price-marker-label marker-target">목표{progress.formatted.target}</span>
            </div>

            <div className="tactical-zone-trade-line-container">
              <div className="tactical-zone-trade-line">
                <div className="tactical-zone-trade-line__track">
                  <div className="tactical-zone-trade-line__markers">
                    <div className="tactical-zone-trade-line__marker-anchor tactical-zone-trade-line__marker-anchor--stop">
                      <span
                        className="marker-dot tactical-zone-trade-line__dot tactical-zone-trade-line__dot--stop"
                        aria-hidden
                      />
                    </div>
                    <div
                      className="tactical-zone-trade-line__marker-anchor tactical-zone-trade-line__marker-anchor--current"
                      style={{ left: `${progress.progressPct}%` }}
                    >
                      <span
                        className="marker-dot tactical-zone-trade-line__dot tactical-zone-trade-line__dot--current"
                        aria-hidden
                      />
                    </div>
                    <div className="tactical-zone-trade-line__marker-anchor tactical-zone-trade-line__marker-anchor--target">
                      <span
                        className="marker-dot tactical-zone-trade-line__dot tactical-zone-trade-line__dot--target"
                        aria-hidden
                      />
                    </div>
                  </div>
                  <div className="tactical-zone-trade-zone-overlay" aria-hidden>
                    <span className="tactical-zone-trade-zone-overlay__danger" />
                    <span className="tactical-zone-trade-zone-overlay__profit" />
                  </div>
                  <span className="progress-line tactical-zone-trade-line__rail" />
                  <span className="progress-line tactical-zone-trade-line__fill" />
                </div>
              </div>
            </div>

            <div className="progress-achievement m-0 tactical-zone-detail__achieve">
              <div
                className="tactical-zone-detail__achieve-ring"
                style={{ "--ring-progress": `${progress.progressPct}%` }}
                aria-hidden
              >
                <span className="tactical-zone-detail__achieve-ring-core" />
                <span className="tactical-zone-detail__achieve-val">{progress.progressPct}%</span>
              </div>
              <span className="tactical-zone-detail__achieve-label">목표도달률</span>
            </div>
            <p className="m-0 tactical-zone-detail__status-description">
              {stageDescriptionById[position.stage] ?? "시장 흐름에 맞춘 단계 대응 구간"}
            </p>
          </div>

          <div className="tactical-zone-detail__trade-info-block">
            <div className="tactical-zone-trade-info-row" role="group" aria-label="핵심 매매정보">
              {TRADING_CORE_METRIC_FIELDS.map(({ key, label, tooltip, empty, tone }) => {
                const value = coreMetrics[key]
                const pending = isCoreMetricPlaceholder(value, empty)
                return (
                  <div key={key} className="tactical-zone-info-item" title={tooltip}>
                    <span className="tactical-zone-info-item__label">
                      {strategicLabelByKey[key] ?? label}
                    </span>
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
          <TacticalZoneAuxPanel
            position={position}
            activeAux={activeAux}
            expandedAux={expandedAux}
            onToggle={(tag) => setExpandedAux(expandedAux === tag ? null : tag)}
          />
        </div>

        {historyLog.length ? (
          <div className="tactical-zone-detail__status-history">
            <p className="m-0 tactical-zone-detail__section-label">상태 이력</p>
            <div className="tactical-zone-status-history" aria-label="상태 이력 타임라인">
              {historyLog.map((h, i) => {
                const isActive = i === historyHighlightIndex
                const tip = buildStageHistoryTooltipLines(h)
                const emoji = TRADING_STAGE_META[h.stage]?.emoji ?? "⚪"
                return (
                  <Fragment key={`${h.stage}-${h.dateLabel}-${i}`}>
                    {i > 0 ? (
                      <span className="tactical-zone-timeline-connector" aria-hidden>
                        →
                      </span>
                    ) : null}
                    <div
                      className={[
                        "tactical-zone-timeline-node",
                        isActive ? "tactical-zone-timeline-node--active" : "",
                      ].join(" ")}
                      data-stage={h.stage}
                      tabIndex={0}
                    >
                      <span className="tactical-zone-timeline-node__emoji" aria-hidden>
                        {emoji}
                      </span>
                      <span className="tactical-zone-timeline-node__date font-mono tabular-nums">
                        {h.dateLabel || "—"}
                      </span>
                      <span className="sr-only">{h.label}</span>
                      <div className="tactical-zone-timeline-node__tooltip" role="tooltip">
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
