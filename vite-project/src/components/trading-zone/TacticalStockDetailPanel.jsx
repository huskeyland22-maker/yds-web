import {
  TRADING_STAGE_FLOW,
  TRADING_STAGE_META,
  TRADING_ZONE_STANDARD_AUX,
} from "../../trading-zone/tacticalTradingZoneData.js"
import {
  computeTradingZoneProgress,
  resolvePositionPriceLevels,
} from "../../trading-zone/tradingZonePriceProgress.js"
import {
  formatStageHistoryChipLabel,
  formatStageHistoryLog,
} from "../../trading-zone/tradingZoneStageHistory.js"

/**
 * @param {{ position: import("../../trading-zone/tacticalTradingZoneData.js").TradingZonePosition }} props
 */
export default function TacticalStockDetailPanel({ position }) {
  const historyLog = formatStageHistoryLog(position.stageHistory ?? [])
  const levels = resolvePositionPriceLevels(position)
  const progress = computeTradingZoneProgress(levels)
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

  const fieldDisplay = (raw, suffix = "") => {
    if (raw == null) return "-"
    if (typeof raw === "number" && Number.isFinite(raw)) return `${raw}${suffix}`
    const s = String(raw).trim()
    if (!s || s === "—") return "-"
    return `${s}${suffix}`
  }

  return (
    <div className="tactical-zone-detail" role="region" aria-label={`${position.symbol} 상세`}>
      <p className="m-0 tactical-zone-detail__name">{position.symbol}</p>

      <div className="tactical-zone-stage-flow tactical-zone-stage-flow--bar" aria-label="단계 흐름">
        {TRADING_STAGE_FLOW.map((stageId, i) => {
          const meta = TRADING_STAGE_META[stageId]
          const active = stageId === position.stage
          return (
            <span key={stageId} className="tactical-zone-stage-flow__item">
              {i > 0 ? (
                <span className="tactical-zone-stage-flow__arrow" aria-hidden>
                  →
                </span>
              ) : null}
              <span
                className={[
                  "tactical-zone-stage-flow__chip",
                  active ? "tactical-zone-stage-flow__chip--active" : "tactical-zone-stage-flow__chip--muted",
                ].join(" ")}
                data-stage={stageId}
              >
                {meta.emoji}
                {meta.label}
              </span>
            </span>
          )
        })}
      </div>

      {progress ? (
        <div
          className="tactical-zone-progress"
          style={{ "--progress-pct": `${progress.progressPct}%` }}
        >
          <div className="tactical-zone-progress__chart font-mono tabular-nums">
            <div className="tactical-zone-progress__ruler">
              <span className="tactical-zone-progress__ruler-stop">{progress.formatted.stop}</span>
              <span className="tactical-zone-progress__ruler-sep" aria-hidden>
                ──
              </span>
              <div className="tactical-zone-progress__ruler-center">
                <span className="tactical-zone-progress__ruler-current">
                  ●{progress.formatted.current}
                </span>
                <span className="tactical-zone-progress__ruler-tag">현재</span>
              </div>
              <span className="tactical-zone-progress__ruler-sep" aria-hidden>
                ──
              </span>
              <span className="tactical-zone-progress__ruler-target">{progress.formatted.target}</span>
            </div>

            <div className="tactical-zone-progress__track-wrap">
              <div className="tactical-zone-progress__track">
                <span className="tactical-zone-progress__rail" />
                <span className="tactical-zone-progress__fill" />
                <span className="tactical-zone-progress__dot tactical-zone-progress__dot--stop" />
                <span className="tactical-zone-progress__dot tactical-zone-progress__dot--current" />
                <span className="tactical-zone-progress__dot tactical-zone-progress__dot--target" />
              </div>
            </div>

            <p className="m-0 tactical-zone-progress__achieve-row">
              <span className="tactical-zone-progress__achieve-label">목표달성</span>
              <span className="tactical-zone-progress__achieve-pct">{progress.progressPct}%</span>
            </p>
          </div>
        </div>
      ) : null}

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

      <div className="tactical-zone-fields-grid" aria-label="실전 필드">
        <div className="tactical-zone-field-card">
          <p className="m-0 tactical-zone-field-card__label">RR</p>
          <p className="m-0 tactical-zone-field-card__value font-mono tabular-nums">{fieldDisplay(position.rr)}</p>
        </div>
        <div className="tactical-zone-field-card">
          <p className="m-0 tactical-zone-field-card__label">기대수익</p>
          <p className="m-0 tactical-zone-field-card__value font-mono tabular-nums">
            {fieldDisplay(position.expectedReturn)}
          </p>
        </div>
        <div className="tactical-zone-field-card">
          <p className="m-0 tactical-zone-field-card__label">보유일</p>
          <p className="m-0 tactical-zone-field-card__value font-mono tabular-nums">
            {position.holdingDays != null && Number.isFinite(position.holdingDays)
              ? `${position.holdingDays}일`
              : "-"}
          </p>
        </div>
        <div className="tactical-zone-field-card">
          <p className="m-0 tactical-zone-field-card__label">비중</p>
          <p className="m-0 tactical-zone-field-card__value font-mono tabular-nums">{fieldDisplay(position.weight)}</p>
        </div>
      </div>

      {historyLog.length ? (
        <div className="tactical-zone-detail__history">
          <p className="m-0 tactical-zone-detail__section-label">상태 이력</p>
          <div className="tactical-zone-history-chips" aria-label="상태 이력 타임라인">
            {historyLog.map((h, i) => (
              <span key={`${h.stage}-${h.dateLabel}-${i}`} className="tactical-zone-history-chips__item">
                {i > 0 ? (
                  <span className="tactical-zone-history-chips__arrow" aria-hidden>
                    →
                  </span>
                ) : null}
                <span
                  className={[
                    "tactical-zone-history-chip",
                    i === historyHighlightIndex
                      ? "tactical-zone-history-chip--current"
                      : "tactical-zone-history-chip--past",
                  ].join(" ")}
                  data-stage={h.stage}
                >
                  {formatStageHistoryChipLabel(h)}
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
