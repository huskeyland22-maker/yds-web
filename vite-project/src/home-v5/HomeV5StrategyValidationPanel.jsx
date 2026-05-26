import { useCallback, useId, useMemo, useState } from "react"
import {
  HOME_V5_VALIDATION_SCENARIOS,
  groupValidationByScenario,
  runHomeV5StrategyValidation,
} from "./homeV5StrategyValidation.js"
import {
  clearHomeV5StrategyLogs,
  loadHomeV5StrategyLogs,
} from "./homeV5StrategyLogPersist.js"

/** @typedef {import("./homeV5StrategyValidation.js").HomeV5ReplayMode} HomeV5ReplayMode */

/**
 * @param {{ historyRows?: object[]; defaultOpen?: boolean; compact?: boolean }} props
 */
export default function HomeV5StrategyValidationPanel({
  historyRows = [],
  defaultOpen = false,
  compact = false,
}) {
  const panelId = useId()
  const [open, setOpen] = useState(defaultOpen)
  const [replayMode, setReplayMode] = useState(/** @type {HomeV5ReplayMode} */ ("anchors"))
  const [scenarioId, setScenarioId] = useState("all")
  const [results, setResults] = useState([])
  const [logTick, setLogTick] = useState(0)

  const historyMeta = useMemo(() => {
    if (!historyRows.length) return { count: 0, from: "—", to: "—" }
    const dates = historyRows.map((r) => String(r.date ?? "").slice(0, 10)).filter(Boolean).sort()
    return { count: historyRows.length, from: dates[0], to: dates[dates.length - 1] }
  }, [historyRows])

  const grouped = useMemo(() => groupValidationByScenario(results), [results])

  const runValidation = useCallback(() => {
    if (!historyRows.length) return
    const out = runHomeV5StrategyValidation(historyRows, replayMode, {
      persistLog: true,
      scenarioId: scenarioId === "all" ? undefined : scenarioId,
    })
    setResults(out)
    setLogTick((t) => t + 1)
  }, [historyRows, replayMode, scenarioId])

  const logCount = useMemo(() => loadHomeV5StrategyLogs().length, [results, logTick])

  const eventSummary = useMemo(
    () => HOME_V5_VALIDATION_SCENARIOS.map((s) => s.label).join(" · "),
    [],
  )

  return (
    <section
      className={[
        "home-v5-strategy-validation",
        compact ? "home-v5-strategy-validation--compact" : "",
        open ? "is-open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className="home-v5-strategy-validation__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="home-v5-strategy-validation__toggle-main">
          <span className="home-v5-strategy-validation__title">
            <span aria-hidden>{open ? "▲" : "▼"}</span>
            <span>전략 연구실</span>
            <span className="home-v5-strategy-validation__lab-tag">LAB</span>
          </span>
        </span>
        <span className="home-v5-strategy-validation__hint">
          {open ? "시장 재생 · 판정 · 타임라인" : `시장 재생 · ${eventSummary}`}
          {logCount > 0 ? ` · 로그 ${logCount}건` : ""}
        </span>
      </button>

      <div id={panelId} className="home-v5-strategy-validation__panel" hidden={!open}>
        <p className="home-v5-strategy-validation__meta">
          히스토리 {historyMeta.count}행 · {historyMeta.from} ~ {historyMeta.to}
        </p>

        <div className="home-v5-strategy-validation__controls">
          <label className="home-v5-strategy-validation__field">
            <span>재생</span>
            <select
              value={replayMode}
              onChange={(e) => setReplayMode(/** @type {HomeV5ReplayMode} */ (e.target.value))}
            >
              <option value="anchors">앵커 일자</option>
              <option value="weekly">주간</option>
              <option value="daily">일별</option>
            </select>
          </label>
          <label className="home-v5-strategy-validation__field">
            <span>이벤트</span>
            <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
              <option value="all">전체</option>
              {HOME_V5_VALIDATION_SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="home-v5-strategy-validation__run"
            disabled={!historyRows.length}
            onClick={runValidation}
          >
            재생 · 판정
          </button>
        </div>

        {grouped.length === 0 ? (
          <p className="home-v5-strategy-validation__empty">
            {historyRows.length
              ? "재생 · 판정을 실행하면 히스토리 카드와 타임라인이 표시됩니다."
              : "히스토리 데이터가 없습니다. 시장 엔진 히스토리 로드 후 다시 시도하세요."}
          </p>
        ) : (
          <div className="home-v5-strategy-validation__scenarios">
            {grouped.map(({ scenario, results: rows, timeline }) => (
              <div key={scenario.id} className="home-v5-strategy-validation__scenario">
                <div className="home-v5-strategy-validation__scenario-head">
                  <h3 className="home-v5-strategy-validation__scenario-title">{scenario.label}</h3>
                  <span className="home-v5-strategy-validation__scenario-range">
                    {scenario.start} ~ {scenario.end}
                  </span>
                </div>

                {timeline.length > 0 ? (
                  <div className="home-v5-strategy-validation__timeline" aria-label="국면 타임라인">
                    {timeline.map((step, idx) => (
                      <span key={`${step.date}-${step.regimeId}-${idx}`} className="home-v5-strategy-validation__timeline-step">
                        {idx > 0 ? (
                          <span className="home-v5-strategy-validation__timeline-arrow" aria-hidden>
                            →
                          </span>
                        ) : null}
                        <span className="home-v5-strategy-validation__timeline-emoji" title={step.date}>
                          {step.emoji}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="home-v5-strategy-validation__cards">
                  {rows.map((row) => (
                    <article
                      key={`${row.scenarioId}-${row.date}`}
                      className={[
                        "home-v5-strategy-hist-card",
                        row.missing ? "home-v5-strategy-hist-card--missing" : "",
                        row.regimeId ? `home-v5-strategy-hist-card--${row.regimeId}` : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <p className="home-v5-strategy-hist-card__date">{row.dateLabel ?? row.date.slice(0, 7)}</p>
                      <p className="home-v5-strategy-hist-card__status">
                        {row.statusEmoji} {row.statusLabel}
                      </p>
                      <p className="home-v5-strategy-hist-card__action">{row.action}</p>
                      <div className="home-v5-strategy-hist-card__rationale">
                        <span className="home-v5-strategy-hist-card__rationale-k">근거</span>
                        <ul className="home-v5-strategy-hist-card__rationale-list">
                          {(row.rationaleLines ?? [row.rationale]).map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!compact ? (
          <div className="home-v5-strategy-validation__foot">
            <button
              type="button"
              className="home-v5-strategy-validation__link-btn"
              onClick={() => {
                clearHomeV5StrategyLogs()
                setLogTick((t) => t + 1)
              }}
            >
              저장 로그 삭제
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
