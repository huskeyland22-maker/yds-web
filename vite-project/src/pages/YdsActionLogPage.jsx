import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { computePeriodCompliance } from "../content/ydsComplianceEngine.js"
import { computeRecommendedAssetAllocation } from "../content/ydsPortfolioAllocationEngine.js"
import { computeReturnStats } from "../content/ydsReturnEngine.js"
import { useYdsActionLog } from "../hooks/useYdsActionLog.js"
import { useYdsMarketContext } from "../hooks/useYdsMarketContext.js"
import { UI_PAGE } from "../utils/ydsUiLabels.js"
import "../styles/yds-action-log.css"

const COMPLIANCE_PERIODS = [
  { id: "30", label: "30일" },
  { id: "90", label: "90일" },
  { id: "all", label: "전체" },
]

const RETURN_PERIODS = [
  { id: "30", label: "30일" },
  { id: "90", label: "90일" },
  { id: "180", label: "180일" },
  { id: "365", label: "1년" },
]

export default function YdsActionLogPage() {
  const marketContext = useYdsMarketContext()
  const { entries, addEntry, updateEntry, removeEntry } = useYdsActionLog()

  const recommended = useMemo(
    () => computeRecommendedAssetAllocation(marketContext),
    [marketContext],
  )

  const [compliancePeriod, setCompliancePeriod] = useState("30")
  const [returnPeriod, setReturnPeriod] = useState("90")

  const [usPct, setUsPct] = useState(40)
  const [krPct, setKrPct] = useState(30)
  const [cashPct, setCashPct] = useState(30)
  const [memo, setMemo] = useState("")
  const [startAsset, setStartAsset] = useState("")
  const [endAsset, setEndAsset] = useState("")
  const [editingId, setEditingId] = useState(/** @type {string | null} */ (null))

  const compliance = useMemo(
    () => computePeriodCompliance(entries, /** @type {'30'|'90'|'all'} */ (compliancePeriod)),
    [entries, compliancePeriod],
  )

  const returnStats = useMemo(
    () => computeReturnStats(entries, /** @type {'30'|'90'|'180'|'365'} */ (returnPeriod)),
    [entries, returnPeriod],
  )

  function resetForm() {
    setUsPct(40)
    setKrPct(30)
    setCashPct(30)
    setMemo("")
    setStartAsset("")
    setEndAsset("")
    setEditingId(null)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const input = {
      usPct,
      krPct,
      cashPct,
      memo,
      startAsset: startAsset ? Number(startAsset) : null,
      endAsset: endAsset ? Number(endAsset) : null,
    }
    if (editingId) {
      updateEntry(editingId, input, marketContext)
    } else {
      addEntry(input, marketContext)
    }
    resetForm()
  }

  /** @param {import("../content/ydsActionLogStorage.js").YdsActionLogEntry} entry */
  function startEdit(entry) {
    setEditingId(entry.id)
    setUsPct(entry.actual.usPct)
    setKrPct(entry.actual.krPct)
    setCashPct(entry.actual.cashPct)
    setMemo(entry.memo)
    setStartAsset(entry.startAsset != null ? String(entry.startAsset) : "")
    setEndAsset(entry.endAsset != null ? String(entry.endAsset) : "")
  }

  return (
    <div className="yds-action-log min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-action-log__header">
        <p className="yds-action-log__kicker">{UI_PAGE.actionLog.kicker}</p>
        <h1 className="yds-action-log__title">{UI_PAGE.actionLog.title}</h1>
        <p className="yds-action-log__sub">
          실행 기록 ·{" "}
          <Link to="/yds-compare">YDS vs 실제</Link>
          {" · "}
          <Link to="/ops-dashboard">운영 대시보드</Link>
          {" · "}
          <Link to="/portfolio">포트폴리오</Link>
        </p>
      </header>

      <section className="yds-action-log__stats" aria-label="준수율·수익률">
        <div className="yds-action-log__stat-card">
          <div className="yds-action-log__stat-head">
            <h2 className="yds-action-log__stat-title">YDS 준수율</h2>
            <div className="yds-action-log__tabs" role="tablist">
              {COMPLIANCE_PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={compliancePeriod === p.id}
                  className={[
                    "yds-action-log__tab",
                    compliancePeriod === p.id ? "yds-action-log__tab--active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setCompliancePeriod(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <p className="yds-action-log__stat-value font-mono tabular-nums">
            {compliance.overallCompliance != null ? `${compliance.overallCompliance}%` : "—"}
          </p>
          <div className="yds-action-log__stat-breakdown">
            <span>🇺🇸 {compliance.usCompliance ?? "—"}%</span>
            <span>🇰🇷 {compliance.krCompliance ?? "—"}%</span>
            <span>💵 {compliance.cashCompliance ?? "—"}%</span>
          </div>
          <p className="yds-action-log__stat-meta">
            {compliance.count > 0
              ? `${compliance.count}건 · 평균 괴리 ${compliance.avgGapPct}%`
              : "기록 후 준수율이 계산됩니다"}
          </p>
        </div>

        <div className="yds-action-log__stat-card">
          <div className="yds-action-log__stat-head">
            <h2 className="yds-action-log__stat-title">실제 수익률</h2>
            <div className="yds-action-log__tabs" role="tablist">
              {RETURN_PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={returnPeriod === p.id}
                  className={[
                    "yds-action-log__tab",
                    returnPeriod === p.id ? "yds-action-log__tab--active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setReturnPeriod(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <p className="yds-action-log__stat-value font-mono tabular-nums">
            {returnStats.avgReturnPct != null
              ? `${returnStats.avgReturnPct > 0 ? "+" : ""}${returnStats.avgReturnPct}%`
              : "—"}
          </p>
          <div className="yds-action-log__stat-breakdown">
            <span>최고 {returnStats.maxReturnPct != null ? `+${returnStats.maxReturnPct}%` : "—"}</span>
            <span>최저 {returnStats.minReturnPct != null ? `${returnStats.minReturnPct}%` : "—"}</span>
          </div>
          <p className="yds-action-log__stat-meta">
            {returnStats.count > 0
              ? `${returnStats.count}건 수익률 기록`
              : "시작·종료 자산 입력 시 수익률 집계"}
          </p>
        </div>
      </section>

      <section className="yds-action-log__yds-today" aria-label="오늘 YDS 권장">
        <p className="yds-action-log__yds-label">오늘 YDS 권장</p>
        <p className="yds-action-log__yds-row font-mono tabular-nums">
          🇺🇸 {recommended.usPct}% · 🇰🇷 {recommended.krPct}% · 💵 {recommended.cashPct}%
        </p>
        <p className="yds-action-log__yds-meta">
          {marketContext.strategyEmoji} {marketContext.strategyLabel} ·{" "}
          {marketContext.cycleLabel}
        </p>
      </section>

      <form className="yds-action-log__form" onSubmit={handleSubmit}>
        <h2 className="yds-action-log__section-title">
          {editingId ? "기록 수정" : "행동 기록"}
        </h2>

        <div className="yds-action-log__sliders">
          <label className="yds-action-log__slider-row">
            <span>🇺🇸 미국</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={usPct}
              onChange={(e) => setUsPct(Number(e.target.value))}
            />
            <span className="font-mono tabular-nums">{usPct}%</span>
          </label>
          <label className="yds-action-log__slider-row">
            <span>🇰🇷 한국</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={krPct}
              onChange={(e) => setKrPct(Number(e.target.value))}
            />
            <span className="font-mono tabular-nums">{krPct}%</span>
          </label>
          <label className="yds-action-log__slider-row">
            <span>💵 현금</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={cashPct}
              onChange={(e) => setCashPct(Number(e.target.value))}
            />
            <span className="font-mono tabular-nums">{cashPct}%</span>
          </label>
        </div>

        <div className="yds-action-log__assets">
          <label className="yds-action-log__field">
            <span>시작 자산 (선택)</span>
            <input
              type="number"
              min={0}
              placeholder="100000000"
              value={startAsset}
              onChange={(e) => setStartAsset(e.target.value)}
              className="yds-action-log__input font-mono tabular-nums"
            />
          </label>
          <label className="yds-action-log__field">
            <span>종료 자산 (선택)</span>
            <input
              type="number"
              min={0}
              placeholder="103000000"
              value={endAsset}
              onChange={(e) => setEndAsset(e.target.value)}
              className="yds-action-log__input font-mono tabular-nums"
            />
          </label>
        </div>

        <label className="yds-action-log__field">
          <span>메모</span>
          <textarea
            rows={2}
            placeholder="엔비디아 일부 익절"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="yds-action-log__textarea"
          />
        </label>

        <div className="yds-action-log__form-actions">
          {editingId ? (
            <button type="button" className="yds-action-log__btn yds-action-log__btn--ghost" onClick={resetForm}>
              취소
            </button>
          ) : null}
          <button type="submit" className="yds-action-log__btn yds-action-log__btn--primary">
            {editingId ? "수정 저장" : "저장"}
          </button>
        </div>
      </form>

      <section className="yds-action-log__history" aria-labelledby="action-log-history">
        <h2 id="action-log-history" className="yds-action-log__section-title">
          히스토리
        </h2>
        {!entries.length ? (
          <p className="yds-action-log__empty">아직 행동 기록이 없습니다.</p>
        ) : (
          <ul className="yds-action-log__list">
            {entries.map((entry) => (
              <li key={entry.id} className="yds-action-log__item">
                <div className="yds-action-log__item-head">
                  <strong className="yds-action-log__item-date">{entry.date}</strong>
                  <span className="yds-action-log__item-badge font-mono tabular-nums">
                    준수 {entry.compliancePct}%
                  </span>
                </div>

                <div className="yds-action-log__item-grid">
                  <div>
                    <p className="yds-action-log__item-label">YDS 권장</p>
                    <p className="yds-action-log__item-val font-mono tabular-nums">
                      🇺🇸 {entry.recommended.usPct} · 🇰🇷 {entry.recommended.krPct} · 💵{" "}
                      {entry.recommended.cashPct}
                    </p>
                  </div>
                  <div>
                    <p className="yds-action-log__item-label">실제</p>
                    <p className="yds-action-log__item-val font-mono tabular-nums">
                      🇺🇸 {entry.actual.usPct} · 🇰🇷 {entry.actual.krPct} · 💵 {entry.actual.cashPct}
                    </p>
                  </div>
                  <div>
                    <p className="yds-action-log__item-label">괴리도</p>
                    <p className="yds-action-log__item-val font-mono tabular-nums">{entry.gapPct}%</p>
                  </div>
                </div>

                <p className="yds-action-log__item-state">
                  {entry.ydsState.strategyLabel} · {entry.ydsState.cycleLabel}
                </p>

                {entry.memo ? <p className="yds-action-log__item-memo">{entry.memo}</p> : null}

                {entry.returnPct != null ? (
                  <p className="yds-action-log__item-return font-mono tabular-nums">
                    수익률 {entry.returnPct > 0 ? "+" : ""}
                    {entry.returnPct}%
                  </p>
                ) : null}

                <div className="yds-action-log__item-actions">
                  <button
                    type="button"
                    className="yds-action-log__btn yds-action-log__btn--ghost"
                    onClick={() => startEdit(entry)}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    className="yds-action-log__btn yds-action-log__btn--danger"
                    onClick={() => removeEntry(entry.id)}
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="yds-action-log__footnote">
        YDS는 예측이 아닌 실행 시스템 · 기록은 로컬 저장 · 향후 30/90/180일 성과 추적 연동 예정
      </p>
    </div>
  )
}
