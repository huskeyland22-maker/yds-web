/**
 * 실전 매매 존 — 시장 엔진 연계 (투자 전략 엔진 값 재사용)
 */

/**
 * @param {{ link: import("../../trading-zone/tradingZoneEngineLink.js").TradingZoneEngineLink }} props
 */
export default function TacticalEngineLinkBar({ link }) {
  if (!link.ready) {
    return (
      <div className="tactical-zone-engine-link tactical-zone-engine-link--pending">
        <p className="m-0 text-[9px] font-semibold text-slate-400">시장 엔진 연계</p>
        <p className="m-0 mt-0.5 text-[8px] text-slate-600">패닉·사이클 입력 후 연동</p>
      </div>
    )
  }

  const shortMid = link.cards.filter((c) => c.id === "short" || c.id === "mid")
  const longTactical = link.cards.filter((c) => c.id === "long" || c.id === "tactical")

  return (
    <div className="tactical-zone-engine-link" aria-label="시장 엔진 연계">
      <p className="m-0 tactical-zone-engine-link__title">시장 엔진 연계</p>
      <p className="m-0 mt-0.5 text-[8px] text-slate-500">현재 시장</p>

      <div className="tactical-zone-engine-link__grid mt-1">
        {shortMid.map((c) => (
          <div key={c.id} className="tactical-zone-engine-link__cell">
            <span className="tactical-zone-engine-link__period">{c.period}</span>
            <span className="tactical-zone-engine-link__score font-mono tabular-nums">
              {c.score ?? "—"}
            </span>
            <span className="tactical-zone-engine-link__action">{c.action}</span>
          </div>
        ))}
      </div>

      <div className="tactical-zone-engine-link__grid mt-0.5">
        {longTactical.map((c) => (
          <div key={c.id} className="tactical-zone-engine-link__cell">
            <span className="tactical-zone-engine-link__period">{c.period}</span>
            <span className="tactical-zone-engine-link__score font-mono tabular-nums">
              {c.score ?? "—"}
            </span>
            <span className="tactical-zone-engine-link__action">{c.action}</span>
          </div>
        ))}
      </div>

      {link.guidance.length ? (
        <div className="tactical-zone-engine-link__guidance mt-1">
          <p className="m-0 text-[8px] font-semibold text-slate-500">실전</p>
          <ul className="m-0 mt-0.5 list-none space-y-0.5 p-0">
            {link.guidance.map((line) => (
              <li key={line} className="text-[9px] leading-snug text-cyan-200/90">
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
