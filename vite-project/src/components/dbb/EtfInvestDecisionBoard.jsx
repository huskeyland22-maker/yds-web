import { ETF_INVEST_DECISION, groupCardsByInvestDecision } from "../../content/ydsEtfInvestDecision.js"

function BucketList({ id, list, selectedSymbol, onSelect }) {
  const meta = ETF_INVEST_DECISION[id]
  if (!meta) return null
  return (
    <div className={`yds-dbb-invest-bucket is-${id}`}>
      <h3 className="yds-dbb-invest-bucket__title">{meta.label}</h3>
      <p className="yds-dbb-invest-bucket__hint">{meta.hint}</p>
      {!list.length ? (
        <p className="yds-dbb__status">해당 ETF 없음</p>
      ) : (
        <ul className="yds-dbb-invest-bucket__list">
          {list.map((card) => (
            <li key={card.symbol}>
              <button
                type="button"
                className={`yds-dbb-invest-bucket__item${
                  card.symbol === selectedSymbol ? " is-selected" : ""
                }`}
                aria-pressed={card.symbol === selectedSymbol}
                onClick={() => onSelect?.(card.symbol)}
              >
                <span className="yds-dbb-invest-bucket__sym">{card.symbol}</span>
                <span className="yds-dbb-invest-bucket__meta">
                  {(card.qualityStatus || card.quality?.status) === "scored"
                    ? `Q ${card.qualityGrade ?? "—"} ${card.qualityScore ?? ""}`
                    : "품질 보류"}
                  {" · "}
                  {card.ok ? `${card.count}/4` : "DBB 오류"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Phase E/F — 품질 × 매수 신호 4분면 + 데이터 오류/지연 구분.
 */
export default function EtfInvestDecisionBoard({ cards, selectedSymbol, onSelect }) {
  const groups = groupCardsByInvestDecision(cards)
  const matrixOrder = ["quality_buy", "quality_wait", "caution_buy", "observe"]
  const issueOrder = ["dbb_unavailable", "data_stale"]
  const hasIssues = issueOrder.some((id) => (groups[id] || []).length > 0)

  return (
    <section className="yds-dbb-card mb-3" aria-label="품질 × 매수 신호 통합 판단">
      <h2 className="yds-dbb-section__title">품질 × 매수 신호</h2>
      <p className="yds-dbb__meta mt-2">
        품질과 DBB는 독립입니다. 하나의 종합점수로 만들지 않으며, 데이터 오류·지연은 매수 대기와 따로
        둡니다.
      </p>
      <div className="yds-dbb-invest-grid mt-2">
        {matrixOrder.map((id) => (
          <BucketList
            key={id}
            id={id}
            list={groups[id] || []}
            selectedSymbol={selectedSymbol}
            onSelect={onSelect}
          />
        ))}
      </div>
      {hasIssues ? (
        <div className="yds-dbb-invest-grid mt-2">
          {issueOrder.map((id) =>
            (groups[id] || []).length ? (
              <BucketList
                key={id}
                id={id}
                list={groups[id] || []}
                selectedSymbol={selectedSymbol}
                onSelect={onSelect}
              />
            ) : null,
          )}
        </div>
      ) : null}
    </section>
  )
}
