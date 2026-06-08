import { useMemo, useState } from "react"
import { computePeriodCompliance } from "../../content/ydsComplianceEngine.js"
import { quickActionLabel } from "../../content/ydsActionLogEngine.js"
import { computeReturnStats } from "../../content/ydsReturnEngine.js"
import { usePortfolioHoldings } from "../../hooks/usePortfolioHoldings.js"
import { useYdsActionLog } from "../../hooks/useYdsActionLog.js"
import { useYdsMarketContext } from "../../hooks/useYdsMarketContext.js"
import "../../styles/yds-action-log.css"

const QUICK_ACTIONS = [
  { id: "buy", label: "매수" },
  { id: "sell", label: "매도" },
  { id: "watch", label: "관망" },
]

const RETURN_PERIODS = [
  { id: "30", label: "30일" },
  { id: "90", label: "90일" },
  { id: "180", label: "180일" },
  { id: "365", label: "1년" },
]

const RECENT_LIMIT = 5

export default function YdsPortfolioActionLogPanel() {
  const marketContext = useYdsMarketContext()
  const { holdings } = usePortfolioHoldings()
  const { entries, addEntry, updateEntry, removeEntry } = useYdsActionLog()

  const compliance = useMemo(
    () => computePeriodCompliance(entries, "30"),
    [entries],
  )

  const [returnPeriod, setReturnPeriod] = useState("90")
  const [quickAction, setQuickAction] = useState(/** @type {'buy'|'sell'|'watch'} */ ("watch"))
  const [ticker, setTicker] = useState("")
  const [memo, setMemo] = useState("")
  const [usPct, setUsPct] = useState(40)
  const [krPct, setKrPct] = useState(30)
  const [cashPct, setCashPct] = useState(30)
  const [startAsset, setStartAsset] = useState("")
  const [endAsset, setEndAsset] = useState("")
  const [editingId, setEditingId] = useState(/** @type {string | null} */ (null))
  const [advancedMode, setAdvancedMode] = useState(false)

  const returnStats = useMemo(
    () => computeReturnStats(entries, /** @type {'30'|'90'|'180'|'365'} */ (returnPeriod)),
    [entries, returnPeriod],
  )

  const recentEntries = entries.slice(0, RECENT_LIMIT)

  function resetForm() {
    setQuickAction("watch")
    setTicker("")
    setMemo("")
    setUsPct(40)
    setKrPct(30)
    setCashPct(30)
    setStartAsset("")
    setEndAsset("")
    setEditingId(null)
    setAdvancedMode(false)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const input = advancedMode
      ? {
          usPct,
          krPct,
          cashPct,
          memo,
          startAsset: startAsset ? Number(startAsset) : null,
          endAsset: endAsset ? Number(endAsset) : null,
          useExplicitAllocation: true,
        }
      : {
          quickAction,
          ticker,
          memo,
          holdings,
        }
    if (editingId) {
      updateEntry(editingId, input, marketContext)
    } else {
      addEntry(input, marketContext)
    }
    resetForm()
  }

  /** @param {import("../../content/ydsActionLogStorage.js").YdsActionLogEntry} entry */
  function startEdit(entry) {
    setEditingId(entry.id)
    if (entry.quickAction) {
      setQuickAction(entry.quickAction)
      setTicker(entry.ticker ?? "")
      setMemo(entry.memo)
      setAdvancedMode(false)
    } else {
      setUsPct(entry.actual.usPct)
      setKrPct(entry.actual.krPct)
      setCashPct(entry.actual.cashPct)
      setMemo(entry.memo)
      setStartAsset(entry.startAsset != null ? String(entry.startAsset) : "")
      setEndAsset(entry.endAsset != null ? String(entry.endAsset) : "")
      setAdvancedMode(true)
    }
  }

  /** @param {import("../../content/ydsActionLogStorage.js").YdsActionLogEntry} entry */
  function renderEntry(entry) {
    return (
      <li key={entry.id} className="yds-action-log__item">
        <div className="yds-action-log__item-head">
          <strong className="yds-action-log__item-date">{entry.date}</strong>
          {entry.quickAction ? (
            <span className="yds-action-log__item-action">
              {quickActionLabel(entry.quickAction)}
              {entry.ticker ? ` · ${entry.ticker}` : ""}
            </span>
          ) : (
            <span className="yds-action-log__item-badge font-mono tabular-nums">
              준수 {entry.compliancePct}%
            </span>
          )}
        </div>

        {entry.memo ? <p className="yds-action-log__item-memo">{entry.memo}</p> : null}

        <details className="yds-action-log__item-detail">
          <summary>비중 · 준수 {entry.compliancePct}%</summary>
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
          </div>
          {entry.returnPct != null ? (
            <p className="yds-action-log__item-return font-mono tabular-nums">
              수익률 {entry.returnPct > 0 ? "+" : ""}
              {entry.returnPct}%
            </p>
          ) : null}
        </details>

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
    )
  }

  return (
    <div className="yds-portfolio__action-log yds-action-log">
      <div className="yds-portfolio__action-log-head">
        <h2 className="yds-portfolio__section-title">실행 기록</h2>
        <p className="yds-portfolio__compliance font-mono tabular-nums">
          30일 준수{" "}
          {compliance.overallCompliance != null ? `${compliance.overallCompliance}%` : "—"}
        </p>
      </div>

      <form className="yds-action-log__form" onSubmit={handleSubmit}>
        <h3 className="yds-action-log__section-title">
          {editingId ? "기록 수정" : "오늘 행동"}
        </h3>

        {!advancedMode ? (
          <>
            <fieldset className="yds-action-log__quick">
              <legend className="yds-action-log__quick-legend">오늘 행동</legend>
              <div className="yds-action-log__quick-options">
                {QUICK_ACTIONS.map((action) => (
                  <label key={action.id} className="yds-action-log__quick-option">
                    <input
                      type="radio"
                      name="quickAction"
                      value={action.id}
                      checked={quickAction === action.id}
                      onChange={() => setQuickAction(/** @type {'buy'|'sell'|'watch'} */ (action.id))}
                    />
                    <span>{action.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="yds-action-log__field">
              <span>종목</span>
              <input
                type="text"
                placeholder="엔비디아"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                className="yds-action-log__input"
              />
            </label>

            <label className="yds-action-log__field">
              <span>메모</span>
              <textarea
                rows={2}
                placeholder="일부 익절"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="yds-action-log__textarea"
              />
            </label>
          </>
        ) : (
          <>
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
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="yds-action-log__textarea"
              />
            </label>
          </>
        )}

        <div className="yds-action-log__form-actions">
          {editingId ? (
            <button type="button" className="yds-action-log__btn yds-action-log__btn--ghost" onClick={resetForm}>
              취소
            </button>
          ) : (
            <button
              type="button"
              className="yds-action-log__btn yds-action-log__btn--ghost"
              onClick={() => setAdvancedMode((v) => !v)}
            >
              {advancedMode ? "간단 기록" : "비중·자산 상세"}
            </button>
          )}
          <button type="submit" className="yds-action-log__btn yds-action-log__btn--primary">
            {editingId ? "수정 저장" : "저장"}
          </button>
        </div>
      </form>

      {!entries.length ? (
        <p className="yds-action-log__empty">아직 실행 기록이 없습니다.</p>
      ) : (
        <ul className="yds-action-log__list">{recentEntries.map(renderEntry)}</ul>
      )}

      {entries.length > RECENT_LIMIT ? (
        <details className="yds-action-log__detail">
          <summary className="yds-action-log__detail-summary">
            이전 기록 · 수익률 통계 ({entries.length}건)
          </summary>
          <div className="yds-action-log__detail-body">
            <ul className="yds-action-log__list">{entries.slice(RECENT_LIMIT).map(renderEntry)}</ul>
            <div className="yds-action-log__stat-card">
              <div className="yds-action-log__stat-head">
                <h3 className="yds-action-log__stat-title">실제 수익률</h3>
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
            </div>
          </div>
        </details>
      ) : entries.length > 0 ? (
        <details className="yds-action-log__detail">
          <summary className="yds-action-log__detail-summary">수익률 통계</summary>
          <div className="yds-action-log__detail-body">
            <div className="yds-action-log__stat-card">
              <p className="yds-action-log__stat-value font-mono tabular-nums">
                {returnStats.avgReturnPct != null
                  ? `${returnStats.avgReturnPct > 0 ? "+" : ""}${returnStats.avgReturnPct}%`
                  : "—"}
              </p>
              <p className="yds-action-log__stat-meta">90일 평균 · 비중·자산 상세 기록 시 집계</p>
            </div>
          </div>
        </details>
      ) : null}
    </div>
  )
}
