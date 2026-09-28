import { useEffect, useMemo, useState } from "react"
import { fetchEquityDailyBottomBuy } from "../utils/equityDailyBottomBuyApi.js"

const DEFAULT_SYMBOL = "MSFT"

function formatPrice(v) {
  if (v == null || !Number.isFinite(Number(v))) return null
  return Number(v).toFixed(2)
}

function formatCondition(row) {
  if (row?.value == null || !Number.isFinite(Number(row.value))) return null
  const n = Number(row.value)
  if (row.id === "bb") return n.toFixed(2)
  if (row.id === "ma20") return `${n.toFixed(1)}%`
  return n.toFixed(1)
}

function formatAtr(v) {
  if (v == null || !Number.isFinite(Number(v))) return null
  return `${Number(v).toFixed(2)}%`
}

export default function EquityDailyBottomBuyPage() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL)
  const [group, setGroup] = useState("all")
  const [query, setQuery] = useState("")
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    fetchEquityDailyBottomBuy(symbol, { signal: ctrl.signal })
      .then((json) => {
        if (!ctrl.signal.aborted) setPayload(json)
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return
        setPayload({ ok: false, message: err?.message || "데이터 준비 중", universe: [], view: null })
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false)
      })
    return () => ctrl.abort()
  }, [symbol])

  const universe = payload?.universe || []
  const groups = useMemo(() => {
    const seen = []
    for (const row of universe) {
      if (row.group && !seen.includes(row.group)) seen.push(row.group)
    }
    return seen
  }, [universe])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return universe.filter((row) => {
      if (group !== "all" && row.group !== group) return false
      if (!q) return true
      return row.symbol.toLowerCase().includes(q) || String(row.name || "").toLowerCase().includes(q)
    })
  }, [universe, group, query])

  const options = visible.some((row) => row.symbol === symbol)
    ? visible
    : [universe.find((row) => row.symbol === symbol), ...visible].filter(Boolean)

  const view = payload?.view
  const priceText = formatPrice(view?.price)
  const atrText = formatAtr(view?.atrPct)

  return (
    <div className="yds-dbb min-w-0 w-full">
      <header className="yds-dbb__hero">
        <p className="yds-dbb__kicker">EQUITY DAILY BOTTOM BUY</p>
        <h1 className="yds-dbb__title">개별 종목 Daily Bottom Buy</h1>
        <p className="yds-dbb__lead">개별 종목의 조정/과매도 상태를 확인하는 READ-ONLY 화면</p>
      </header>

      <section className="yds-dbb-card mb-3">
        <h2 className="yds-dbb-section__title">종목 선택</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="block text-xs text-slate-400">
            그룹
            <select
              className="mt-1 w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            >
              <option value="all">전체</option>
              {groups.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-slate-400">
            검색
            <input
              className="mt-1 w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
              value={query}
              placeholder="티커 또는 이름"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        <label className="mt-2 block text-xs text-slate-400">
          종목
          <select
            className="mt-1 w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
          >
            {options.map((row) => (
              <option key={row.symbol} value={row.symbol}>
                {row.symbol} {row.name}
              </option>
            ))}
          </select>
        </label>
        {universe.length > 0 && visible.length === 0 ? (
          <p className="yds-dbb__status">검색 결과가 없습니다.</p>
        ) : null}
      </section>

      {loading && <p className="yds-dbb__status">불러오는 중…</p>}

      {!loading && (!view || !view.ok) ? (
        <p className="yds-dbb__status" role="status">
          {view?.message || payload?.message || "데이터 준비 중"}
        </p>
      ) : null}

      {!loading && view?.ok ? (
        <>
          <section className="yds-dbb-card mb-3">
            <h2 className="yds-dbb-section__title">현재 상태</h2>
            <p className="yds-dbb-card__ticker mt-2">
              {view.name}
              <span className="yds-dbb-card__theme-inline"> {view.symbol}</span>
            </p>
            <p className="yds-dbb__meta">{view.group}</p>
            <p className="mt-2 text-lg font-semibold tabular-nums text-slate-50">{priceText}</p>
            <p className="yds-dbb__meta">기준일 {view.asOf}</p>
            {view.source === "cache" ? <p className="yds-dbb__meta">저장된 시세 기준</p> : null}
          </section>

          <section className={`yds-dbb-card mb-3 yds-dbb-card--${view.state?.id === "strongLow" ? "strong" : view.state?.id === "firstBuy" ? "primary" : view.state?.id === "interest" ? "watch" : "wait"}`}>
            <h2 className="yds-dbb-section__title">DBB SCORE</h2>
            <p className="yds-dbb-card__count mt-2 text-2xl">{view.score} / 4</p>
            <p className="yds-dbb-card__stage">{view.state?.label}</p>
            {view.state?.detail ? <p className="yds-dbb-card__hint">{view.state.detail}</p> : null}
          </section>

          <section className="yds-dbb-card mb-3">
            <h2 className="yds-dbb-section__title">4 CONDITIONS</h2>
            <ul className="mt-2 space-y-2">
              {view.conditions.map((row) => {
                const valueText = formatCondition(row)
                return (
                  <li key={row.id} className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="yds-dbb-metric__label w-24 shrink-0">{row.label}</span>
                    <span className={`tabular-nums ${row.pass ? "yds-dbb-metric__value is-ok" : "yds-dbb-metric__value"}`}>
                      {valueText ?? "—"}
                    </span>
                    <span className="yds-dbb-metric__label">{row.thresholdText}</span>
                    <span aria-label={row.pass ? "충족" : "미충족"}>{row.pass ? "✓" : "✕"}</span>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="yds-dbb-card mb-3">
            <h2 className="yds-dbb-section__title">ATR RISK</h2>
            <p className="mt-2 text-lg font-semibold tabular-nums text-slate-50">{atrText}</p>
            <p className="yds-dbb-card__stage">{view.atrRisk?.label}</p>
            <p className="yds-dbb-card__hint">{view.atrNote}</p>
            <p className="yds-dbb-card__hint">{view.atrMeaning}</p>
          </section>

          <section className="yds-dbb__notice" aria-label="해석">
            <p>{view.state?.reading}</p>
            <p>{view.note}</p>
          </section>
        </>
      ) : null}
    </div>
  )
}
