import { useEffect, useMemo, useRef, useState } from "react"
import EquityResearchPanel from "../components/equity/EquityResearchPanel.jsx"
import DbbBuyProgressSection from "../components/trade-records/DbbBuyProgressSection.jsx"
import TradeRecordEditor from "../components/trade-records/TradeRecordEditor.jsx"
import { collectDbbBuyProgress, equityViewProgressEntry } from "../content/ydsDbbBuyProgress.js"
import { TRADE_RECORDS_CHANGED_EVENT } from "../content/ydsTradeRecords.js"
import { fetchEquityDailyBottomBuy } from "../utils/equityDailyBottomBuyApi.js"
import { equityCandidateConditionType, selectEquityBuyCandidates } from "../utils/equityDailyBottomBuyCandidates.js"
import {
  closeTickerPicker,
  EQUITY_SUMMARY_PREVIEW_COUNT,
  equityResearchDisplayList,
  equitySummaryRow,
  equitySummaryToggleLabel,
  equitySummaryVisibleRows,
  equityTickerLabel,
  initialTickerPickerState,
  toggleTickerPicker,
  visibleResearchStocks,
} from "../utils/equityResearchDisplay.js"

const DEFAULT_SYMBOL = "AMZN"

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

function formatDd120(v) {
  if (v == null || !Number.isFinite(Number(v))) return null
  return `${Number(v).toFixed(2)}%`
}

const CONDITION_SHORT_LABEL = {
  rsi: "RSI",
  stoch: "Stoch",
  bb: "BB",
  ma20: "MA20",
}

function CandidateFacts({ row }) {
  const conditions = Array.isArray(row.conditions) ? row.conditions : []
  const price = formatPrice(row.price)
  return (
    <dl className="yds-dbb-cand__metrics">
      <div>
        <dt>현재가</dt>
        <dd>{price != null ? `$${price}` : "—"}</dd>
      </div>
      {conditions.map((item) => (
        <div key={item.id}>
          <dt>{CONDITION_SHORT_LABEL[item.id] || item.label}</dt>
          <dd>{formatCondition(item) ?? "—"}</dd>
        </div>
      ))}
      <div>
        <dt>ATR</dt>
        <dd>{formatAtr(row.atrPct) ?? "—"}</dd>
      </div>
    </dl>
  )
}

