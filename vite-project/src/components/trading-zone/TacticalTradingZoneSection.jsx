import { useMemo, useState } from "react"
import {
  TRADING_BUCKET_META,
  TRADING_BUCKET_ORDER,
  TRADING_MARKETS,
  TRADING_STAGE_FLOW,
  TRADING_STAGE_META,
  getTradingZoneStocks,
  stocksInBucket,
  tradingStageBadge,
} from "../../trading-zone/tacticalTradingZoneData.js"

/**
 * @param {{ stock: import("../../trading-zone/tacticalTradingZoneData.js").TradingZoneStock }} props
 */
function StockChip({ stock, selected, onSelect }) {
  const badge = tradingStageBadge(stock)
  return (
    <button
      type="button"
      onClick={() => onSelect(stock.id)}
      className={[
        "tactical-zone-chip",
        selected ? "tactical-zone-chip--selected" : "",
      ].join(" ")}
    >
      <span className="tactical-zone-chip__name">{stock.name}</span>
      <span className="tactical-zone-chip__badge" title={badge.label}>
        {badge.emoji}
      </span>
    </button>
  )
}

/**
 * @param {{
 *   title: string
 *   stocks: import("../../trading-zone/tacticalTradingZoneData.js").TradingZoneStock[]
 *   selectedId: string | null
 *   onSelect: (id: string) => void
 * }} props
 */
function BucketCard({ title, stocks, selectedId, onSelect }) {
  return (
    <div className="tactical-zone-bucket">
      <p className="m-0 tactical-zone-bucket__title">{title}</p>
      <div className="tactical-zone-bucket__list">
        {stocks.length === 0 ? (
          <span className="text-[9px] text-slate-600">—</span>
        ) : (
          stocks.map((s) => (
            <StockChip key={s.id} stock={s} selected={selectedId === s.id} onSelect={onSelect} />
          ))
        )}
      </div>
    </div>
  )
}

/**
 * @param {{ stock: import("../../trading-zone/tacticalTradingZoneData.js").TradingZoneStock }} props
 */
function StockDetailPanel({ stock }) {
  const currentIdx = TRADING_STAGE_FLOW.indexOf(stock.stage)

  return (
    <div className="tactical-zone-detail" role="region" aria-label={`${stock.name} 상세`}>
      <p className="m-0 tactical-zone-detail__name">{stock.name}</p>

      <div className="tactical-zone-detail__flow">
        <p className="m-0 text-[8px] font-semibold text-slate-500">현재 단계</p>
        <div className="tactical-zone-stage-flow">
          {TRADING_STAGE_FLOW.map((stageId, i) => {
            const meta = TRADING_STAGE_META[stageId]
            const active = stageId === stock.stage
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
          <dd>{stock.entry ?? "—"}</dd>
        </div>
        <div>
          <dt>손절</dt>
          <dd>{stock.stop ?? "—"}</dd>
        </div>
        <div>
          <dt>목표</dt>
          <dd>{stock.target ?? "—"}</dd>
        </div>
      </dl>

      {stock.aux?.length ? (
        <div className="tactical-zone-detail__aux">
          <p className="m-0 text-[8px] font-semibold text-slate-500">보조</p>
          <div className="flex flex-wrap gap-1">
            {stock.aux.map((tag) => (
              <span key={tag} className="tactical-zone-aux-tag">
                {tag}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function TacticalTradingZoneSection() {
  const stocks = useMemo(() => getTradingZoneStocks(), [])
  const [market, setMarket] = useState("us")
  const [selectedId, setSelectedId] = useState(null)

  const marketStocks = useMemo(
    () => stocks.filter((s) => s.market === market),
    [stocks, market],
  )

  const selectedStock = useMemo(
    () => marketStocks.find((s) => s.id === selectedId) ?? null,
    [marketStocks, selectedId],
  )

  const onMarketChange = (id) => {
    setMarket(id)
    setSelectedId(null)
  }

  return (
    <section className="tactical-trading-zone trading-card-shell panic-v2-section overflow-hidden px-2 pb-2 sm:px-2.5">
      <div className="tactical-trading-zone__head border-l-2 border-orange-400/45 pl-2">
        <p className="m-0 text-[11px] font-bold text-slate-100">실전 매매 존</p>
        <p className="m-0 text-[9px] text-slate-500">미국 · 한국 · 관심 · 눌림 · 추세</p>
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
            stocks={stocksInBucket(market, bucketId, stocks)}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        ))}
      </div>

      {selectedStock ? (
        <div className="mt-1.5">
          <StockDetailPanel stock={selectedStock} />
        </div>
      ) : null}
    </section>
  )
}
