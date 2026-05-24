import {
  TRADING_STAGE_FLOW,
  TRADING_STAGE_META,
  tradingStageBadge,
} from "../../trading-zone/tacticalTradingZoneData.js"
import {
  computeTradingZoneProgress,
  resolvePositionPriceLevels,
} from "../../trading-zone/tradingZonePriceProgress.js"
import { formatStageHistoryLog } from "../../trading-zone/tradingZoneStageHistory.js"

/**
 * @param {{ position: import("../../trading-zone/tacticalTradingZoneData.js").TradingZonePosition }} props
 */
export default function TacticalStockDetailPanel({ position }) {
  const badge = tradingStageBadge(position)
  const historyLog = formatStageHistoryLog(position.stageHistory ?? [])
  const levels = resolvePositionPriceLevels(position)
  const progress = computeTradingZoneProgress(levels)

  const displayStop = progress?.formatted.stop ?? position.stop ?? "—"
  const displayTarget = progress?.formatted.target ?? position.target ?? "—"
  const displayEntry = position.entry?.trim() ? position.entry.replace(/\s*~\s*/g, "~") : "—"

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
          <dt>진입</dt>
          <dd>
            <span className="tactical-zone-price-pill font-mono tabular-nums">{displayEntry}</span>
          </dd>
        </div>
        <div className="tactical-zone-detail__grid-cell tactical-zone-detail__grid-cell--stop">
          <dt>손절</dt>
          <dd>
            <span className="tactical-zone-price-pill font-mono tabular-nums">{displayStop}</span>
          </dd>
        </div>
        <div className="tactical-zone-detail__grid-cell tactical-zone-detail__grid-cell--target">
          <dt>목표</dt>
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
          <div className="tactical-zone-progress__achieve">
            <p className="m-0 tactical-zone-progress__achieve-label">목표달성</p>
            <p className="m-0 tactical-zone-progress__achieve-pct font-mono tabular-nums">
              {progress.progressPct}%
            </p>
          </div>

          <div className="tactical-zone-progress__chart font-mono tabular-nums">
            <div className="tactical-zone-progress__ends">
              <span className="tactical-zone-progress__end tactical-zone-progress__end--stop">
                손절<span className="tactical-zone-progress__end-num">{progress.formatted.stop}</span>
              </span>
              <span className="tactical-zone-progress__end tactical-zone-progress__end--target">
                목표<span className="tactical-zone-progress__end-num">{progress.formatted.target}</span>
              </span>
            </div>

            <div className="tactical-zone-progress__track-wrap">
              <div className="tactical-zone-progress__current-tag" aria-hidden>
                <span className="tactical-zone-progress__current-dot">●</span>
                <span className="tactical-zone-progress__current-label">
                  현재 {progress.formatted.current}
                </span>
              </div>
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

      {position.aux?.length ? (
        <div className="tactical-zone-detail__aux">
          <p className="m-0 tactical-zone-detail__section-label">보조지표</p>
          <div className="tactical-zone-detail__aux-tags">
            {position.aux.map((tag) => (
              <span key={tag} className="tactical-zone-aux-tag">
                {tag}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {historyLog.length ? (
        <div className="tactical-zone-detail__history">
          <p className="m-0 tactical-zone-detail__section-label">상태 이력</p>
          <ul className="tactical-zone-history-cards m-0 list-none p-0">
            {historyLog.map((h, i) => (
              <li
                key={`${h.stage}-${h.dateLabel}-${i}`}
                className="tactical-zone-history-card"
                data-stage={h.stage}
              >
                {h.dateLabel ? (
                  <span className="tactical-zone-history-card__date font-mono">[{h.dateLabel}]</span>
                ) : null}
                <span className="tactical-zone-history-card__message">{h.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
