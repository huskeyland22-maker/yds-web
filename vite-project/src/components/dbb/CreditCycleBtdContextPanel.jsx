import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { loadCreditCycleUiModel } from "../../credit-cycle/creditCycleBridge.js"
import {
  assertBtdCreditIndependence,
  buildCreditCycleBtdContext,
} from "../../credit-cycle/creditCycleBtdContext.js"

/**
 * Side-by-side Credit Cycle context for Buy-the-Dip pages.
 * Does not alter DBB N/4 score. FREE macro context; Premium teaser is design-only.
 *
 * @param {{
 *   buySide?: {
 *     product?: "etf" | "equity" | "generic",
 *     symbol?: string | null,
 *     scoreNOf4?: number | null,
 *     stageLabel?: string | null,
 *     buyOk?: boolean,
 *     priceAsOf?: string | null,
 *   } | null,
 *   className?: string,
 * }} props
 */
export default function CreditCycleBtdContextPanel({ buySide = null, className = "" }) {
  const [ccModel, setCcModel] = useState(null)
  const [loadState, setLoadState] = useState("loading")

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const dto = await loadCreditCycleUiModel()
        if (!cancelled) {
          setCcModel(dto)
          setLoadState("ready")
        }
      } catch {
        if (!cancelled) {
          setCcModel(null)
          setLoadState("error")
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const ctx = useMemo(
    () =>
      buildCreditCycleBtdContext(
        loadState === "loading" ? undefined : ccModel,
        buySide,
      ),
    [ccModel, buySide, loadState],
  )
  const independent = assertBtdCreditIndependence(ctx)
  const credit = ctx.creditEnvironment
  const market = ctx.marketOpportunity
  const joint = ctx.jointReference
  const jointCompareLines =
    loadState === "loading"
      ? [
          "왼쪽(또는 상단): Buy-the-Dip 가격·기술 조건. 오른쪽(또는 하단): 신용 사이클 환경.",
          ctx.independence.note,
          "신용 사이클 데이터를 불러오는 중입니다.",
        ]
      : joint.compareLines

  return (
    <aside
      className={`yds-cc-btd ${className}`.trim()}
      aria-label="신용 사이클과 매수 기회 비교"
      data-scores-merged={independent ? "false" : "true"}
    >
      <header className="yds-cc-btd__head">
        <p className="yds-cc-btd__kicker">CREDIT × BUY-THE-DIP</p>
        <h2 className="yds-cc-btd__title">신용 환경 · 매수 기회 비교</h2>
        <p className="yds-cc-btd__lead">{ctx.independence.note}</p>
      </header>

      <p className="yds-cc-btd__signal" role="note">
        CCI는 매수·매도 신호가 아닙니다. {joint.noAutoAction}
      </p>

      <div className="yds-cc-btd__grid">
        <section className="yds-cc-btd__card" aria-label="시장 매수 기회">
          <h3>① 시장 매수 기회</h3>
          <p className="yds-cc-btd__metric">
            {market.available ? `${market.scoreNOf4}/4` : "—"}
          </p>
          <p className="yds-cc-btd__meta">{market.stageLabel || "DBB 단계 없음"}</p>
          <p className="yds-cc-btd__body">{market.summary}</p>
          {market.priceAsOf ? (
            <p className="yds-cc-btd__meta">가격 기준일 {market.priceAsOf}</p>
          ) : null}
          <p className="yds-cc-btd__hint">가격·기술 조건 · 기존 Buy-the-Dip 엔진</p>
        </section>

        <section className="yds-cc-btd__card" aria-label="신용 위험 환경">
          <h3>② 신용 위험 환경</h3>
          {loadState === "loading" ? (
            <p className="yds-cc-btd__body">신용 사이클 로드 중…</p>
          ) : loadState === "error" ? (
            <p className="yds-cc-btd__body">신용 데이터를 불러오지 못했습니다. 추정하지 않습니다.</p>
          ) : (
            <>
              <p className="yds-cc-btd__metric">
                {credit.available ? credit.cci : "—"}
                <span className="yds-cc-btd__metric-unit"> CCI</span>
              </p>
              <ul className="yds-cc-btd__kv">
                <li>
                  <span>기준일</span>
                  <strong>{credit.asOf || "—"}</strong>
                </li>
                <li>
                  <span>Coverage</span>
                  <strong>
                    {credit.coveragePct == null ? "—" : `${credit.coveragePct}%`}
                  </strong>
                </li>
                <li>
                  <span>PIT</span>
                  <strong>{credit.pitLabel || "—"}</strong>
                </li>
                <li>
                  <span>상태</span>
                  <strong>{credit.statusLabel || "—"}</strong>
                </li>
              </ul>
              {credit.staleIndicators?.length ? (
                <p className="yds-cc-btd__stale">
                  STALE · {credit.staleIndicators.map((s) => s.label).join(", ")}
                </p>
              ) : null}
              <ul className="yds-cc-btd__lines">
                {credit.summaryLines.slice(0, 4).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </>
          )}
          <p className="yds-cc-btd__hint">License-safe · HY/BBB 비공개 · 점수 합산 없음</p>
        </section>
      </div>

      <section className="yds-cc-btd__card yds-cc-btd__card--joint" aria-label="종합 판단 참고">
        <h3>③ 종합 판단 참고</h3>
        <ul className="yds-cc-btd__lines">
          {jointCompareLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <h4 className="yds-cc-btd__sub">추가 확인</h4>
        <ul className="yds-cc-btd__lines">
          {joint.additionalChecks.map((line) => (
            <li key={line}>{line}</li>
          ))}
          {loadState !== "loading"
            ? joint.whenCreditDataWeak.map((line) => (
                <li key={line}>{line}</li>
              ))
            : null}
          {joint.whenReviewingDip.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="yds-cc-btd__premium" aria-label="Premium 확장 안내">
        <h3>{ctx.premium.teaserTitle}</h3>
        <p className="yds-cc-btd__body">{ctx.premium.teaserBody}</p>
        <ul className="yds-cc-btd__lines">
          {ctx.premium.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <p className="yds-cc-btd__footer">
        <Link to={ctx.links.creditCycle}>신용 사이클 상세 분석</Link>
        <span className="yds-cc-btd__sep" aria-hidden="true">
          ·
        </span>
        <span className="yds-cc-btd__meta">FREE 매크로 맥락 · 결제 잠금 미적용</span>
      </p>
    </aside>
  )
}
