import {
  TRADING_STAGE_FLOW,
  TRADING_STAGE_META,
  TRADING_ZONE_STANDARD_AUX,
  tradingStageBadge,
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
  const badge = tradingStageBadge(position)
  const historyLog = formatStageHistoryLog(position.stageHistory ?? [])
  const levels = resolvePositionPriceLevels(position)
  const progress = computeTradingZoneProgress(levels)
  const activeAux = new Set(position.aux ?? [])

  const displayStop = progress?.formatted.stop ?? position.stop ?? "—"
  const displayTarget = progress?.formatted.target ?? position.target ?? "—"
  const displayEntry = position.entry?.trim() ? position.entry.replace(/\s*~\s*/g, "~") : "—"

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
  if (historyHighlightIndex < 0 && historyLog.length) {
    historyHighlightIndex = historyLog.length - 1
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

      <div className="tactical-zone-detail__flow">
        <div className="tactical-zone-stage-flow" aria-label="단계 흐름">
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
                  {meta.emoji} {meta.label}
                </span>
              </span>
            )
          })}
        </div>
        <p className="m-0 tactical-zone-detail__current">
          현재: {badge.emoji} {badge.label}
        </p>
      </div>

      <dl className="tactical-zone-detail__grid m-0">
        <div className="tactical-zone-detail__grid-cell tactical-zone-detail__grid-cell--entry">
          <dt>
            <span aria-hidden>🎯</span> 진입
          </dt>
          <dd>
            <span className="tactical-zone-price-pill font-mono tabular-nums">{displayEntry}</span>
          </dd>
        </div>
        <div className="tactical-zone-detail__grid-cell tactical-zone-detail__grid-cell--stop">
          <dt>
            <span aria-hidden>🛑</span> 손절
          </dt>
          <dd>
            <span className="tactical-zone-price-pill font-mono tabular-nums">{displayStop}</span>
          </dd>
        </div>
        <div className="tactical-zone-detail__grid-cell tactical-zone-detail__grid-cell--target">
          <dt>
            <span aria-hidden>🚀</span> 목표
          </dt>
          <dd>
            <span className="tactical-zone-price-pill font-mono tabular-nums">{displayTarget}</span>
          </dd>
        </div>
      </dl>

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
                <span className="tactical-zone-progress__ruler-pct">{progress.progressPct}%</span>
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

      <div className="tactical-zone-fields-compact" aria-label="실전 필드">
        <p className="m-0 tactical-zone-fields-compact__row font-mono tabular-nums">
          <span>RR {fieldDisplay(position.rr)}</span>
          <span className="tactical-zone-fields-compact__sep" aria-hidden>
            |
          </span>
          <span>기대수익 {fieldDisplay(position.expectedReturn)}</span>
        </p>
        <p className="m-0 tactical-zone-fields-compact__row font-mono tabular-nums">
          <span>
            보유일{" "}
            {position.holdingDays != null && Number.isFinite(position.holdingDays)
              ? `${position.holdingDays}일`
              : "-"}
          </span>
          <span className="tactical-zone-fields-compact__sep" aria-hidden>
            |
          </span>
          <span>비중 {fieldDisplay(position.weight)}</span>
        </p>
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
                    i === historyHighlightIndex ? "tactical-zone-history-chip--current" : "",
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
