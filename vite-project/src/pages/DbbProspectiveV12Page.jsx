import { useCallback, useEffect, useMemo, useState } from "react"
import { buildRegimeByDate, REGIME_LABEL, REGIME_RULE } from "../content/etfSignalRegimeV3.js"
import { CHART_QUALITY_V12_BASIS } from "../content/dbbChartQualityV12.js"
import {
  PROSPECTIVE_RULE,
  exportProspectiveCsv,
  exportProspectiveJson,
  ingestProspectiveCards,
  loadProspectiveState,
  refreshEventsWithBars,
  saveProspectiveState,
  summarizeProspective,
} from "../content/dbbProspectiveV12.js"
import { fetchDailyBottomBuySnapshot } from "../utils/dailyBottomBuyApi.js"
import { pickDailyBottomAsOfDate } from "../utils/dailyBottomBuyDataBasis.js"
import { fetchProspectiveOhlcv } from "../utils/dbbProspectiveBarsApi.js"

function fmtPct(value, signed = true) {
  if (value == null || !Number.isFinite(Number(value))) return "표본 없음"
  const number = Number(value)
  const sign = signed && number > 0 ? "+" : ""
  return `${sign}${number.toFixed(2)}%`
}

function downloadText(filename, text, type = "application/json") {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function horizonLabel(h) {
  if (!h) return "—"
  if (h.priceReturnStatus === "pending") return "대기"
  if (h.priceReturnStatus !== "complete") return "미완료"
  return fmtPct(h.priceReturnPct)
}

export default function DbbProspectiveV12Page() {
  const [state, setState] = useState(() => loadProspectiveState())
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const summary60 = useMemo(() => summarizeProspective(state, 60), [state])
  const summary20 = useMemo(() => summarizeProspective(state, 20), [state])
  const summary120 = useMemo(() => summarizeProspective(state, 120), [state])

  const persist = useCallback((next) => {
    saveProspectiveState(next)
    setState(next)
  }, [])

  const runObservation = useCallback(async () => {
    setBusy(true)
    setError("")
    setStatus("관측 중…")
    try {
      const snapshot = await fetchDailyBottomBuySnapshot()
      const cards = snapshot?.all || []
      const dataAsOf = pickDailyBottomAsOfDate(cards)
      const result = ingestProspectiveCards(state, cards, {
        universe: "etf",
        observedAt: new Date().toISOString(),
        source: snapshot?.source || "api",
        dataAsOf,
      })
      let next = result.state
      if (result.baselineJustSet) {
        setStatus(
          `기준선 설정 완료 (데이터 기준일 ${dataAsOf || "확인 불가"}). 기존 활성 신호는 전향적 표본에 넣지 않았습니다.`,
        )
      } else {
        setStatus(
          `관측 완료. 신규 ${result.created.length}건 · 건너뜀 ${result.skipped.length}건 · 기준일 ${dataAsOf || "확인 불가"}`,
        )
      }
      persist(next)
    } catch (err) {
      setError(err?.message || "관측에 실패했습니다.")
      setStatus("")
    } finally {
      setBusy(false)
    }
  }, [state, persist])

  const refreshOutcomes = useCallback(async () => {
    setBusy(true)
    setError("")
    setStatus("가격·성과 갱신 중…")
    try {
      const symbols = [...new Set((state.events || []).map((e) => e.symbol).filter(Boolean))]
      if (!symbols.length) {
        setStatus("갱신할 이벤트가 없습니다.")
        return
      }
      const barsBySymbol = {}
      for (const symbol of symbols) {
        const payload = await fetchProspectiveOhlcv(symbol)
        if (payload.ok) barsBySymbol[symbol] = payload.bars
      }
      const qqq = await fetchProspectiveOhlcv("QQQ")
      const qqqBars = qqq.ok ? qqq.bars : null
      let next = refreshEventsWithBars(state, barsBySymbol, qqqBars)
      if (qqqBars?.length) {
        const byDate = buildRegimeByDate(qqqBars)
        next = {
          ...next,
          events: next.events.map((event) => ({
            ...event,
            regime: event.regime || byDate.get(event.signalDate) || null,
            regimeRule: event.regimeRule || {
              market: REGIME_RULE.market,
              asOf: REGIME_RULE.asOf,
            },
          })),
        }
      }
      persist(next)
      setStatus(`성과 갱신 완료. 가격 확인 종목 ${Object.keys(barsBySymbol).length}개.`)
    } catch (err) {
      setError(err?.message || "성과 갱신에 실패했습니다.")
      setStatus("")
    } finally {
      setBusy(false)
    }
  }, [state, persist])

  useEffect(() => {
    setState(loadProspectiveState())
  }, [])

  const events = state.events || []

  return (
    <div className="yds-dbb yds-signal-track min-w-0 w-full">
      <header className="yds-dbb__hero">
        <p className="yds-dbb__kicker">DBB PROSPECTIVE V12</p>
        <h1 className="yds-dbb__title">{CHART_QUALITY_V12_BASIS.title}</h1>
        <p className="yds-dbb__lead">앞으로 새로 관측되는 DBB 신호를 기록하고 결과를 추적합니다.</p>
      </header>

      <aside className="yds-dbb__notice" aria-label="관찰 기준">
        <p>{CHART_QUALITY_V12_BASIS.researchOnly}</p>
        <p>{CHART_QUALITY_V12_BASIS.storage}</p>
        <p>{CHART_QUALITY_V12_BASIS.baseline}</p>
        <p>{CHART_QUALITY_V12_BASIS.caution}</p>
        <p>{PROSPECTIVE_RULE.primaryMetrics.join(" · ")} 을 1차 지표로 고정합니다.</p>
      </aside>

      <section className="yds-dbb-section">
        <h2 className="yds-dbb-section__title">A. 관찰 상태</h2>
        <p className="yds-signal-track__summary">
          시작 {state.meta?.startedAt || "미설정"} · 시작 데이터 기준일 {state.meta?.startedDataAsOf || "확인 불가"} ·
          마지막 성공 관측 {state.meta?.lastSuccessfulObservationAt || "없음"} · 마지막 데이터 기준일{" "}
          {state.meta?.lastDataAsOf || "확인 불가"} · 관측 신호 {events.length}건
        </p>
        {state.meta?.gapWarning ? <p className="yds-dbb__status yds-dbb__status--err">{state.meta.gapWarning}</p> : null}
        <div className="yds-signal-track__actions" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button type="button" className="yds-btn" disabled={busy} onClick={runObservation}>
            관측 실행
          </button>
          <button type="button" className="yds-btn" disabled={busy || !events.length} onClick={refreshOutcomes}>
            진입·성과 갱신
          </button>
          <button
            type="button"
            className="yds-btn"
            disabled={!events.length}
            onClick={() => downloadText("dbb-prospective-v12.json", exportProspectiveJson(state))}
          >
            JSON 내보내기
          </button>
          <button
            type="button"
            className="yds-btn"
            disabled={!events.length}
            onClick={() => downloadText("dbb-prospective-v12.csv", exportProspectiveCsv(state), "text/csv")}
          >
            CSV 내보내기
          </button>
        </div>
        {status ? <p className="yds-dbb__status">{status}</p> : null}
        {error ? <p className="yds-dbb__status yds-dbb__status--err">{error}</p> : null}
      </section>

      <section className="yds-dbb-section">
        <h2 className="yds-dbb-section__title">C. 성과 요약 (1차 · T+60)</h2>
        <p className="yds-signal-track__summary">
          이벤트 {summary60.events} · 진입확정 {summary60.withEntry} · 완성 {summary60.complete} · 미완성{" "}
          {summary60.incomplete} · 진입대기 {summary60.pendingEntry}
          {summary60.unstable ? " · 표본 부족(불안정)" : ""}
        </p>
        <div className="yds-dbb-research__scroll">
          <table className="yds-dbb-research__table yds-signal-track__table">
            <thead>
              <tr>
                <th scope="col">지표</th>
                <th scope="col">값</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">T+60 중앙값</th>
                <td className="tabular-nums">{fmtPct(summary60.priceMedian)}</td>
              </tr>
              <tr>
                <th scope="row">T+60 양수 비율</th>
                <td className="tabular-nums">{fmtPct(summary60.positiveRate, false)}</td>
              </tr>
              <tr>
                <th scope="row">T+60 QQQ 초과 중앙값</th>
                <td className="tabular-nums">{fmtPct(summary60.excessQqqMedian)}</td>
              </tr>
              <tr>
                <th scope="row">T+60 MAE 중앙값</th>
                <td className="tabular-nums">{fmtPct(summary60.maeMedian, false)}</td>
              </tr>
              <tr>
                <th scope="row">T+20 중앙값 (2차)</th>
                <td className="tabular-nums">{fmtPct(summary20.priceMedian)}</td>
              </tr>
              <tr>
                <th scope="row">T+120 중앙값 (2차)</th>
                <td className="tabular-nums">{fmtPct(summary120.priceMedian)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="yds-signal-track__summary">
          보조 3개 충족 n={summary60.byCount.three.n} 중앙값 {fmtPct(summary60.byCount.three.priceMedian)} · 4개
          충족 n={summary60.byCount.four.n} 중앙값 {fmtPct(summary60.byCount.four.priceMedian)}. 국면별은 원본 기록의
          regime 필드를 참고합니다({Object.keys(REGIME_LABEL).join("/")}).
        </p>
      </section>

      <section className="yds-dbb-section">
        <h2 className="yds-dbb-section__title">B·D. 신규 신호 · 원본 기록</h2>
        <div className="yds-dbb-research__scroll">
          <table className="yds-dbb-research__table yds-signal-track__table">
            <thead>
              <tr>
                <th scope="col">종목</th>
                <th scope="col">신호일</th>
                <th scope="col">충족</th>
                <th scope="col">최초 관측</th>
                <th scope="col">진입</th>
                <th scope="col">T+20</th>
                <th scope="col">T+60</th>
                <th scope="col">T+120</th>
                <th scope="col">국면</th>
              </tr>
            </thead>
            <tbody>
              {!events.length ? (
                <tr>
                  <td colSpan={9}>아직 전향적 이벤트가 없습니다. 먼저 관측 실행으로 기준선을 설정하세요.</td>
                </tr>
              ) : (
                [...events]
                  .sort((a, b) => String(b.signalDate).localeCompare(String(a.signalDate)))
                  .map((event) => (
                    <tr key={event.eventId}>
                      <th scope="row">{event.symbol}</th>
                      <td className="tabular-nums">{event.signalDate}</td>
                      <td className="tabular-nums">{event.signalCount}/4</td>
                      <td className="tabular-nums">{event.firstObservedAt?.slice(0, 19) || "—"}</td>
                      <td className="tabular-nums">
                        {event.entryStatus === "confirmed"
                          ? `${event.entryDate} · ${event.entryPrice}`
                          : event.entryStatus}
                      </td>
                      <td className="tabular-nums">{horizonLabel(event.horizons?.["20"])}</td>
                      <td className="tabular-nums">{horizonLabel(event.horizons?.["60"])}</td>
                      <td className="tabular-nums">{horizonLabel(event.horizons?.["120"])}</td>
                      <td>{event.regime ? REGIME_LABEL[event.regime] || event.regime : "—"}</td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