export default function EquityDailyBottomBuyPage() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL)
  const [group, setGroup] = useState("all")
  const [query, setQuery] = useState("")
  const [picker, setPicker] = useState(initialTickerPickerState)
  const pickerRef = useRef(null)
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [candidates, setCandidates] = useState(null)
  const [candidateAsOf, setCandidateAsOf] = useState(null)
  const [signalViews, setSignalViews] = useState(null)
  const [extraViews, setExtraViews] = useState(null)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [recordsVersion, setRecordsVersion] = useState(0)

  useEffect(() => {
    const onChange = () => setRecordsVersion((n) => n + 1)
    window.addEventListener(TRADE_RECORDS_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(TRADE_RECORDS_CHANGED_EVENT, onChange)
  }, [])

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
  const universeKey = universe.map((row) => row.symbol).join("|")
  const catalog = useMemo(() => equityResearchDisplayList(universe), [universe])

  useEffect(() => {
    if (!universe.length) return undefined
    const symbols = universe.map((row) => row.symbol)
    const ctrl = new AbortController()
    let cancelled = false
    setCandidates(null)
    setCandidateAsOf(null)
    setSignalViews(null)

    async function worker(cursor) {
      const views = []
      while (cursor.i < symbols.length) {
        const index = cursor.i
        cursor.i += 1
        const sym = symbols[index]
        try {
          const json = await fetchEquityDailyBottomBuy(sym, { signal: ctrl.signal })
          views[index] = json?.view || null
        } catch (err) {
          if (ctrl.signal.aborted) throw err
          views[index] = null
        }
      }
      return views
    }

    const cursor = { i: 0 }
    const workers = Array.from({ length: Math.min(6, symbols.length) }, () => worker(cursor))
    Promise.all(workers)
      .then((chunks) => {
        if (cancelled || ctrl.signal.aborted) return
        const views = []
        for (const chunk of chunks) {
          chunk.forEach((view, index) => {
            if (view) views[index] = view
          })
        }
        const packed = symbols.map((_, index) => views[index] || null)
        const ok = packed.filter((view) => view?.ok)
        if (!ok.length) return
        setCandidateAsOf(ok.find((view) => view.asOf)?.asOf || null)
        setSignalViews(packed)
        setCandidates(selectEquityBuyCandidates(packed, symbols))
      })
      .catch((err) => {
        if (cancelled || ctrl.signal.aborted || err?.name === "AbortError") return
      })

    return () => {
      cancelled = true
      ctrl.abort()
    }
  }, [universeKey])

  useEffect(() => {
    if (!universe.length) return undefined
    const scan = new Set(universe.map((row) => row.symbol))
    const extra = catalog.filter((row) => !scan.has(row.symbol))
    if (!extra.length) {
      setExtraViews({})
      return undefined
    }
    const ctrl = new AbortController()
    let cancelled = false
    setExtraViews(null)

    async function worker(cursor) {
      const views = []
      while (cursor.i < extra.length) {
        const index = cursor.i
        cursor.i += 1
        const sym = extra[index].symbol
        try {
          const json = await fetchEquityDailyBottomBuy(sym, { signal: ctrl.signal })
          views[index] = json?.view || null
        } catch (err) {
          if (ctrl.signal.aborted) throw err
          views[index] = null
        }
      }
      return views
    }

    const cursor = { i: 0 }
    const workers = Array.from({ length: Math.min(6, extra.length) }, () => worker(cursor))
    Promise.all(workers)
      .then((chunks) => {
        if (cancelled || ctrl.signal.aborted) return
        const next = {}
        for (const chunk of chunks) {
          chunk.forEach((view, index) => {
            if (extra[index]) next[extra[index].symbol] = view
          })
        }
        setExtraViews(next)
      })
      .catch((err) => {
        if (cancelled || ctrl.signal.aborted || err?.name === "AbortError") return
        if (!cancelled) setExtraViews({})
      })

    return () => {
      cancelled = true
      ctrl.abort()
    }
  }, [universeKey])
  const groups = useMemo(() => {
    const seen = []
    for (const row of catalog) {
      if (row.group && !seen.includes(row.group)) seen.push(row.group)
    }
    return seen
  }, [catalog])

  const visible = useMemo(
    () => visibleResearchStocks(catalog, { group, query }),
    [catalog, group, query],
  )

  const selectedRow = catalog.find((row) => row.symbol === symbol) || null
  const selectedLabel = equityTickerLabel(selectedRow) || symbol

  useEffect(() => {
    if (!picker.open) return undefined
    function onPointerDown(event) {
      if (!pickerRef.current?.contains(event.target)) setPicker(closeTickerPicker())
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [picker.open])

  const buyProgress = useMemo(() => {
    void recordsVersion
    const bySymbol = new Map()
    for (const row of signalViews || []) {
      if (row?.symbol) bySymbol.set(row.symbol, row)
    }
    if (payload?.view?.symbol) bySymbol.set(payload.view.symbol, payload.view)
    return collectDbbBuyProgress(
      universe
        .map((row) => equityViewProgressEntry(row, bySymbol.get(row.symbol) || null))
        .filter(Boolean),
    )
  }, [universe, signalViews, payload?.view, recordsVersion])

  const view = payload?.view
  const priceText = formatPrice(view?.price)
  const atrText = formatAtr(view?.atrPct)
  const conditionType = equityCandidateConditionType(view)
  const dd120Text = formatDd120(view?.dd120)

  return (
    <div className="yds-dbb min-w-0 w-full">
      <header className="yds-dbb__hero">
        <p className="yds-dbb__kicker">EQUITY DAILY BOTTOM BUY</p>
        <h1 className="yds-dbb__title">개별 종목 Daily Bottom Buy</h1>
        <p className="yds-dbb__lead">개별 종목의 조정/과매도 상태를 확인하는 READ-ONLY 화면</p>
      </header>

      <DbbBuyProgressSection
        items={buyProgress}
        onSelectSymbol={setSymbol}
        showBuyLines
        selectedSymbol={symbol}
        focusStatus
      />

      <section className="yds-dbb-card mb-3" aria-label="오늘의 조정매수 후보">
        <h2 className="yds-dbb-section__title">오늘의 조정매수 후보</h2>
        {candidateAsOf ? <p className="yds-dbb__meta mt-2">기준일 {candidateAsOf}</p> : null}
        {candidates === null ? (
          <p className="yds-dbb__status">데이터 준비 중</p>
        ) : candidates.length === 0 ? (
          <p className="yds-dbb__status">현재 조정매수 후보가 없습니다.</p>
        ) : (
          <ul className="yds-dbb-cands">
            {candidates.map((row) => {
              const type = equityCandidateConditionType(row)
              return (
                <li key={row.symbol} className="min-w-0">
                  <button
                    type="button"
                    className={`yds-dbb-cand w-full min-w-0 rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-left text-sm text-slate-100${row.symbol === symbol ? " is-selected" : ""}`}
                    aria-pressed={row.symbol === symbol}
                    onClick={() => setSymbol(row.symbol)}
                  >
                    <p className="yds-dbb-cand__name">
                      <span className="yds-dbb-cand__title">{row.name}</span>
                      <span className="yds-dbb-cand__ticker">{row.symbol}</span>
                    </p>
                    {type ? (
                      <>
                        <p className="yds-dbb-cand__type">{type.title}</p>
                        <p className="yds-dbb-cand__detail">{type.detail}</p>
                      </>
                    ) : (
                      <p className="yds-dbb-cand__score">{row.score}/4</p>
                    )}
                    <CandidateFacts row={row} />
                    {row.state?.label ? <p className="yds-dbb-cand__status">{row.state.label}</p> : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="yds-dbb-card mb-3">
        <h2 className="yds-dbb-section__title">종목 선택</h2>
        <div className="yds-dbb-picker" ref={pickerRef}>
          <button
            type="button"
            className="yds-dbb-picker__toggle"
            aria-expanded={picker.open}
            aria-controls="equity-ticker-list"
            onClick={() => setPicker((state) => toggleTickerPicker(state))}
          >
            <span>{selectedLabel}</span>
            <span aria-hidden="true">{picker.open ? "▲" : "▼"}</span>
          </button>
          {picker.open ? (
            <div className="yds-dbb-picker__panel" id="equity-ticker-list">
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
                  placeholder="티커 또는 종목명"
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <ul className="yds-dbb-research-list" aria-label="연구 종목 31">
                {visible.map((row) => (
                  <li key={row.symbol}>
                    <button
                      type="button"
                      className={`yds-dbb-research-list__item${row.symbol === symbol ? " is-selected" : ""}`}
                      aria-pressed={row.symbol === symbol}
                      onClick={() => {
                        setSymbol(row.symbol)
                        setPicker(closeTickerPicker())
                      }}
                    >
                      {equityTickerLabel(row)}
                    </button>
                  </li>
                ))}
              </ul>
              {visible.length === 0 ? <p className="yds-dbb__status">검색 결과가 없습니다.</p> : null}
            </div>
          ) : null}
        </div>
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

          <section className={`yds-dbb-card yds-dbb-score mb-3 yds-dbb-card--${view.state?.id === "strongLow" ? "strong" : view.state?.id === "firstBuy" ? "primary" : view.state?.id === "interest" ? "watch" : "wait"}`}>
            <h2 className="yds-dbb-section__title">DBB SCORE</h2>
            <p className="yds-dbb-score__state">{view.state?.label}</p>
            <p className="yds-dbb-card__count">{view.score} / 4</p>
            {view.state?.detail ? <p className="yds-dbb-card__hint">{view.state.detail}</p> : null}
            {conditionType ? <p className="yds-dbb-score__type">{conditionType.title}</p> : null}
            {dd120Text ? (
              <p className="yds-dbb-score__dd">
                <span>120일 고점 대비</span>
                <strong className="tabular-nums">{dd120Text}</strong>
              </p>
            ) : null}
          </section>

          <EquityResearchPanel />

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

      <section className="yds-dbb-card mb-3" aria-label="매수 기록">
        <h2 className="yds-dbb-section__title">매수 기록</h2>
        <div className="yds-dbb-trade mt-2">
          <TradeRecordEditor
            key={symbol}
            system="dbb"
            symbol={symbol}
            defaultWeightPct={50}
            equityBuyIntent
          />
        </div>
      </section>

      <section className="yds-dbb-section" aria-label="전체 개별 종목 목록">
        <header className="yds-dbb-section__head">
          <h2 className="yds-dbb-section__title">전체 개별 종목 목록</h2>
        </header>
        <div className="yds-dbb-all">
          {equitySummaryVisibleRows(catalog, summaryOpen).map((row) => {
            const scanned = (signalViews || []).find((item) => item?.symbol === row.symbol) || null
            const extra = extraViews?.[row.symbol] || null
            const chosen = payload?.view?.symbol === row.symbol ? payload.view : scanned || extra
            const summary = equitySummaryRow(chosen)
            const theme = chosen?.group || row.group || "—"
            return (
              <button
                key={`all-${row.symbol}`}
                type="button"
                className={`yds-dbb-all__row${row.symbol === symbol ? " is-selected" : ""}`}
                aria-pressed={row.symbol === symbol}
                onClick={() => setSymbol(row.symbol)}
              >
                <span className="yds-dbb-all__sym">{row.symbol}</span>
                <span className="yds-dbb-all__theme">{theme}</span>
                <span className="yds-dbb-all__count">{summary.countText}</span>
                <span className={`yds-dbb-all__stage is-${summary.stageClass}`}>{summary.stageLabel}</span>
              </button>
            )
          })}
        </div>
        {catalog.length > EQUITY_SUMMARY_PREVIEW_COUNT ? (
          <button
            type="button"
            className="yds-dbb-all__more"
            aria-expanded={summaryOpen}
            onClick={() => setSummaryOpen((open) => !open)}
          >
            {equitySummaryToggleLabel(catalog.length, summaryOpen)}
          </button>
        ) : null}
      </section>
    </div>
  )
}
