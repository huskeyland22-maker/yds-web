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
  const currentIdx = TRADING_STAGE_FLOW.indexOf(position.stage)
  const badge = tradingStageBadge(position)
  const historyLog = formatStageHistoryLog(position.stageHistory ?? [])
  const levels = resolvePositionPriceLevels(position)
  const progress = computeTradingZoneProgress(levels)

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
        <p className="m-0 mt-1 text-[10px] font-semibold text-slate-200">
          현재: {badge.emoji} {badge.label}
        </p>
      </div>

      <dl className="tactical-zone-detail__grid m-0">
        <div>
          <dt>진입</dt>
          <dd>{position.entry ?? "—"}</dd>
        </div>
        <div>
          <dt>손절</dt>
          <dd>{position.stop ?? "—"}</dd>
        </div>
        <div>
          <dt>목표</dt>
          <dd>{position.target ?? "—"}</dd>
        </div>
      </dl>

      {progress ? (
        <div className="tactical-zone-progress">
          <p className="m-0 text-[8px] font-semibold text-slate-500">목표 진행</p>
          <div className="tactical-zone-progress__track" aria-hidden>
            <span className="tactical-zone-progress__fill" style={{ width: `${progress.progressPct}%` }} />
            <span
              className="tactical-zone-progress__marker"
              style={{ left: `${progress.progressPct}%` }}
            />
          </div>
          <div className="tactical-zone-progress__labels font-mono tabular-nums">
            <span className="tactical-zone-progress__stop">
              <span aria-hidden>🔴 </span>
              {progress.formatted.stop}
            </span>
            <span className="tactical-zone-progress__current">
              <span aria-hidden>🟡 </span>
              {progress.formatted.current}
            </span>
            <span className="tactical-zone-progress__target">
              <span aria-hidden>🔵 </span>
              {progress.formatted.target}
            </span>
          </div>
          <p className="m-0 mt-0.5 text-[8px] text-slate-500">
            진행률{" "}
            <span className="font-mono text-slate-300">{progress.progressPct}%</span>
          </p>
        </div>
      ) : null}

      {position.aux?.length ? (
        <div className="tactical-zone-detail__aux">
          <p className="m-0 text-[8px] font-semibold text-slate-500">보조지표</p>
          <div className="flex flex-wrap gap-1">
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
          <p className="m-0 text-[8px] font-semibold text-slate-500">상태 이력</p>
          <ol className="tactical-zone-history-log m-0 mt-1 list-none p-0">
            {historyLog.map((h, i) => {
              const meta = TRADING_STAGE_META[h.stage]
              const isLast = i === historyLog.length - 1
              return (
                <li key={`${h.stage}-${h.dateLabel}-${i}`} className="tactical-zone-history-log__item">
                  <span className="tactical-zone-history-log__row">
                    {h.dateLabel ? (
                      <span className="tactical-zone-history-log__date font-mono">{h.dateLabel}</span>
                    ) : null}
                    <span className="tactical-zone-history-log__stage">
                      {meta?.label ?? h.stage}
                    </span>
                  </span>
                  {!isLast ? (
                    <span className="tactical-zone-history-log__arrow" aria-hidden>
                      ↓
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ol>
        </div>
      ) : null}
    </div>
  )
}
