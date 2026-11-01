import { useEffect, useMemo, useState } from "react"
import { fetchDailyBottomBuySnapshot } from "../utils/dailyBottomBuyApi.js"
import { provisionalSignals, SIGNAL_TRACK_PATH } from "../content/etfSignalTrack.js"

const HORIZONS = [20, 60, 120]

function fmtPrice(value) {
  if (value == null || !Number.isFinite(Number(value))) return "—"
  return Number(value).toFixed(2)
}

function fmtSignedPct(value) {
  if (value == null || !Number.isFinite(Number(value))) return null
  const number = Number(value)
  const sign = number > 0 ? "+" : ""
  return `${sign}${number.toFixed(2)}%`
}

function fmtDrawdown(value) {
  if (value == null || !Number.isFinite(Number(value))) return null
  return `-${Number(value).toFixed(2)}%`
}

const PNL_LABEL = { profit: "이익", loss: "손실", flat: "보합" }
const ORIGIN_LABEL = { new: "신규", historical: "과거" }
const RECOVERY_LABEL = {
  recovered: "회복",
  open: "미회복",
  incomplete: "미완료",
  unavailable: "미확정",
}

function HorizonCell({ horizon }) {
  if (!horizon || horizon.priceReturnStatus !== "complete") {
    return <span className="yds-signal-track__pending">미완료</span>
  }
  return (
    <span className="yds-signal-track__horizon">
      <span>가격 {fmtSignedPct(horizon.priceReturnPct)}</span>
      <span>{horizon.totalReturnStatus === "complete" ? `총 ${fmtSignedPct(horizon.totalReturnPct)}` : "총수익 산출 불가"}</span>
      <span>{PNL_LABEL[horizon.pnl] || "—"}</span>
      <span>
        {horizon.maxDrawdownStatus === "complete" ? `하락 ${fmtDrawdown(horizon.maxDrawdownPct)}` : "하락 미완료"}
      </span>
    </span>
  )
}

function RecoveryCell({ recovery }) {
  if (!recovery || recovery.status === "unavailable") return "미확정"
  if (recovery.status === "recovered") return `${recovery.tradingDays}거래일`
  if (recovery.status === "open") return "미회복"
  return "미완료"
}

