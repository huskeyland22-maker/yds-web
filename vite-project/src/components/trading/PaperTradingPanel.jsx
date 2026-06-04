import { useCallback, useEffect, useState } from "react"
import {
  buildPaperTradingFromEntryRadar,
  PAPER_TRADE_GRADE_POLICY,
} from "../../trading-zone/ydsPaperTradingEngine.js"
import {
  closePaperPosition,
  loadPaperTrading,
  setPaperTradingIncludeGradeB,
} from "../../trading-zone/ydsPaperTradingStorage.js"

/**
 * @param {{
 *   entryRadar: ReturnType<typeof import("../../trading-zone/ydsPrecursorEnginePhase27.js").buildEntryRadarFromPrecursorContext> | null
 *   compact?: boolean
 * }} props
 */
export default function PaperTradingPanel({ entryRadar, compact = false }) {
  const [tab, setTab] = useState("OPEN")
  const [includeGradeB, setIncludeGradeB] = useState(
    () => loadPaperTrading().includeGradeB,
  )
  const [report, setReport] = useState(() =>
    buildPaperTradingFromEntryRadar(
      { available: false, tradeCandidates: [] },
      { sync: false },
    ),
  )
  const [syncNote, setSyncNote] = useState("")

  const refresh = useCallback(
    (opts = {}) => {
      if (!entryRadar) return
      const next = buildPaperTradingFromEntryRadar(entryRadar, {
        includeGradeB: opts.includeGradeB ?? includeGradeB,
        sync: opts.sync !== false,
      })
      setReport(next)
      if (next.lastSync) {
        const c = next.lastSync.created.length
        const s = next.lastSync.skipped.length
        setSyncNote(
          c || s
            ? `동기화 · 생성 ${c}건${s ? ` · 스킵 ${s}건` : ""}`
            : "동기화 · 신규 없음",
        )
      }
    },
    [entryRadar, includeGradeB],
  )

  useEffect(() => {
    if (!entryRadar?.available) return
    refresh({ sync: true })
  }, [entryRadar, refresh])

  const rows = tab === "OPEN" ? report.open : report.closed

  const onToggleB = () => {
    const next = !includeGradeB
    setIncludeGradeB(next)
    setPaperTradingIncludeGradeB(next)
    refresh({ includeGradeB: next, sync: true })
  }

  const onClose = (id) => {
    closePaperPosition(id)
    refresh({ sync: false })
  }

  return (
    <div className={`yds-paper-trading${compact ? " yds-paper-trading--compact" : ""}`}>
      <div className="yds-paper-trading__policy">
        <span>A · {PAPER_TRADE_GRADE_POLICY.A.label}</span>
        <span>B · {PAPER_TRADE_GRADE_POLICY.B.label}</span>
        <span>C/D · 생성 안함</span>
      </div>

      <div className="yds-paper-trading__toolbar">
        <div className="yds-paper-trading__tabs" role="tablist" aria-label="Paper Trading">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "OPEN"}
            className={tab === "OPEN" ? "is-active" : ""}
            onClick={() => setTab("OPEN")}
          >
            OPEN <span className="yds-paper-trading__tab-count">{report.counts.open}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "CLOSED"}
            className={tab === "CLOSED" ? "is-active" : ""}
            onClick={() => setTab("CLOSED")}
          >
            CLOSED <span className="yds-paper-trading__tab-count">{report.counts.closed}</span>
          </button>
        </div>
        <label className="yds-paper-trading__b-toggle">
          <input type="checkbox" checked={includeGradeB} onChange={onToggleB} />
          B등급 선택 생성
        </label>
        <button type="button" className="yds-paper-trading__sync-btn" onClick={() => refresh({ sync: true })}>
          A/B 동기화
        </button>
      </div>

      {syncNote ? <p className="yds-paper-trading__sync-note">{syncNote}</p> : null}

      {!compact ? (
        <div className="yds-paper-trading__summary">
          <span>OPEN {report.summary.openCount}</span>
          <span>CLOSED {report.summary.closedCount}</span>
          <span>승률 {report.summary.winRateDisplay}</span>
          <span>OPEN 평균 {report.summary.avgOpenPnlDisplay}</span>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="yds-paper-trading__empty">
          {tab === "OPEN"
            ? "OPEN 포지션이 없습니다. Entry Radar A등급이 있으면 자동 생성됩니다."
            : "청산된 가상매매가 없습니다."}
        </p>
      ) : (
        <div className="yds-paper-trading__table-wrap">
          <table className="yds-paper-trading__table">
            <thead>
              <tr>
                <th scope="col">종목</th>
                <th scope="col">생성일</th>
                <th scope="col">진입일</th>
                <th scope="col" className="yds-paper-trading__num">
                  진입가
                </th>
                <th scope="col" className="yds-paper-trading__num">
                  현재가
                </th>
                <th scope="col" className="yds-paper-trading__num">
                  수익률
                </th>
                <th scope="col" className="yds-paper-trading__num">
                  보유일
                </th>
                <th scope="col" className="yds-paper-trading__num">
                  최대수익
                </th>
                <th scope="col" className="yds-paper-trading__num">
                  최대손실
                </th>
                <th scope="col" className="yds-paper-trading__num">
                  현재수익
                </th>
                <th scope="col">상태</th>
                {tab === "OPEN" ? <th scope="col" /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={`yds-paper-trading__row--${row.status}`}>
                  <td>
                    <span className="yds-paper-trading__name">{row.name}</span>
                    <span className="yds-paper-trading__grade">{row.entryGrade}</span>
                  </td>
                  <td className="yds-paper-trading__date font-mono tabular-nums">{row.createdAt}</td>
                  <td className="yds-paper-trading__date font-mono tabular-nums">{row.entryDate}</td>
                  <td className="yds-paper-trading__num font-mono tabular-nums">{row.entryPriceDisplay}</td>
                  <td className="yds-paper-trading__num font-mono tabular-nums">{row.currentPriceDisplay}</td>
                  <td
                    className={[
                      "yds-paper-trading__num font-mono tabular-nums",
                      row.tone === "up"
                        ? "yds-paper-trading__pct--up"
                        : row.tone === "down"
                          ? "yds-paper-trading__pct--down"
                          : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {row.returnDisplay}
                  </td>
                  <td className="yds-paper-trading__num font-mono tabular-nums">{row.holdingDays}</td>
                  <td className="yds-paper-trading__num yds-paper-trading__pct--up font-mono tabular-nums">
                    {row.maxProfitDisplay}
                  </td>
                  <td className="yds-paper-trading__num yds-paper-trading__pct--down font-mono tabular-nums">
                    {row.maxLossDisplay}
                  </td>
                  <td
                    className={[
                      "yds-paper-trading__num font-mono tabular-nums",
                      row.tone === "up"
                        ? "yds-paper-trading__pct--up"
                        : row.tone === "down"
                          ? "yds-paper-trading__pct--down"
                          : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {row.currentProfitDisplay}
                  </td>
                  <td>
                    <span className={`yds-paper-trading__status yds-paper-trading__status--${row.status}`}>
                      {row.status}
                    </span>
                  </td>
                  {tab === "OPEN" ? (
                    <td>
                      <button
                        type="button"
                        className="yds-paper-trading__close-btn"
                        onClick={() => onClose(row.id)}
                      >
                        청산
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="yds-paper-trading__disclaimer">가상매매 · 실시간 추적 · 백테스트 아님</p>
    </div>
  )
}
