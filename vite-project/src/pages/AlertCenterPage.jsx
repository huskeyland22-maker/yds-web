import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useAppDataStore } from "../store/appDataStore.js"
import { panicDataFromCycleRow, mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildAlertCenterReport,
  filterAlertHistory,
  filterAlertHistoryByDays,
  ALERT_CENTER_LABEL,
  ALERT_GRADES,
} from "../trading-zone/ydsAlertCenterEngine.js"
import RecommendationJourneyStrip from "../components/journey/RecommendationJourneyStrip.jsx"
import WhyExplainButton from "../components/trust/WhyExplainButton.jsx"
import YdsEmptyState from "../components/trust/YdsEmptyState.jsx"
import { UI_BTN, UI_PAGE } from "../utils/ydsUiLabels.js"

/**
 * @param {import("../trading-zone/ydsAlertCenterStorage.js").AlertRow} alert
 */
function AlertRowItem({ alert }) {
  const watchLink = alert.stockId ? `/stock-picks#watchlist-${alert.stockId}` : "/stock-picks"
  return (
    <article className={`yds-alert-center__row yds-alert-center__row--${alert.grade}`}>
      <span className={`yds-alert-center__grade yds-alert-center__grade--${alert.grade}`}>
        {alert.grade}
      </span>
      <div className="yds-alert-center__row-body">
        <div className="yds-alert-center__row-title-row">
          <h3 className="yds-alert-center__row-title">{alert.title}</h3>
          {alert.causes?.length ? (
            <WhyExplainButton label={UI_BTN.whyAlert} lines={alert.causes} />
          ) : null}
        </div>
        <p className="yds-alert-center__row-text">{alert.body}</p>
        {alert.causes?.length ? (
          <div className="yds-alert-center__causes">
            <p className="yds-alert-center__causes-label">원인</p>
            <ul>
              {alert.causes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="yds-alert-center__row-meta">
          {alert.symbol ? (
            <span className="font-mono">{alert.symbol}</span>
          ) : null}
          <time dateTime={alert.at}>{alert.at.slice(0, 16).replace("T", " ")}</time>
        </p>
        {alert.stockId || alert.stockName ? (
          <Link to={watchLink} className="yds-alert-center__row-cta">
            {alert.stockName ?? alert.symbol} · {UI_BTN.watchlistFromAlert}
          </Link>
        ) : null}
      </div>
    </article>
  )
}

export default function AlertCenterPage() {
  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)
  const history = useMemo(
    () => resolveCycleHistoryRows(mergeCycleRows(storeRows ?? [], [])),
    [storeRows],
  )
  const latestCycleRow = history[history.length - 1] ?? null

  const latestSnapshot = useMemo(() => {
    if (!latestCycleRow) return null
    const panic = panicDataFromCycleRow(latestCycleRow)
    if (panic) return { ...latestCycleRow, ...panic, date: latestCycleRow.date ?? panic.updatedAt }
    return latestCycleRow
  }, [latestCycleRow])

  const report = useMemo(
    () =>
      buildAlertCenterReport(YDS_VALIDATION_EVENT_DATASET, {
        latestSnapshot,
        extraRows: history,
        sync: true,
      }),
    [latestSnapshot, history],
  )

  const [gradeFilter, setGradeFilter] = useState(/** @type {string | null} */ (null))
  const [daysFilter, setDaysFilter] = useState(/** @type {7 | 30 | 90 | null} */ (30))

  const filteredRealtime = useMemo(() => {
    let rows = filterAlertHistory(
      report.sectionA.items,
      /** @type {import("../trading-zone/ydsAlertCenterEngine.js").AlertGradeId | null} */ (gradeFilter),
    )
    rows = filterAlertHistoryByDays(rows, daysFilter)
    return rows
  }, [report.sectionA.items, gradeFilter, daysFilter])

  const filteredHistory = useMemo(() => {
    let rows = filterAlertHistory(
      report.sectionD.items,
      /** @type {import("../trading-zone/ydsAlertCenterEngine.js").AlertGradeId | null} */ (gradeFilter),
    )
    rows = filterAlertHistoryByDays(rows, daysFilter)
    return rows
  }, [report.sectionD.items, gradeFilter, daysFilter])

  const { sectionA, sectionB, sectionC, sectionD, stage } = report

  return (
    <div className="yds-alert-center min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-alert-center__header">
        <div>
          <p className="yds-alert-center__kicker">{ALERT_CENTER_LABEL}</p>
          <h1 className="yds-alert-center__title">{UI_PAGE.alert.title}</h1>
          <p className="yds-alert-center__sub">
            {stage.display} · 기준 {report.asOf ?? "—"} · 히스토리 {report.historyCount}/
            {report.historyMax}
          </p>
        </div>
        <Link to="/market-analysis" className="yds-alert-center__link">
          현재 시장 분석
        </Link>
      </header>

      <RecommendationJourneyStrip step="alert" />

      {!report.available ? (
        <YdsEmptyState
          icon="🔔"
          title="알림을 생성할 수 없음"
          description="시장 분석 데이터가 준비되면 단계·종목·섹터 변화에 따라 알림이 자동 생성됩니다."
          primaryTo="/market-analysis"
          primaryLabel="시장분석 확인"
          secondaryTo="/stock-picks"
          secondaryLabel={UI_PAGE.watchlist.title}
        />
      ) : (
        <>
          <section className="yds-alert-center__section" aria-labelledby="alert-e">
            <h2 id="alert-e" className="yds-alert-center__h2">
              E. 중요도 필터
            </h2>
            <div className="yds-alert-center__grade-chips" role="tablist" aria-label="중요도 필터">
              <button
                type="button"
                role="tab"
                aria-selected={gradeFilter === null}
                className={gradeFilter === null ? "is-active" : ""}
                onClick={() => setGradeFilter(null)}
              >
                전체 {sectionA.items.length}
              </button>
              {ALERT_GRADES.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  role="tab"
                  aria-selected={gradeFilter === g.id}
                  className={[
                    gradeFilter === g.id ? "is-active" : "",
                    `yds-alert-center__chip--${g.id}`,
                  ].join(" ")}
                  onClick={() => setGradeFilter(gradeFilter === g.id ? null : g.id)}
                >
                  {g.label} {sectionA.counts[g.id] ?? 0}
                </button>
              ))}
            </div>
            <ul className="yds-alert-center__grade-legend">
              {ALERT_GRADES.map((g) => (
                <li key={g.id}>
                  <strong>{g.label}</strong> {g.desc}
                </li>
              ))}
            </ul>
          </section>

          <section className="yds-alert-center__section" aria-labelledby="alert-a">
            <h2 id="alert-a" className="yds-alert-center__h2">
              A. 실시간 알림 목록
            </h2>
            <div className="yds-alert-center__list">
              {filteredRealtime.length ? (
                filteredRealtime.slice(0, 30).map((a) => <AlertRowItem key={a.id} alert={a} />)
              ) : (
                <p className="yds-alert-center__muted">표시할 알림이 없습니다. 시장·종목 변화 시 자동 생성됩니다.</p>
              )}
            </div>
          </section>

          <section className="yds-alert-center__section" aria-labelledby="alert-b">
            <h2 id="alert-b" className="yds-alert-center__h2">
              B. 종목 알림
            </h2>
            {sectionB.types.map((t) => {
              const rows = sectionB.groups[t.id] ?? []
              return (
                <div key={t.id} className="yds-alert-center__stock-group">
                  <h3 className="yds-alert-center__h3">
                    {t.label}
                    <span className="font-mono tabular-nums">{rows.length}</span>
                  </h3>
                  {rows.length ? (
                    <ul className="yds-alert-center__stock-list">
                      {rows.map((r) => (
                        <li key={r.id}>
                          <span className="yds-alert-center__stock-name">{r.name}</span>
                          <span className="font-mono text-slate-500">{r.symbol}</span>
                          <span className="font-mono tabular-nums">{r.scoreDisplay}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="yds-alert-center__muted">해당 없음</p>
                  )}
                </div>
              )
            })}
          </section>

          <section className="yds-alert-center__section" aria-labelledby="alert-c">
            <h2 id="alert-c" className="yds-alert-center__h2">
              C. 시장 알림
            </h2>
            <ul className="yds-alert-center__market-list">
              {sectionC.items.map((m) => (
                <li key={m.id} className={m.active ? "is-active" : ""}>
                  <span>{m.emoji}</span>
                  <span>{m.label}</span>
                  {m.active ? <span className="yds-alert-center__active-tag">현재</span> : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="yds-alert-center__section" aria-labelledby="alert-d">
            <h2 id="alert-d" className="yds-alert-center__h2">
              D. 알림 히스토리
            </h2>
            <div className="yds-alert-center__days-chips" role="tablist" aria-label="기간 필터">
              {[
                { id: 7, label: "7일" },
                { id: 30, label: "30일" },
                { id: 90, label: "90일" },
                { id: null, label: "전체" },
              ].map((d) => (
                <button
                  key={String(d.id)}
                  type="button"
                  role="tab"
                  aria-selected={daysFilter === d.id}
                  className={daysFilter === d.id ? "is-active" : ""}
                  onClick={() => setDaysFilter(d.id)}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="yds-alert-center__muted">
              최근 {report.historyMax}건 저장 · {filteredHistory.length}건 표시
            </p>
            <div className="yds-alert-center__list yds-alert-center__list--history">
              {filteredHistory.map((a) => (
                <AlertRowItem key={`hist-${a.id}`} alert={a} />
              ))}
            </div>
          </section>

          <ul className="yds-alert-center__footnotes">
            {report.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
