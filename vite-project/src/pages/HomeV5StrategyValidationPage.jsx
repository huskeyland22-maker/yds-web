import { useCallback, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useAppDataStore } from "../store/appDataStore.js"
import { mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import {
  HOME_V5_VALIDATION_SCENARIOS,
  runHomeV5StrategyValidation,
} from "../home-v5/homeV5StrategyValidation.js"
import {
  clearHomeV5StrategyLogs,
  loadHomeV5StrategyLogs,
} from "../home-v5/homeV5StrategyLogPersist.js"

/** @typedef {import("../home-v5/homeV5StrategyValidation.js").HomeV5ReplayMode} HomeV5ReplayMode */

export default function HomeV5StrategyValidationPage() {
  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)
  const history = useMemo(
    () => resolveCycleHistoryRows(mergeCycleRows(storeRows ?? [], [])),
    [storeRows],
  )

  const [replayMode, setReplayMode] = useState(/** @type {HomeV5ReplayMode} */ ("anchors"))
  const [scenarioId, setScenarioId] = useState("all")
  const [results, setResults] = useState([])
  const [logs, setLogs] = useState(() => loadHomeV5StrategyLogs())

  const historyMeta = useMemo(() => {
    if (!history.length) return { count: 0, from: "—", to: "—" }
    const dates = history.map((r) => String(r.date ?? "").slice(0, 10)).filter(Boolean).sort()
    return { count: history.length, from: dates[0], to: dates[dates.length - 1] }
  }, [history])

  const refreshLogs = useCallback(() => setLogs(loadHomeV5StrategyLogs()), [])

  const runValidation = useCallback(() => {
    if (!history.length) return
    const out = runHomeV5StrategyValidation(history, replayMode, {
      persistLog: true,
      scenarioId: scenarioId === "all" ? undefined : scenarioId,
    })
    setResults(out)
    refreshLogs()
  }, [history, replayMode, scenarioId, refreshLogs])

  const handleClearLog = useCallback(() => {
    clearHomeV5StrategyLogs()
    refreshLogs()
  }, [refreshLogs])

  const handleExportLog = useCallback(() => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `home-v5-strategy-log-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [logs])

  return (
    <div className="home-v5-validation-page min-w-0 px-3 py-4 sm:px-4">
      <header className="home-v5-validation-page__head">
        <div>
          <h1 className="home-v5-validation-page__title">전략 엔진 검증</h1>
          <p className="home-v5-validation-page__sub">
            히스토리 재생 · dev 전용 · /cycle UI 미반영
          </p>
        </div>
        <Link to="/cycle" className="home-v5-validation-page__link">
          홈으로
        </Link>
      </header>

      <section className="home-v5-validation-panel">
        <p className="home-v5-validation-panel__meta">
          히스토리 {historyMeta.count}행 · {historyMeta.from} ~ {historyMeta.to}
        </p>
        <div className="home-v5-validation-panel__controls">
          <label className="home-v5-validation-field">
            <span>재생 모드</span>
            <select
              value={replayMode}
              onChange={(e) => setReplayMode(/** @type {HomeV5ReplayMode} */ (e.target.value))}
            >
              <option value="anchors">앵커 일자 (검증 이벤트)</option>
              <option value="weekly">구간 주간 재생</option>
              <option value="daily">구간 일별 재생</option>
            </select>
          </label>
          <label className="home-v5-validation-field">
            <span>시나리오</span>
            <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
              <option value="all">전체 검증 이벤트</option>
              {HOME_V5_VALIDATION_SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="home-v5-validation-btn home-v5-validation-btn--primary"
            disabled={!history.length}
            onClick={runValidation}
          >
            검증 실행 · 로그 저장
          </button>
        </div>
      </section>

      {results.length > 0 ? (
        <section className="home-v5-validation-panel">
          <h2 className="home-v5-validation-panel__h2">재생 판정 결과</h2>
          <div className="home-v5-validation-table-wrap">
            <table className="home-v5-validation-table">
              <thead>
                <tr>
                  <th>이벤트</th>
                  <th>날짜</th>
                  <th>상태</th>
                  <th>행동</th>
                  <th>CNN</th>
                  <th>VIX</th>
                  <th>BofA</th>
                  <th>근거</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={`${r.scenarioId}-${r.date}`} className={r.missing ? "is-missing" : ""}>
                    <td>{r.scenarioLabel}</td>
                    <td>{r.date}</td>
                    <td>
                      {r.statusEmoji} {r.statusLabel}
                    </td>
                    <td>{r.action}</td>
                    <td>{r.metrics?.cnn ?? "—"}</td>
                    <td>{r.metrics?.vix ?? "—"}</td>
                    <td>{r.metrics?.bofa ?? "—"}</td>
                    <td className="home-v5-validation-table__rationale">{r.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="home-v5-validation-panel">
        <div className="home-v5-validation-panel__row">
          <h2 className="home-v5-validation-panel__h2">전략 엔진 로그 (localStorage)</h2>
          <div className="home-v5-validation-panel__actions">
            <button type="button" className="home-v5-validation-btn" onClick={refreshLogs}>
              새로고침
            </button>
            <button type="button" className="home-v5-validation-btn" onClick={handleExportLog}>
              JSON보내기
            </button>
            <button
              type="button"
              className="home-v5-validation-btn home-v5-validation-btn--danger"
              onClick={handleClearLog}
            >
              로그 삭제
            </button>
          </div>
        </div>
        <div className="home-v5-validation-table-wrap">
          <table className="home-v5-validation-table home-v5-validation-table--compact">
            <thead>
              <tr>
                <th>기록</th>
                <th>이벤트</th>
                <th>날짜</th>
                <th>상태</th>
                <th>행동</th>
                <th>근거</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6}>저장된 로그 없음 — 검증 실행 후 자동 저장</td>
                </tr>
              ) : (
                logs.slice(0, 80).map((row) => (
                  <tr key={row.id}>
                    <td>{row.recordedAt?.slice(0, 19).replace("T", " ")}</td>
                    <td>{row.scenarioLabel}</td>
                    <td>{row.date}</td>
                    <td>
                      {row.statusEmoji} {row.statusLabel}
                    </td>
                    <td>{row.action}</td>
                    <td className="home-v5-validation-table__rationale">{row.rationale}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="home-v5-validation-panel home-v5-validation-panel--events">
        <h2 className="home-v5-validation-panel__h2">검증 이벤트</h2>
        <ul className="home-v5-validation-events">
          {HOME_V5_VALIDATION_SCENARIOS.map((s) => (
            <li key={s.id}>
              <strong>{s.label}</strong>
              <span>
                {s.start} ~ {s.end}
              </span>
              <span className="home-v5-validation-events__anchors">앵커 {s.anchors.join(", ")}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
