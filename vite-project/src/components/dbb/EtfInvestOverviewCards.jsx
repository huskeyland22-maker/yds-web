import { extractEtfAsOfDates } from "../../content/ydsEtfDataAsOf.js"
import {
  classifyEtfInvestDecision,
  formatEtfDbbStatusLabel,
  formatEtfPendingReason,
} from "../../content/ydsEtfInvestDecision.js"

/**
 * Phase G — mobile card summary for 15 ETFs (PC table remains separate).
 */
export default function EtfInvestOverviewCards({ cards, selectedSymbol, onSelect }) {
  const list = Array.isArray(cards) ? cards : []
  return (
    <section className="yds-dbb-invest-cards mb-3" aria-label="ETF 모바일 요약">
      <h2 className="yds-dbb-section__title">ETF 요약</h2>
      <p className="yds-dbb__meta mt-2">모바일 카드 보기 · 품질과 DBB는 합산하지 않습니다.</p>
      <ul className="yds-dbb-invest-cards__list mt-2">
        {list.map((card) => {
          const q = card?.quality
          const pending = (card?.qualityStatus || q?.status) !== "scored"
          const decision = classifyEtfInvestDecision(card)
          const conf = q?.dataConfidence?.score
          const asOf = extractEtfAsOfDates(card)
          const name = card.themeShort || card.theme || card.symbol
          const field = [card.sector, card.industry].filter(Boolean).join(" · ")
          const selected = card.symbol === selectedSymbol
          return (
            <li key={card.symbol}>
              <button
                type="button"
                className={`yds-dbb-invest-card${selected ? " is-selected" : ""}`}
                aria-pressed={selected}
                onClick={() => onSelect?.(card.symbol)}
              >
                <div className="yds-dbb-invest-card__head">
                  <span className="yds-dbb-invest-card__sym">{card.symbol}</span>
                  <span className={`yds-dbb-invest-pill is-${decision.id}`}>{decision.shortLabel}</span>
                </div>
                <p className="yds-dbb-invest-card__name">{name}</p>
                {field ? <p className="yds-dbb-invest-card__field">{field}</p> : null}
                <dl className="yds-dbb-invest-card__metrics">
                  <div>
                    <dt>품질</dt>
                    <dd>
                      {pending ? (
                        <>
                          평가 보류
                          {Array.isArray(q?.pendingReasons) && q.pendingReasons[0]
                            ? ` · ${formatEtfPendingReason(q.pendingReasons[0])}`
                            : ""}
                        </>
                      ) : (
                        <>
                          {card.qualityScore != null ? card.qualityScore : "—"}
                          {card.qualityGrade ? ` · ${card.qualityGrade}` : ""}
                        </>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>신뢰도</dt>
                    <dd className="tabular-nums">
                      {conf != null && Number.isFinite(Number(conf)) ? conf : "—"}
                      {q?.dataCoveragePct != null ? ` · 충족 ${q.dataCoveragePct}%` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>DBB</dt>
                    <dd>{formatEtfDbbStatusLabel(card)}</dd>
                  </div>
                  <div>
                    <dt>기준일</dt>
                    <dd className="tabular-nums">
                      {asOf.price || asOf.quality || "—"}
                      {asOf.price && asOf.quality && asOf.price !== asOf.quality ? " · 항목별 상이" : ""}
                    </dd>
                  </div>
                </dl>
              </button>
            </li>
          )
        })}
      </ul>
      {!list.length ? <p className="yds-dbb__status">표시할 ETF가 없습니다.</p> : null}
    </section>
  )
}
