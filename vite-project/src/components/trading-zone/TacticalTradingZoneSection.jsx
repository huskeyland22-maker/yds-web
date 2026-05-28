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
import PanicDeskSectionHeader from "../panic-desk/PanicDeskSectionHeader.jsx"
import TacticalEngineLinkBar from "./TacticalEngineLinkBar.jsx"
import TacticalStockDetailPanel from "./TacticalStockDetailPanel.jsx"

/**
 * @param {{
 *   position: import("../../trading-zone/tacticalTradingZoneData.js").TradingZonePosition
 *   bucketId: import("../../trading-zone/tacticalTradingZoneData.js").TradingBucketId
 *   selected: boolean
 *   onSelect: (id: string) => void
 * }} props
 */
function StockChip({ position, bucketId, selected, onSelect }) {
  const badge = tradingStageBadge(position)
  const strengthScore = (position.stageHistory?.length ?? 0) * 12 + (position.aux?.length ?? 0) * 8
  const strengthTone = strengthScore >= 40 ? "strong" : strengthScore <= 20 ? "weak" : "normal"
  const trendLabel =
    position.stage === "trend" && (position.stageHistory?.length ?? 0) >= 3
      ? "🔥 강추세"
      : position.stage === "trend"
        ? "↗ 상승추세 유지"
        : null
  return (
    <button
      type="button"
      onClick={() => onSelect(position.id)}
      className={[
        "tactical-zone-chip",
        selected ? "tactical-zone-chip--selected" : "",
        bucketId === "pullback" ? "tactical-zone-chip--priority" : "",
        strengthTone === "strong" ? "tactical-zone-chip--strong" : "",
        strengthTone === "weak" ? "tactical-zone-chip--weak" : "",
      ].join(" ")}
    >
      <span className="tactical-zone-chip__main">
        <span className="tactical-zone-chip__name">{position.symbol}</span>
        {trendLabel ? <span className="tactical-zone-chip__sub">{trendLabel}</span> : null}
      </span>
      <span
        className="tactical-zone-chip__badge"
        data-stage={position.stage}
        title={badge.label}
      >
        <span aria-hidden>{badge.emoji}</span>
        {badge.label}
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
    <div className="tactical-zone-bucket" data-bucket={bucketId}>
      <p className="m-0 tactical-zone-bucket__title">{title}</p>
      <div className="tactical-zone-bucket__list">
        {positions.length === 0 ? (
          bucketId === "takeProfit" ? (
            <ul className="tactical-zone-bucket__empty-stack">
              <li className="tactical-zone-bucket__empty">
                📌 {TRADING_ZONE_TAKE_PROFIT_EMPTY.status}
              </li>
              <li className="tactical-zone-bucket__empty-sub">
                • +15% 도달 시 1차 분할
              </li>
              <li className="tactical-zone-bucket__empty-sub">
                • 거래량 이탈 시 일부 축소
              </li>
              <li className="tactical-zone-bucket__empty-sub">
                📌 {TRADING_ZONE_TAKE_PROFIT_EMPTY.partial}
              </li>
            </ul>
          ) : (
            <span className="tactical-zone-bucket__empty">—</span>
          )
        ) : (
          positions.map((p) => (
            <StockChip
              key={p.id}
              position={p}
              bucketId={bucketId}
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
    <section className="tactical-trading-zone trading-card-shell panic-v2-section panic-desk-section panic-desk-section--green overflow-hidden px-2 pb-2 sm:px-2.5">
      <PanicDeskSectionHeader
        icon="🎯"
        title="실전 매매존"
        description="미국·한국 실전 진입 관리"
        tone="green"
        compact
      />

      <hr className="tactical-trading-zone__divider" aria-hidden />

      <div className="tactical-trading-zone__engine-head">
        <p className="m-0 tactical-trading-zone__engine-title">
          <span aria-hidden>📈</span> 시장 엔진 연계
        </p>
        <p className="m-0 tactical-trading-zone__engine-sub">시장 상태 → 종목 실행</p>
      </div>

      <div className="tactical-trading-zone__engine">
        <TacticalEngineLinkBar link={engineLink} hideTitle />
      </div>

      <div className="tactical-trading-zone__tabs">
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
