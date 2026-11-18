import { useEffect, useMemo, useState } from "react"
import { averageTradeBuyPrice, listTradeRecords, tradeReturnPct, TRADE_RECORDS_CHANGED_EVENT } from "../../content/ydsTradeRecords.js"
import YdsProFeatureGate from "./YdsProFeatureGate.jsx"
import { EQUITY_RESEARCH_SUMMARY as study } from "../../content/equityResearchSummary.js"
import {
  buildEquityDailyBottomBuyVisibility,
  EQUITY_DBB_PRO_LOCK_COPY,
} from "../../content/ydsEquityDailyBottomBuyProGate.js"
import { useMembership } from "../../context/MembershipContext.jsx"
import {
  applyEquityDailyBottomBuyAccess,
  fetchEquityDailyBottomBuy,
} from "../../utils/equityDailyBottomBuyApi.js"
import { fetchStockIndicators } from "../../utils/stockIndicatorsApi.js"

function usd(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return "—"
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function signedPct(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return "—"
  const rounded = Math.round(n * 10) / 10
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}%`
}

function quoteTone(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || Math.abs(n) < 0.05) return ""
  return n > 0 ? "is-rise" : "is-fall"
}

function axisPrice(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return ""
  return n >= 100 ? n.toFixed(0) : n.toFixed(2)
}

function chartDate(value) {
  const text = String(value || "")
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}.${iso[2]}.${iso[3]}`
  const compact = text.replace(/\D/g, "").slice(0, 8)
  if (/^\d{8}$/.test(compact)) return `${compact.slice(0, 4)}.${compact.slice(4, 6)}.${compact.slice(6, 8)}`
  return text.slice(0, 10)
}

function CandleChart({ bars }) {
  const rows = (Array.isArray(bars) ? bars : []).filter(
    (bar) =>
      Number.isFinite(Number(bar?.open)) &&
      Number.isFinite(Number(bar?.high)) &&
      Number.isFinite(Number(bar?.low)) &&
      Number.isFinite(Number(bar?.close)),
  )
  if (rows.length < 2) return <p className="yds-risk-stock__empty">캔들 봉을 받지 못했습니다.</p>
  const slice = rows.slice(-80)
  const min = Math.min(...slice.map((bar) => Number(bar.low)))
  const max = Math.max(...slice.map((bar) => Number(bar.high)))
  const span = max - min || 1
  const vbW = 640
  const vbH = 280
  const padL = 16
  const padR = 68
  const padT = 16
  const padB = 32
  const plotW = vbW - padL - padR
  const plotH = vbH - padT - padB
  const slot = plotW / slice.length
  const yOf = (price) => padT + (1 - (Number(price) - min) / span) * plotH
  const ticks = [max, min + span / 2, min]
  const firstDate = chartDate(slice[0]?.date)
  const midBar = slice[Math.floor((slice.length - 1) / 2)]
  const midDate = chartDate(midBar?.date)
  const lastDate = chartDate(slice[slice.length - 1]?.date)
  const lastClose = Number(slice[slice.length - 1]?.close)
  return (
    <svg className="yds-risk-stock__candles" viewBox={`0 0 ${vbW} ${vbH}`} role="img" aria-label="일봉 캔들">
      <rect x={padL} y={padT} width={plotW} height={plotH} fill="#0a1326" rx="8" />
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={padL} x2={padL + plotW} y1={yOf(tick)} y2={yOf(tick)} stroke="rgba(186,198,220,0.28)" strokeWidth="1" />
          <text x={padL + plotW + 8} y={yOf(tick) + 4} fill="#b7c3d6" fontSize="13">
            {axisPrice(tick)}
          </text>
        </g>
      ))}
      {Number.isFinite(lastClose) ? (
        <line
          x1={padL}
          x2={padL + plotW}
          y1={yOf(lastClose)}
          y2={yOf(lastClose)}
          stroke="#7c3aed"
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />
      ) : null}
      {slice.map((bar, index) => {
        const open = Number(bar.open)
        const close = Number(bar.close)
        const up = close >= open
        const color = up ? "#3ddc84" : "#ff6b6b"
        const x = padL + index * slot + slot / 2
        const bodyW = Math.max(slot * 0.62, 2.2)
        return (
          <g key={`${bar.date || index}`}>
            <line x1={x} x2={x} y1={yOf(bar.high)} y2={yOf(bar.low)} stroke={color} strokeWidth="1.4" />
            <rect
              x={x - bodyW / 2}
              y={Math.min(yOf(open), yOf(close))}
              width={bodyW}
              height={Math.max(Math.abs(yOf(open) - yOf(close)), 1.4)}
              fill={color}
              rx="0.6"
            />
          </g>
        )
      })}
      {firstDate ? (
        <text x={padL} y={vbH - 8} fill="#b7c3d6" fontSize="12">
          {firstDate}
        </text>
      ) : null}
      {midDate && midDate !== firstDate && midDate !== lastDate ? (
        <text x={padL + plotW / 2} y={vbH - 8} fill="#b7c3d6" fontSize="12" textAnchor="middle">
          {midDate}
        </text>
      ) : null}
      {lastDate ? (
        <text x={padL + plotW} y={vbH - 8} fill="#b7c3d6" fontSize="12" textAnchor="end">
          {lastDate}
        </text>
      ) : null}
    </svg>
  )
}

