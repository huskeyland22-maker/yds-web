import { useMemo, useState } from "react"
import {
  TRADING_BUCKET_META,
  TRADING_BUCKET_ORDER,
  TRADING_MARKETS,
  TRADING_STAGE_FLOW,
  TRADING_STAGE_META,
  getTradingZonePositions,
  groupPositionsByBucket,
  tradingStageBadge,
} from "../../trading-zone/tacticalTradingZoneData.js"

/**
 * @param {{ position: import("../../trading-zone/tacticalTradingZoneData.js").TradingZonePosition; selected: boolean; onSelect: (id: string) => void }} props
 */
function StockChip({ position, selected, onSelect }) {
  const badge = tradingStageBadge(position)
  return (
    <button
      type="button"
      onClick={() => onSelect(position.id)}
      className={["tactical-zone-chip", selected ? "tactical-zone-chip--selected" : ""].join(" ")}
    >
      <span className="tactical-zone-chip__name">{position.symbol}</span>
      <span className="tactical-zone-chip__badge" title={badge.label}>
        {badge.emoji} {badge.label}
      </span>
    </button>
  )
}

/**
 * @param {{
 *   title: string
 *   positions: import("../../trading-zone/tacticalTradingZoneData.js").TradingZonePosition[]
 *   selectedId: string | null
 *   onSelect: (id: string) => void
 * }} props
 */
function BucketCard({ title, positions, selectedId, onSelect }) {
  return (
    <div className="tactical-zone-bucket">
      <p className="m-0 tactical-zone-bucket__title">{title}</p>
      <div className="tactical-zone-bucket__list">
        {positions.length === 0 ? (
          <span className="text-[9px] text-slate-600">—</span>
        ) : (
          positions.map((p) => (
            <StockChip
              key={p.id}
              position={p}
              selected={selectedId === p.id}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  )
}

/**
 * @param {{ position: import("../../trading-zone/tacticalTradingZoneData.js").TradingZonePosition }} props
 */
function StockDetailPanel({ position }) {
  const currentIdx = TRADING_STAGE_FLOW.indexOf(position.stage)
  const badge = tradingStageBadge(position)
  const history = position.stageHistory ?? []

  return (
    <div className="tactical-zone-detail" role="region" aria-label={`${position.symbol} 상세`}>
      <p className="m-0 tactical-zone-detail__name">{position.symbol}</p>

      <div className="tactical-zone-detail__current">
        <p className="m-0 text-[8px] font-semibold text-slate-500">현재 단계</p>
        <p className="m-0 mt-0.5 text-[11px] font-bold text-slate-100">
          {badge.emoji} {badge.label}
        </p>
      </div>

      <div className="tactical-zone-detail__flow">
        <div className="tactical-zone-stage-flow">
          {TRADING_STAGE_FLOW.map((stageId, i) => {
            const meta = TRADING_STAGE_META[stageId]
            const active = stageId === position.stage
            const done = currentIdx >= 0 && i < currentIdx
            return (
              <span key={stageId} className="tactical-zone-stage-flow__item">
                {i > 0 ? <span className="tactical-zone-stage-flow__arrow">→</span> : null}
                <span
                  className={[
                    "tactical-zone-stage-flow__chip",
                    active ? "tactical-zone-stage-flow__chip--active" : "",
                    done ? "tactical-zone-stage-flow__chip--done" : "",
                  ].join(" ")}
                >
                  {meta.emoji} {meta.label}
                </span>
              </span>
            )
          })}
        </div>
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

      {history.length > 1 ? (
        <div className="tactical-zone-detail__history">
          <p className="m-0 text-[8px] font-semibold text-slate-500">단계 이동</p>
          <ul className="m-0 mt-1 list-none space-y-0.5 p-0">
            {history.map((h, i) => {
              const meta = TRADING_STAGE_META[h.stage]
              return (
                <li key={`${h.stage}-${h.at ?? i}`} className="text-[9px] text-slate-500">
                  {meta?.emoji} {meta?.label ?? h.stage}
                  {h.at ? <span className="ml-1 font-mono text-slate-600">{h.at}</span> : null}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export default function TacticalTradingZoneSection() {
  const positions = useMemo(() => getTradingZonePositions(), [])
  const [market, setMarket] = useState("us")
  const [selectedId, setSelectedId] = useState(null)

  const bucketGroups = useMemo(() => groupPositionsByBucket(market, positions), [market, positions])

  const marketPositions = useMemo(
    () => positions.filter((p) => p.market === market),
    [positions, market],
  )

  const selectedPosition = useMemo(
    () => marketPositions.find((p) => p.id === selectedId) ?? null,
    [marketPositions, selectedId],
  )

  const onMarketChange = (id) => {
    setMarket(id)
    setSelectedId(null)
  }

  return (
    <section className="tactical-trading-zone trading-card-shell panic-v2-section overflow-hidden px-2 pb-2 sm:px-2.5">
      <div className="tactical-trading-zone__head border-l-2 border-orange-400/45 pl-2">
        <p className="m-0 text-[11px] font-bold text-slate-100">실전 매매 존</p>
        <p className="m-0 text-[9px] text-slate-500">미국 · 한국 · 관심 · 눌림 · 추세 · 1종목 1상태</p>
      </div>

      <div className="tactical-trading-zone__tabs mt-1.5 flex gap-1">
        {Object.values(TRADING_MARKETS).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onMarketChange(m.id)}
            className={[
              "tactical-trading-zone__tab",
              market === m.id ? "tactical-trading-zone__tab--active" : "",
            ].join(" ")}
            aria-pressed={market === m.id}
          >
            <span aria-hidden>{m.flag}</span> {m.label}
          </button>
        ))}
      </div>

      <div className="tactical-trading-zone__buckets mt-1.5">
        {TRADING_BUCKET_ORDER.map((bucketId) => (
          <BucketCard
            key={bucketId}
            title={TRADING_BUCKET_META[bucketId].title}
            positions={bucketGroups[bucketId]}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        ))}
      </div>

      {selectedPosition ? (
        <div className="mt-1.5">
          <StockDetailPanel position={selectedPosition} />
        </div>
      ) : null}
    </section>
  )
}
