import {
  classifyEtfInvestDecision,
  formatEtfDbbStatusLabel,
  formatEtfPendingReason,
  getEtfDbbComputeStatus,
  pickEtfDataAsOf,
} from "../../content/ydsEtfInvestDecision.js"

/**
 * Phase E/F — ETF 15 종합 현황 (quality + DBB side-by-side, no combined score).
 */
export default function EtfInvestOverviewTable({ cards, selectedSymbol, onSelect }) {
  const list = Array.isArray(cards) ? cards : []
  return (
    <section className="yds-dbb-card yds-dbb-invest-table-panel mb-3" aria-label="ETF 종합 현황">
      <h2 className="yds-dbb-section__title">ETF 종합 현황</h2>
      <p className="yds-dbb__meta mt-2">
        PC 표 보기 · 품질점수와 DBB 매수 신호는 합산하지 않습니다. 보류·데이터 오류·지연은 정상 매수
        대기와 구분합니다.
      </p>
      <div className="yds-dbb__table-wrap mt-2">
        <table className="yds-dbb-invest-table">
          <thead>
            <tr>
              <th scope="col">티커</th>
              <th scope="col">이름·분야</th>
              <th scope="col">품질</th>
              <th scope="col">신뢰도</th>
              <th scope="col">DBB</th>
              <th scope="col">통합</th>
              <th scope="col">기준일</th>
            </tr>
          </thead>
          <tbody>
            {list.map((card) => {
              const q = card?.quality
              const pending = (card?.qualityStatus || q?.status) !== "scored"
              const decision = classifyEtfInvestDecision(card)
              const dbbStatus = getEtfDbbComputeStatus(card)
              const conf = q?.dataConfidence?.score
              const asOf = pickEtfDataAsOf(card)
              const name = card.themeShort || card.theme || card.symbol
              const field = [card.sector, card.industry].filter(Boolean).join(" · ")
              return (
                <tr
                  key={card.symbol}
                  className={card.symbol === selectedSymbol ? "is-selected" : undefined}
                >
                  <td>
                    <button
                      type="button"
                      className="yds-dbb-invest-table__sym"
                      aria-pressed={card.symbol === selectedSymbol}
                      onClick={() => onSelect?.(card.symbol)}
                    >
                      {card.symbol}
                    </button>
                  </td>
                  <td>
                    <span className="yds-dbb-invest-table__name">{name}</span>
                    {field ? <span className="yds-dbb-invest-table__field">{field}</span> : null}
                  </td>
                  <td className="tabular-nums">
                    {pending ? (
                      <span className="yds-dbb-invest-table__pending">
                        보류
                        {Array.isArray(q?.pendingReasons) && q.pendingReasons.length
                          ? ` · ${formatEtfPendingReason(q.pendingReasons[0])}`
                          : ""}
                      </span>
                    ) : (
                      <span>
                        {card.qualityScore != null ? card.qualityScore : "—"}
                        {card.qualityGrade ? ` · ${card.qualityGrade}` : ""}
                      </span>
                    )}
                  </td>
                  <td className="tabular-nums">
                    {conf != null && Number.isFinite(Number(conf)) ? conf : "—"}
                    {q?.dataCoveragePct != null ? (
                      <span className="yds-dbb-invest-table__sub"> · 충족 {q.dataCoveragePct}%</span>
                    ) : null}
                  </td>
                  <td>
                    <span
                      className={
                        dbbStatus.id === "ok"
                          ? undefined
                          : "yds-dbb-invest-table__pending"
                      }
                    >
                      {formatEtfDbbStatusLabel(card)}
                    </span>
                  </td>
                  <td>
                    <span className={`yds-dbb-invest-pill is-${decision.id}`}>{decision.shortLabel}</span>
                  </td>
                  <td className="tabular-nums">
                    {asOf || "—"}
                    {dbbStatus.id === "stale" ? (
                      <span className="yds-dbb-invest-table__sub"> · 지연</span>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!list.length ? <p className="yds-dbb__status mt-2">표시할 ETF가 없습니다.</p> : null}
    </section>
  )
}
