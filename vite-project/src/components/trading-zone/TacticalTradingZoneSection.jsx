import { useMemo, useState } from "react"
import {
  TRADING_BUCKET_META,
  TRADING_BUCKET_ORDER,
  TRADING_MARKETS,
  TRADING_ZONE_TAKE_PROFIT_EMPTY,
  getTradingZonePositions,
  groupPositionsByBucket,
  resolveDefaultTradingPositionId,
  tradingStageBadge,
} from "../../trading-zone/tacticalTradingZoneData.js"
import { buildTradingZoneEngineLink } from "../../trading-zone/tradingZoneEngineLink.js"
import TacticalEngineLinkBar from "./TacticalEngineLinkBar.jsx"
import TacticalStockDetailPanel from "./TacticalStockDetailPanel.jsx"

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
 *   bucketId: import("../../trading-zone/tacticalTradingZoneData.js").TradingBucketId
 *   positions: import("../../trading-zone/tacticalTradingZoneData.js").TradingZonePosition[]
 *   selectedId: string | null
 *   onSelect: (id: string) => void
 * }} props
 */
function BucketCard({ title, bucketId, positions, selectedId, onSelect }) {
  return (
    <div className="tactical-zone-bucket">
      <p className="m-0 tactical-zone-bucket__title">{title}</p>
      <div className="tactical-zone-bucket__list">
        {positions.length === 0 ? (
          bucketId === "takeProfit" ? (
            <div className="tactical-zone-bucket__empty-stack">
              <span className="tactical-zone-bucket__empty">{TRADING_ZONE_TAKE_PROFIT_EMPTY.status}</span>
              <span className="tactical-zone-bucket__empty-sub">{TRADING_ZONE_TAKE_PROFIT_EMPTY.partial}</span>
            </div>
          ) : (
            <span className="tactical-zone-bucket__empty">—</span>
          )
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
 * @param {{
 *   panicData?: object | null
 *   cycleScore?: number | null
 *   snapshot?: import("../../macro-risk/engine.js").MacroRiskSnapshot | null
 *   historyRows?: object[]
 * }} props
 */
export default function TacticalTradingZoneSection({
  panicData = null,
  cycleScore = null,
  snapshot = null,
  historyRows = [],
}) {
  const positions = useMemo(() => getTradingZonePositions(), [])
  const [market, setMarket] = useState("us")
  const [selectedId, setSelectedId] = useState(() => {
    const us = positions.filter((p) => p.market === "us")
    return resolveDefaultTradingPositionId("us", us)
  })

  const engineLink = useMemo(
    () => buildTradingZoneEngineLink({ panicData, cycleScore, snapshot, historyRows }),
    [panicData, cycleScore, snapshot, historyRows],
  )

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
    const next = positions.filter((p) => p.market === id)
    setSelectedId(resolveDefaultTradingPositionId(id, next))
  }

  return (
    <section className="tactical-trading-zone trading-card-shell panic-v2-section overflow-hidden px-2 pb-2 sm:px-2.5">
      <div className="tactical-trading-zone__head border-l-2 border-orange-400/45 pl-2">
        <p className="m-0 text-[11px] font-bold text-slate-100">실전 매매 존</p>
        <p className="m-0 tactical-trading-zone__sub">미국 · 한국 · 관심 · 눌림 · 추세 · 1종목 1상태</p>
      </div>

      <div className="tactical-trading-zone__engine">
        <TacticalEngineLinkBar link={engineLink} />
      </div>

      <div className="tactical-trading-zone__tabs flex gap-1">
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

      <div className="tactical-trading-zone__buckets">
        {TRADING_BUCKET_ORDER.map((bucketId) => (
          <BucketCard
            key={bucketId}
            bucketId={bucketId}
            title={TRADING_BUCKET_META[bucketId].title}
            positions={bucketGroups[bucketId]}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        ))}
      </div>

      {selectedPosition ? (
        <div className="tactical-trading-zone__detail">
          <TacticalStockDetailPanel position={selectedPosition} />
        </div>
      ) : null}
    </section>
  )
}