export default function EtfSignalTrackPage() {
  const [report, setReport] = useState(null)
  const [liveCards, setLiveCards] = useState(null)
  const [liveNote, setLiveNote] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [originFilter, setOriginFilter] = useState("all")

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    fetch(SIGNAL_TRACK_PATH, { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error("연구 기록을 불러오지 못했습니다.")
        return res.json()
      })
      .then((json) => setReport(json))
      .catch((err) => {
        if (err?.name === "AbortError") return
        setError(err?.message || "연구 기록을 불러오지 못했습니다.")
      })
      .finally(() => setLoading(false))

    fetchDailyBottomBuySnapshot({ signal: ctrl.signal })
      .then((payload) => {
        setLiveCards(payload?.all || [])
        setLiveNote("")
      })
      .catch((err) => {
        if (err?.name === "AbortError") return
        setLiveNote("실시간 시세를 확인하지 못했습니다. 저장된 연구 기록만 표시합니다.")
      })

    return () => ctrl.abort()
  }, [])

  const provisional = useMemo(
    () => provisionalSignals(liveCards, report?.episodes || []),
    [liveCards, report],
  )
  const rows = useMemo(() => {
    const combined = [...(report?.episodes || []), ...provisional]
    const filtered = combined.filter((episode) => originFilter === "all" || episode.origin === originFilter)
    return filtered.sort((a, b) => String(b.signalDate).localeCompare(String(a.signalDate)) || String(a.symbol).localeCompare(String(b.symbol)))
  }, [report, provisional, originFilter])

  const basis = report?.basis
  const summary = report?.summary

  return (
    <div className="yds-dbb yds-signal-track min-w-0 w-full">
      <header className="yds-dbb__hero">
        <p className="yds-dbb__kicker">ETF SIGNAL TRACK</p>
        <h1 className="yds-dbb__title">ETF 매수 신호 추적</h1>
        <p className="yds-dbb__lead">실제 발생한 ETF 매수 신호의 이후 수익률과 하락 폭을 보는 연구 화면입니다.</p>
      </header>

      <aside className="yds-dbb__notice" aria-label="연구 기준">
        <p>연구 전용입니다. 매수 카드, 매수 기록, 주문과는 분리되어 있습니다.</p>
        {basis ? (
          <>
            <p>{basis.entry}</p>
            <p>{basis.priceReturn}</p>
            <p>{basis.totalReturn}</p>
            <p>{basis.missing}</p>
          </>
        ) : null}
      </aside>

      {loading && <p className="yds-dbb__status">불러오는 중…</p>}
      {error && <p className="yds-dbb__status yds-dbb__status--err">{error}</p>}
      {liveNote ? <p className="yds-dbb__meta">{liveNote}</p> : null}

      {summary ? (
        <div className="yds-signal-track__summary">
          <p>기록 {summary.episodes}건 · 과거 {summary.historical} · 신규 {summary.newSignals} · 진입 미확정 {summary.pendingEntry}</p>
          <p>
            {HORIZONS.map((days) => {
              const row = summary.horizons?.[String(days)]
              const median = fmtSignedPct(row?.medianPriceReturnPct)
              return ` ${days}거래일 완료 ${row?.complete ?? 0} · 미완료 ${row?.incomplete ?? 0} · 완료분 중앙값 ${median || "—"}`
            }).join(" / ")}
          </p>
          {provisional.length ? <p>실시간으로 아직 파일에 없는 신호 {provisional.length}건은 진입 미확정입니다.</p> : null}
        </div>
      ) : null}

      {report ? (
        <>
          <div className="yds-signal-track__filters" role="group" aria-label="신호 구분">
            {[
              ["all", "전체"],
              ["new", "신규"],
              ["historical", "과거"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`yds-signal-track__filter${originFilter === id ? " is-on" : ""}`}
                onClick={() => setOriginFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="yds-dbb-research__scroll">
            <table className="yds-dbb-research__table yds-signal-track__table">
              <thead>
                <tr>
                  <th scope="col">신호일</th>
                  <th scope="col">구분</th>
                  <th scope="col">종목</th>
                  <th scope="col">충족</th>
                  <th scope="col">진입</th>
                  {HORIZONS.map((days) => (
                    <th key={days} scope="col">{days}거래일</th>
                  ))}
                  <th scope="col">회복</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((episode) => (
                  <tr key={episode.id}>
                    <td>{episode.signalDate}</td>
                    <td>{episode.provisional ? "실시간" : ORIGIN_LABEL[episode.origin] || episode.origin}</td>
                    <td>
                      {episode.symbol}
                      <span className="yds-signal-track__name"> {episode.themeShort}</span>
                    </td>
                    <td>{episode.count}/4</td>
                    <td>
                      {episode.entryStatus === "confirmed" ? fmtPrice(episode.entryPrice) : "미확정"}
                    </td>
                    {HORIZONS.map((days) => (
                      <td key={days}>
                        <HorizonCell horizon={episode.horizons?.[String(days)] || episode.horizons?.[days]} />
                      </td>
                    ))}
                    <td>
                      {RECOVERY_LABEL[episode.recovery?.status] ? <RecoveryCell recovery={episode.recovery} /> : "미완료"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length ? <p className="yds-dbb__status">표시할 신호가 없습니다.</p> : null}
          <p className="yds-dbb-card__hint">가격 수익률과 분배금을 포함한 총수익률을 구분합니다. 총수익률을 계산할 수 없으면 산출 불가로 표시하며 추정하지 않습니다.</p>
        </>
      ) : null}
    </div>
  )
}
