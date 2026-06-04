import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useAppDataStore } from "../store/appDataStore.js"
import { panicDataFromCycleRow, mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import { YDS_VALIDATION_EVENT_DATASET } from "../trading-zone/ydsHistoricalValidationEvents.js"
import {
  buildWatchlistCenterReport,
  WATCHLIST_CENTER_LABEL,
  WATCH_PRIORITIES,
} from "../trading-zone/ydsWatchlistCenterEngine.js"

/**
 * @param {import("../trading-zone/ydsWatchlistCenterEngine.js").buildWatchlistCenterFromMarketAnalysis extends (...args: any) => infer R ? R extends { sectionA: { items: (infer I)[] } } ? I : never : never} item
 */
function WatchlistCard({ item }) {
  const { tradePlan: tp } = item
  return (
    <article className={`yds-watchlist__card yds-watchlist__card--${item.watchStateTone}`}>
      <header className="yds-watchlist__card-head">
        <span className="yds-watchlist__rank font-mono tabular-nums">{item.rank}</span>
        <div className="yds-watchlist__card-titles">
          <h3 className="yds-watchlist__card-name">{item.name}</h3>
          <span className="yds-watchlist__card-symbol font-mono">{item.symbol}</span>
        </div>
        <span className="yds-watchlist__card-score font-mono tabular-nums">{item.adjustedScoreDisplay}</span>
      </header>
      {item.explain ? (
        <div className="yds-watchlist__explain">
          <p className="yds-watchlist__explain-title">왜 {item.explain.stateTitle}인가</p>
          <ul>
            {item.explain.stateBullets.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="yds-watchlist__explain-priority">{item.explain.priorityHint}</p>
        </div>
      ) : null}
      <dl className="yds-watchlist__card-meta">
        <div>
          <dt>섹터</dt>
          <dd>{item.sectorLabel}</dd>
        </div>
        <div>
          <dt>상태</dt>
          <dd>
            <span className={`yds-watchlist__pill yds-watchlist__pill--${item.watchStateTone}`}>
              {item.watchStateLabel}
            </span>
          </dd>
        </div>
        <div>
          <dt>원점수</dt>
          <dd className="font-mono tabular-nums">{item.scoreDisplay}</dd>
        </div>
        <div>
          <dt>우선순위</dt>
          <dd>{item.priorityLabel}</dd>
        </div>
      </dl>
      <div className="yds-watchlist__plan" aria-label="매매 계획">
        <p className="yds-watchlist__plan-title">매매 계획</p>
        <ul>
          <li>
            <span>매수존</span>
            <strong>{tp.buyZone}</strong>
          </li>
          <li>
            <span>손절선</span>
            <strong>{tp.stopLoss}</strong>
          </li>
          <li>
            <span>1차 목표</span>
            <strong>{tp.target1}</strong>
          </li>
          <li>
            <span>2차 목표</span>
            <strong>{tp.target2}</strong>
          </li>
        </ul>
      </div>
      {item.paperLinked ? (
        <p className="yds-watchlist__paper-tag">Paper Trading 연동</p>
      ) : null}
    </article>
  )
}

export default function WatchlistCenterPage() {
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
      buildWatchlistCenterReport(YDS_VALIDATION_EVENT_DATASET, {
        latestSnapshot,
        extraRows: history,
      }),
    [latestSnapshot, history],
  )

  const [stateFilter, setStateFilter] = useState(/** @type {string | null} */ (null))
  const [priorityFilter, setPriorityFilter] = useState(/** @type {string | null} */ (null))

  const filteredItems = useMemo(() => {
    let list = report.sectionA.items
    if (stateFilter) list = list.filter((i) => i.watchStateId === stateFilter)
    if (priorityFilter) list = list.filter((i) => i.priorityId === priorityFilter)
    return list
  }, [report.sectionA.items, stateFilter, priorityFilter])

  const { sectionB, sectionE, sectionF, stage } = report

  return (
    <div className="yds-watchlist min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-watchlist__header">
        <div>
          <p className="yds-watchlist__kicker">{WATCHLIST_CENTER_LABEL}</p>
          <h1 className="yds-watchlist__title">{report.title}</h1>
          <p className="yds-watchlist__sub">
            Stock Radar Top10 · 기준 {report.asOf ?? "—"} · {stage.display}
          </p>
        </div>
        <Link to="/market-analysis" className="yds-watchlist__link">
          현재 시장 분석
        </Link>
      </header>

      {!report.available ? (
        <p className="yds-watchlist__empty">추천 종목 데이터가 없습니다. 현재 시장 분석을 먼저 확인하세요.</p>
      ) : (
        <>
          <section className="yds-watchlist__section" aria-labelledby="watchlist-f">
            <h2 id="watchlist-f" className="yds-watchlist__h2">
              F. 시장 단계 · 추천 강도
            </h2>
            <p className="yds-watchlist__stage-lead">{sectionF.current.display}</p>
            <p className="yds-watchlist__stage-hint">{sectionF.current.intensityLabel}</p>
            <p className="yds-watchlist__stage-guide">{sectionF.current.guidance}</p>
            <ul className="yds-watchlist__stage-bands">
              {sectionF.bands.map((b) => (
                <li key={b.id} className={b.active ? "is-active" : ""}>
                  <span className="yds-watchlist__stage-emoji">{b.emoji}</span>
                  <span className="yds-watchlist__stage-name">{b.shortLabel}</span>
                  <span className="yds-watchlist__stage-mul font-mono tabular-nums">
                    진입×{b.entryMul} · 눌림×{b.dipMul}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="yds-watchlist__section" aria-labelledby="watchlist-a">
            <h2 id="watchlist-a" className="yds-watchlist__h2">
              A. 오늘의 핵심 종목 Top 10
            </h2>
            <ol className="yds-watchlist__top-list">
              {report.sectionA.items.map((item) => (
                <li key={item.id}>
                  <span className="font-mono tabular-nums">{item.rank}</span>
                  <span className="yds-watchlist__top-name">{item.name}</span>
                  <span className={`yds-watchlist__pill yds-watchlist__pill--${item.watchStateTone}`}>
                    {item.watchStateLabel}
                  </span>
                  <span className="font-mono tabular-nums">{item.adjustedScoreDisplay}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="yds-watchlist__section" aria-labelledby="watchlist-b">
            <h2 id="watchlist-b" className="yds-watchlist__h2">
              B. 종목 상태
            </h2>
            <div className="yds-watchlist__state-chips" role="tablist" aria-label="상태 필터">
              <button
                type="button"
                role="tab"
                aria-selected={stateFilter === null}
                className={stateFilter === null ? "is-active" : ""}
                onClick={() => setStateFilter(null)}
              >
                전체 {report.sectionA.items.length}
              </button>
              {sectionB.states.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={stateFilter === s.id}
                  className={stateFilter === s.id ? "is-active" : ""}
                  onClick={() => setStateFilter(stateFilter === s.id ? null : s.id)}
                >
                  {s.label} {sectionB.counts[s.id] ?? 0}
                </button>
              ))}
            </div>
          </section>

          <section className="yds-watchlist__section" aria-labelledby="watchlist-e">
            <h2 id="watchlist-e" className="yds-watchlist__h2">
              E. 우선순위
            </h2>
            <div className="yds-watchlist__prio-chips" role="tablist" aria-label="우선순위 필터">
              <button
                type="button"
                role="tab"
                aria-selected={priorityFilter === null}
                className={priorityFilter === null ? "is-active" : ""}
                onClick={() => setPriorityFilter(null)}
              >
                전체
              </button>
              {WATCH_PRIORITIES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={priorityFilter === p.id}
                  className={priorityFilter === p.id ? "is-active" : ""}
                  onClick={() => setPriorityFilter(priorityFilter === p.id ? null : p.id)}
                >
                  {p.label} {sectionE.groups[p.id]?.length ?? 0}
                </button>
              ))}
            </div>
          </section>

          <section className="yds-watchlist__section" aria-labelledby="watchlist-cd">
            <h2 id="watchlist-cd" className="yds-watchlist__h2">
              C·D. 종목 카드 · 매매 계획
            </h2>
            <p className="yds-watchlist__filter-note">
              {filteredItems.length}종목 표시
              {stateFilter || priorityFilter ? " (필터 적용)" : ""}
            </p>
            <div className="yds-watchlist__cards">
              {filteredItems.map((item) => (
                <WatchlistCard key={item.id} item={item} />
              ))}
            </div>
          </section>

          <ul className="yds-watchlist__footnotes">
            {report.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
