import { summarizeUniverseAsOf, listOfficialAumPendingCards } from "../../content/ydsEtfDataAsOf.js"
import { formatEtfPendingReason } from "../../content/ydsEtfInvestDecision.js"

function AsOfRow({ label, value, missing }) {
  return (
    <p className="yds-dbb__meta yds-dbb-asof-banner__row">
      <span className="yds-dbb-asof-banner__label">{label}</span>
      <span className="yds-dbb-asof-banner__value tabular-nums">
        {missing || !value ? "미확보" : value}
      </span>
    </p>
  )
}

/**
 * Phase G — universe-level as-of + mismatch notice (no date invention).
 */
export default function EtfDataAsOfBanner({ cards }) {
  const summary = summarizeUniverseAsOf(cards)
  const aumPending = listOfficialAumPendingCards(cards)

  return (
    <section className="yds-dbb-card yds-dbb-asof-banner mb-3" aria-label="데이터 기준일">
      <h2 className="yds-dbb-section__title">데이터 기준일</h2>
      <p className="yds-dbb__meta mt-2">
        출처·항목별 기준일을 구분합니다. 서로 다르면 하나로 덮어쓰지 않습니다.
      </p>
      <div className="yds-dbb-asof-banner__grid mt-2">
        <AsOfRow label="가격 데이터" value={summary.priceLabel} missing={summary.missingPrice} />
        <AsOfRow label="품질평가 메타" value={summary.qualityLabel} missing={summary.missingQuality} />
        <AsOfRow label="DBB 계산" value={summary.dbbLabel} missing={summary.missingDbb} />
      </div>
      {summary.aumDates.length ? (
        <p className="yds-dbb__meta">
          AUM 기준일 ·{" "}
          <span className="tabular-nums">
            {summary.aumDates.length === 1
              ? summary.aumDates[0]
              : `${summary.aumDates[0]}~${summary.aumDates[summary.aumDates.length - 1]}`}
          </span>
        </p>
      ) : null}
      {summary.holdingsDates.length ? (
        <p className="yds-dbb__meta">
          Top10 구성 기준일 ·{" "}
          <span className="tabular-nums">
            {summary.holdingsDates.length === 1
              ? summary.holdingsDates[0]
              : `${summary.holdingsDates[0]}~${summary.holdingsDates[summary.holdingsDates.length - 1]}`}
          </span>
        </p>
      ) : null}
      {summary.mismatch ? (
        <p className="yds-dbb__meta-warn" role="status">
          기준일 불일치 · 가격·품질 메타·DBB 기준일이 서로 다를 수 있습니다. 상세에서 항목별 출처를
          확인하세요.
        </p>
      ) : null}
      {aumPending.length ? (
        <p className="yds-dbb__meta-warn" role="status">
          공식 AUM 미확보 보류 ·{" "}
          {aumPending
            .map((c) => `${c.symbol}(${formatEtfPendingReason("missing_aum")})`)
            .join(", ")}{" "}
          · 비공식 수치로 해제하지 않습니다.
        </p>
      ) : null}
    </section>
  )
}
