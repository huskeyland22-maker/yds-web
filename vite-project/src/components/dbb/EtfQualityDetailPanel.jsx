import { extractEtfAsOfDates } from "../../content/ydsEtfDataAsOf.js"
import {
  ETF_QUALITY_PILLAR_LABELS,
  classifyEtfInvestDecision,
  describeQualityHighlights,
  formatEtfPendingReason,
  pickEtfDataAsOf,
} from "../../content/ydsEtfInvestDecision.js"

const PILLAR_ORDER = ["performance", "risk", "cost", "liquidity", "composition", "stability"]

/**
 * Phase E quality detail — score and confidence stay separate.
 */
export default function EtfQualityDetailPanel({ card }) {
  const q = card?.quality
  if (!q) {
    return (
      <section className="yds-dbb-card" aria-label="ETF 품질 평가">
        <h2 className="yds-dbb-section__title">품질 평가</h2>
        <p className="yds-dbb__meta mt-2">평가 보류</p>
      </section>
    )
  }

  const pending = q.status !== "scored"
  const decision = classifyEtfInvestDecision(card)
  const highlights = describeQualityHighlights(q)
  const pillars = PILLAR_ORDER.map((key) => [key, q.pillars?.[key]]).filter(([, p]) => p != null)
  const asOf = pickEtfDataAsOf(card)
  const dates = extractEtfAsOfDates(card)

  return (
    <section className="yds-dbb-card" aria-label="ETF 품질 평가">
      <h2 className="yds-dbb-section__title">품질 평가</h2>
      <p className="yds-dbb-score__state mt-2">
        {pending ? "평가 보류" : `YDS ${q.score} · 등급 ${q.grade}`}
      </p>
      {pending && card?.symbol === "QQQM" ? (
        <p className="yds-dbb__meta-warn" role="status">
          QQQM · 공식 AUM 미확보로 평가 보류 유지 · 비공식 데이터로 해제하지 않습니다.
        </p>
      ) : null}
      <p className="yds-dbb__meta">
        데이터 신뢰도 {q.dataConfidence?.score != null ? q.dataConfidence.score : "—"}
        {q.dataCoveragePct != null ? ` · 충족률 ${q.dataCoveragePct}%` : ""}
      </p>
      <p className="yds-dbb__meta">통합 분류 · {decision.shortLabel}</p>
      {q.peerGroupLabel ? <p className="yds-dbb__meta">피어 · {q.peerGroupLabel}</p> : null}
      {q.scoringMode ? (
        <p className="yds-dbb__meta">
          산정 · {q.scoringMode === "absolute_reference" ? "절대기준" : "피어 상대"}
          {q.peerSampleSize != null ? ` (n=${q.peerSampleSize})` : ""}
        </p>
      ) : null}
      {pending && Array.isArray(q.pendingReasons) && q.pendingReasons.length ? (
        <p className="yds-dbb__meta">
          보류 사유 · {q.pendingReasons.map(formatEtfPendingReason).join(", ")}
        </p>
      ) : null}

      {pillars.length ? (
        <ul className="yds-dbb-cond mt-2" aria-label="품질 필라">
          {pillars.map(([key, p]) => (
            <li key={key} className={`yds-dbb-cond__row${p?.excluded ? " is-fail" : " is-pass"}`}>
              <span className="yds-dbb-metric__label yds-dbb-cond__name">
                {ETF_QUALITY_PILLAR_LABELS[key] || key}
              </span>
              <span className="yds-dbb-cond__value tabular-nums">
                {p?.excluded || p?.score == null ? "제외" : p.score}
              </span>
              <span className="yds-dbb-metric__label yds-dbb-cond__th">
                {p?.nominalWeight != null ? `명목 ${p.nominalWeight}` : ""}
                {p?.appliedWeight != null ? ` · 적용 ${p.appliedWeight}` : ""}
                {p?.excludeReason ? ` · ${formatEtfPendingReason(p.excludeReason)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {highlights.strengths.length ? (
        <p className="yds-dbb__meta mt-2">강점 · {highlights.strengths.join(" · ")}</p>
      ) : null}
      {highlights.weaknesses.length ? (
        <p className="yds-dbb__meta">약점 · {highlights.weaknesses.join(" · ")}</p>
      ) : null}
      {highlights.excluded.length ? (
        <p className="yds-dbb__meta">제외 · {highlights.excluded.join(" · ")}</p>
      ) : null}

      <div className="yds-dbb-asof-detail mt-2">
        <p className="yds-dbb__meta">
          가격 기준일 · <span className="tabular-nums">{dates.price || "미확보"}</span>
        </p>
        <p className="yds-dbb__meta">
          품질 메타 기준일 · <span className="tabular-nums">{dates.quality || "미확보"}</span>
        </p>
        <p className="yds-dbb__meta">
          AUM 기준일 · <span className="tabular-nums">{dates.aum || "미확보"}</span>
        </p>
        <p className="yds-dbb__meta">
          Top10 기준일 · <span className="tabular-nums">{dates.holdings || "미확보"}</span>
        </p>
        <p className="yds-dbb__meta">
          DBB 계산 기준일 · <span className="tabular-nums">{dates.dbb || "미확보"}</span>
        </p>
        {asOf ? <p className="yds-dbb__meta">표시용 최근 기준일 · {asOf}</p> : null}
      </div>
      {Array.isArray(q.sources) && q.sources.length ? (
        <details className="yds-dbb-invest-sources mt-2">
          <summary className="yds-dbb__meta">공식 출처 {q.sources.length}건</summary>
          <ul className="yds-dbb-invest-sources__list">
            {q.sources.map((s, idx) => (
              <li key={`${s.field || "src"}-${idx}`}>
                <span className="yds-dbb-invest-sources__field">{s.field || "field"}</span>
                {s.asOf ? <span className="yds-dbb-invest-sources__asof"> · {s.asOf}</span> : null}
                {s.source ? (
                  <a
                    className="yds-dbb-invest-sources__link"
                    href={s.source}
                    target="_blank"
                    rel="noreferrer"
                  >
                    열기
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="yds-dbb__notice-muted mt-2">
        Morningstar 별점·Medalist: {q.morningstar?.label || "라이선스 확보 후 표시"}
      </p>
      <p className="yds-dbb__notice-muted">
        품질 점수와 데이터 신뢰도는 별도입니다. 누락 항목은 0점이 아니라 제외·재정규화합니다.
      </p>
    </section>
  )
}