export default function YdsRiskStockDesk() {
  const { detailAccess, authReady, isLoading: membershipLoading } = useMembership()
  const analysisAllowed = detailAccess === true
  const visibility = useMemo(
    () => buildEquityDailyBottomBuyVisibility(analysisAllowed),
    [analysisAllowed],
  )
  const [universe, setUniverse] = useState([])
  const [symbol, setSymbol] = useState("")
  const [view, setView] = useState(null)
  const [stock, setStock] = useState(null)
  const [viewStatus, setViewStatus] = useState("loading")
  const [chartStatus, setChartStatus] = useState("loading")
  const [chartTab, setChartTab] = useState("chart")
  const [recordsVersion, setRecordsVersion] = useState(0)

  useEffect(() => {
    const onChange = () => setRecordsVersion((value) => value + 1)
    window.addEventListener(TRADE_RECORDS_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(TRADE_RECORDS_CHANGED_EVENT, onChange)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchEquityDailyBottomBuy("")
      .then((payload) => {
        if (cancelled) return
        const rows = Array.isArray(payload?.universe) ? payload.universe.filter((row) => row?.symbol) : []
        setUniverse(rows)
        setSymbol((current) => current || rows.find((row) => row.symbol === "AMZN")?.symbol || rows[0]?.symbol || "")
      })
      .catch(() => {
        if (!cancelled) setUniverse([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!symbol || !authReady || membershipLoading) return undefined
    let cancelled = false
    const name = universe.find((row) => row.symbol === symbol)?.name
    setViewStatus("loading")
    setChartStatus("loading")
    setView(null)
    setStock(null)
    fetchEquityDailyBottomBuy(symbol)
      .then((payload) => {
        if (cancelled) return
        const gated = applyEquityDailyBottomBuyAccess(payload, analysisAllowed)
        setView(gated?.view || null)
        setViewStatus(gated?.view ? "ready" : "empty")
      })
      .catch(() => {
        if (!cancelled) setViewStatus("empty")
      })
    fetchStockIndicators({ code: symbol, name })
      .then((payload) => {
        if (cancelled) return
        setStock(payload || null)
        setChartStatus(payload?.chart?.bars?.length ? "ready" : "empty")
      })
      .catch(() => {
        if (!cancelled) {
          setStock(null)
          setChartStatus("empty")
        }
      })
    return () => {
      cancelled = true
    }
  }, [symbol, universe, authReady, membershipLoading, analysisAllowed])

  const selected = universe.find((row) => row.symbol === symbol) || null
  const quote = stock?.priceSummary?.todayClose ?? stock?.price ?? null
  const price = quote ?? (visibility.proPrice ? view?.price : null)
  const changePct = stock?.priceSummary?.changePct
  const conditions = Array.isArray(view?.conditions) ? view.conditions : []
  const narrative = stock?.narrative && typeof stock.narrative === "object" ? stock.narrative : null
  const reading = visibility.proReading ? view?.state?.reading || view?.note || "" : ""
  const stage = visibility.proScoreExtras ? view?.state?.detail || view?.state?.label : view?.state?.label
  const buys = useMemo(() => (symbol ? listTradeRecords("dbb", symbol) : []), [symbol, recordsVersion])
  const avgBuy = averageTradeBuyPrice(buys)
  const holdingReturn = tradeReturnPct(avgBuy, price)

  return (
    <section className="yds-risk-stock" aria-label="종목 분석">
      <div className="yds-risk-stock__main">
        <header className="yds-risk-stock__head">
          <div>
            <h2>추이 및 매수 신호{selected ? ` · ${selected.symbol}` : ""}</h2>
            <p>{selected?.name || view?.name || "개별 종목 조정매매 차트 · 신호"}</p>
          </div>
          <label>
            종목
            <select value={symbol} onChange={(event) => setSymbol(event.target.value)} disabled={!universe.length}>
              {!universe.length ? <option value="">목록 없음</option> : null}
              {universe.map((row) => (
                <option key={row.symbol} value={row.symbol}>
                  {row.symbol} · {row.name || row.symbol}
                </option>
              ))}
            </select>
          </label>
        </header>
        {!symbol ? (
          <p className="yds-risk-stock__empty">종목 목록을 불러오지 못했습니다.</p>
        ) : (
          <>
            <div className="yds-risk-stock__quote">
              <p className="yds-risk-stock__price">
                <strong>{price == null ? "시세 없음" : usd(price)}</strong>
                {Number.isFinite(Number(changePct)) ? (
                  <span className={quoteTone(changePct)}>{signedPct(changePct)}</span>
                ) : (
                  <span>등락률 없음</span>
                )}
              </p>
              <p className="yds-risk-stock__meta">{view?.asOf ? `기준일 ${view.asOf}` : "기준일 없음"}</p>
            </div>
            <p className="yds-risk-stock__status">매수 전략 상태 · {stage || "—"}</p>
            <div className="yds-risk-stock__signals">
              <p>
                <span>매수 신호</span>
                <strong>{view?.score != null ? `${view.score} / 4` : "—"}</strong>
              </p>
              <p>
                <span>현재 단계</span>
                <strong>{stage || "—"}</strong>
              </p>
              <p>
                <span>평균 매수가</span>
                <strong>{avgBuy == null ? "기록 없음" : usd(avgBuy)}</strong>
              </p>
              <p>
                <span>현재 수익률</span>
                <strong className={quoteTone(holdingReturn)}>{holdingReturn == null ? "기록 없음" : signedPct(holdingReturn)}</strong>
              </p>
            </div>
            <div className="yds-risk-stock__tabs" role="tablist" aria-label="종목 차트 보기">
              {[
                ["chart", "차트"],
                ["indicators", "지표"],
                ["zone", "매수 구간"],
                ["history", "과거 신호"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={chartTab === id}
                  className={chartTab === id ? "is-active" : undefined}
                  onClick={() => setChartTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="yds-risk-stock__plot">
              {chartTab !== "chart" ? (
                <p className="yds-risk-stock__empty">이 탭에 연결된 데이터가 없습니다.</p>
              ) : chartStatus === "loading" ? (
                <p className="yds-risk-stock__empty">캔들을 불러오는 중입니다.</p>
              ) : (
                <CandleChart bars={stock?.chart?.bars} />
              )}
            </div>
            {viewStatus === "empty" ? <p className="yds-risk-stock__empty">{view?.message || "종목 신호를 받지 못했습니다."}</p> : null}
          </>
        )}
      </div>
      <div className="yds-risk-stock__side">
        <article className="yds-risk-stock__card yds-risk-stock__card--ai">
          <header>
            <h3>AI 종목 인사이트</h3>
            <span className="yds-ai-badge">PRO</span>
          </header>
          <YdsProFeatureGate
            unlocked={visibility.proReading}
            className="yds-risk-stock__lock"
            title={EQUITY_DBB_PRO_LOCK_COPY.title}
            body="조정매매 해석 문장은 PRO에서 열립니다."
          >
            {reading ? <p className="yds-risk-stock__reading">{reading}</p> : <p className="yds-risk-stock__empty">저장된 해석 문장이 없습니다.</p>}
          </YdsProFeatureGate>
          {narrative ? (
            <ul className="yds-risk-stock__insight">
              <li>
                <span>상태</span>
                {narrative.status}
              </li>
              <li>
                <span>위치</span>
                {narrative.position}
              </li>
              <li>
                <span>흐름</span>
                {narrative.flow}
              </li>
            </ul>
          ) : chartStatus === "empty" ? (
            <p className="yds-risk-stock__empty">시세 인사이트를 받지 못했습니다.</p>
          ) : null}
        </article>
        <article className="yds-risk-stock__card yds-risk-stock__card--signals">
          <header>
            <h3>매수 전략 신호</h3>
            <span>DBB 조건</span>
          </header>
          <YdsProFeatureGate
            unlocked={visibility.proConditions}
            className="yds-risk-stock__lock"
            title={EQUITY_DBB_PRO_LOCK_COPY.title}
            body="조건별 수치와 충족 여부는 PRO에서 열립니다."
          >
            {conditions.length ? (
              <div className="yds-risk-stock__table-wrap">
                <table className="yds-risk-stock__table">
                  <thead>
                    <tr>
                      <th scope="col">지표</th>
                      <th scope="col">현재값</th>
                      <th scope="col">판정</th>
                      <th scope="col">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conditions.map((row) => (
                      <tr key={row.id} className={row.pass ? "is-pass" : "is-fail"}>
                        <th scope="row">
                          <strong>{row.label}</strong>
                          {row.thresholdText ? <em>{row.thresholdText}</em> : null}
                        </th>
                        <td className="font-mono tabular-nums">
                          {row.value == null ? "—" : `${row.value}${row.unit || ""}`}
                        </td>
                        <td aria-hidden>{row.pass ? "✓" : "✕"}</td>
                        <td>
                          <span className="yds-risk-stock__chip">{row.pass ? "충족" : "미충족"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="yds-risk-stock__empty">조건 수치를 받지 못했습니다.</p>
            )}
          </YdsProFeatureGate>
          <aside className="yds-risk-stock__next">
            <h4>다음 액션</h4>
            {conditions.length ? (
              <ul className="yds-risk-stock__next-list">
                {conditions.filter((row) => !row.pass).length ? (
                  conditions
                    .filter((row) => !row.pass)
                    .map((row) => (
                      <li key={row.id}>
                        <span className="yds-risk-stock__next-mark" aria-hidden>
                          ○
                        </span>
                        {row.label} 미충족
                        {row.thresholdText ? ` · ${row.thresholdText}` : ""}
                        {row.value != null ? ` (현재 ${row.value}${row.unit || ""})` : ""}
                      </li>
                    ))
                ) : (
                  <li>
                    <span className="yds-risk-stock__next-mark is-done" aria-hidden>
                      ✓
                    </span>
                    저장된 DBB 조건이 모두 충족되었습니다. 자동 주문은 없습니다.
                  </li>
                )}
              </ul>
            ) : (
              <p className="yds-risk-stock__empty">저장된 다음 행동이 없습니다.</p>
            )}
          </aside>
        </article>
        <article className="yds-risk-stock__card yds-risk-stock__card--study">
          <header>
            <h3>전략 연구 성과</h3>
            <span>공개 연구 요약</span>
          </header>
          <p className="yds-risk-stock__study-note">
            공개된 조정매매 연구 전체입니다. 선택한 종목의 유사 사례·개별 백테스트 곡선이 아닙니다.
          </p>
          <p className="yds-risk-stock__meta">
            {study.period} · {study.episodes.toLocaleString("en-US")}건
          </p>
          <div className="yds-risk-stock__stats yds-risk-stock__stats--kpi">
            <p>
              <span>T+20 평균</span>
              <strong className={quoteTone(study.buy.T20.mean)}>{signedPct(study.buy.T20.mean)}</strong>
            </p>
            <p>
              <span>T+60 평균</span>
              <strong className={quoteTone(study.buy.T60.mean)}>{signedPct(study.buy.T60.mean)}</strong>
            </p>
            <p>
              <span>추가 저점 평균</span>
              <strong className={quoteTone(study.buyLimitation.postBuyLowMean)}>{signedPct(study.buyLimitation.postBuyLowMean)}</strong>
            </p>
            <p>
              <span>저점까지 평균</span>
              <strong>{study.buyLimitation.lowMeanDay}일</strong>
            </p>
          </div>
        </article>
      </div>
    </section>
  )
}
