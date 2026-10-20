import { useEffect, useMemo, useRef, useState } from "react"
import EquityResearchPanel from "../components/equity/EquityResearchPanel.jsx"
import DbbBuyProgressSection from "../components/trade-records/DbbBuyProgressSection.jsx"
import TradeRecordEditor from "../components/trade-records/TradeRecordEditor.jsx"
import TradeRecordStatusBlock from "../components/trade-records/TradeRecordStatusBlock.jsx"
import { attachHoldingQuote, collectDbbBuyProgress, equityViewProgressEntry } from "../content/ydsDbbBuyProgress.js"
import { fetchPortfolioQuotes } from "../content/ydsPortfolioQuoteService.js"
import { formatUsdPrice, TRADE_RECORDS_CHANGED_EVENT } from "../content/ydsTradeRecords.js"
import { scoredCountRank, sortByBuyConditionCount } from "../utils/buyConditionOrder.js"
import { fetchEquityDailyBottomBuy } from "../utils/equityDailyBottomBuyApi.js"
import { equityCandidateConditionType, selectEquityBuyCandidates } from "../utils/equityDailyBottomBuyCandidates.js"
import {
  closeTickerPicker,
  EQUITY_HOLDING_DISPLAY,
  EQUITY_SUMMARY_PREVIEW_COUNT,
  equityProgressMeta,
  equityResearchDisplayList,
  equitySummaryCatalog,
  equitySummaryRow,
  equitySummaryToggleLabel,
  equitySummaryVisibleRows,
  equityTickerLabel,
  initialTickerPickerState,
  toggleTickerPicker,
  visibleResearchStocks,
} from "../utils/equityResearchDisplay.js"

const DEFAULT_SYMBOL = "AMZN"

function chosenEquityView(row, signalViews, extraViews, payload) {
  const scanned = (signalViews || []).find((item) => item?.symbol === row.symbol) || null
  const extra = extraViews?.[row.symbol] || null
  if (payload?.view?.symbol === row.symbol) return payload.view
  return scanned || extra
}

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
  const [holdingQuotes, setHoldingQuotes] = useState({})
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
  const summaryCatalog = useMemo(() => equitySummaryCatalog(catalog), [catalog])
  const orderedSummary = useMemo(
    () =>
      sortByBuyConditionCount(summaryCatalog, (row) => {
        const chosen = chosenEquityView(row, signalViews, extraViews, payload)
        return scoredCountRank(chosen?.ok, chosen?.score)
      }),
    [summaryCatalog, signalViews, extraViews, payload],
  )

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
    const extra = equitySummaryCatalog(catalog).filter((row) => !scan.has(row.symbol))
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
    for (const row of summaryCatalog) {
      if (row.group && !seen.includes(row.group)) seen.push(row.group)
    }
    return seen
  }, [summaryCatalog])

  const visible = useMemo(
    () => visibleResearchStocks(summaryCatalog, { group, query }),
    [summaryCatalog, group, query],
  )

  const selectedRow = summaryCatalog.find((row) => row.symbol === symbol) || null
  const selectedLabel = equityTickerLabel(selectedRow) || symbol

  useEffect(() => {
    if (!picker.open) return undefined
    function onPointerDown(event) {
      if (!pickerRef.current?.contains(event.target)) setPicker(closeTickerPicker())
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [picker.open])

  useEffect(() => {
    let cancelled = false
    const symbols = EQUITY_HOLDING_DISPLAY.map((row) => row.symbol)
    fetchPortfolioQuotes(
      symbols.map((symbol) => ({
        id: symbol,
        ticker: symbol,
        country: "us",
        priceReady: true,
      })),
    ).then((result) => {
      if (cancelled) return
      const next = {}
      for (const symbol of symbols) {
        const quote = result?.quoteMap?.get(symbol)
        if (quote) next[symbol] = quote
      }
      setHoldingQuotes(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const buyProgress = useMemo(() => {
    void recordsVersion
    const bySymbol = new Map()
    for (const row of signalViews || []) {
      if (row?.symbol) bySymbol.set(row.symbol, row)
    }
    for (const row of EQUITY_HOLDING_DISPLAY) {
      const extra = extraViews?.[row.symbol]
      if (extra?.symbol) bySymbol.set(extra.symbol, extra)
    }
    if (payload?.view?.symbol) bySymbol.set(payload.view.symbol, payload.view)
    return collectDbbBuyProgress(
      equityProgressMeta(universe).map((row) =>
        equityViewProgressEntry(row, bySymbol.get(row.symbol) || null),
      ),
    ).map((item) => attachHoldingQuote(item, holdingQuotes[item.symbol]))
  }, [universe, signalViews, extraViews, payload?.view, recordsVersion, holdingQuotes])

  const view = payload?.view
  const detailMatchesSymbol = Boolean(view?.ok && view.symbol === symbol)
  const detailPending = Boolean(view?.ok && view.symbol !== symbol)
  const priceText = formatPrice(view?.price)
  const atrText = formatAtr(view?.atrPct)
  const conditionType = detailMatchesSymbol ? equityCandidateConditionType(view) : null
  const dd120Text = detailMatchesSymbol ? formatDd120(view?.dd120) : null
  const selectedProgress = buyProgress.find((item) => item.symbol === symbol) || null

  return (
    <div className="yds-dbb yds-dbb--equity-dash min-w-0 w-full">
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
                <li key={row.symbol} className="yds-dbb-cands__item min-w-0">
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

      <section className="yds-dbb-card yds-dbb-picker-card mb-3" aria-label="종목 선택">
        <h2 className="yds-dbb-section__title">종목 선택</h2>
        <p className="yds-dbb__meta mt-1">검색·그룹으로 워치리스트를 좁힌 뒤 종목을 고릅니다.</p>
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
              <ul className="yds-dbb-research-list" aria-label="종목 선택 목록">
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

      <div className="yds-dbb-dash mb-3">
        <div className="yds-dbb-dash__detail">
          {loading || detailPending ? (
            <p className="yds-dbb__status" role="status">
              {detailPending ? `${symbol} 상세를 불러오는 중…` : "불러오는 중…"}
            </p>
          ) : null}

          {!loading && !detailPending && (!view || !view.ok) ? (
            <p className="yds-dbb__status" role="status">
              {view?.message || payload?.message || "데이터 준비 중"}
            </p>
          ) : null}

          {detailMatchesSymbol ? (
            <>
              <section className="yds-dbb-card yds-dbb-card--compact">
                <h2 className="yds-dbb-section__title">현재 상태</h2>
                <p className="yds-dbb-card__ticker mt-1.5">
                  {view.name}
                  <span className="yds-dbb-card__theme-inline"> {view.symbol}</span>
                </p>
                <p className="yds-dbb__meta">{view.group}</p>
                <p className="mt-1.5 text-lg font-semibold tabular-nums text-slate-50">{priceText}</p>
                <p className="yds-dbb__meta">기준일 {view.asOf}</p>
                {view.source === "cache" ? <p className="yds-dbb__meta">저장된 시세 기준</p> : null}
              </section>

              <section
                className={`yds-dbb-card yds-dbb-card--compact yds-dbb-score yds-dbb-card--${
                  view.state?.id === "strongLow"
                    ? "strong"
                    : view.state?.id === "firstBuy"
                      ? "primary"
                      : view.state?.id === "interest"
                        ? "watch"
                        : "wait"
                }`}
              >
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

              <section className="yds-dbb-card yds-dbb-card--compact">
                <h2 className="yds-dbb-section__title">4 CONDITIONS</h2>
                <ul className="yds-dbb-cond mt-1.5">
                  {view.conditions.map((row) => {
                    const valueText = formatCondition(row)
                    return (
                      <li key={row.id} className="yds-dbb-cond__row">
                        <span className="yds-dbb-metric__label yds-dbb-cond__name">{row.label}</span>
                        <span
                          className={`tabular-nums ${row.pass ? "yds-dbb-metric__value is-ok" : "yds-dbb-metric__value"}`}
                        >
                          {valueText ?? "—"}
                        </span>
                        <span className="yds-dbb-metric__label yds-dbb-cond__th">{row.thresholdText}</span>
                        <span aria-label={row.pass ? "충족" : "미충족"}>{row.pass ? "✓" : "✕"}</span>
                      </li>
                    )
                  })}
                </ul>
              </section>

              <section className="yds-dbb-card yds-dbb-card--compact">
                <h2 className="yds-dbb-section__title">ATR RISK</h2>
                <p className="mt-1.5 text-lg font-semibold tabular-nums text-slate-50">{atrText}</p>
                <p className="yds-dbb-card__stage">{view.atrRisk?.label}</p>
                <p className="yds-dbb-card__hint">{view.atrNote}</p>
                <p className="yds-dbb-card__hint">{view.atrMeaning}</p>
              </section>

              <section className="yds-dbb__notice yds-dbb-dash__reading" aria-label="해석">
                <p>{view.state?.reading}</p>
                <p>{view.note}</p>
              </section>
            </>
          ) : null}
        </div>

        <section className="yds-dbb-card yds-dbb-dash__trade" aria-label="매수 기록">
          <h2 className="yds-dbb-section__title">매수 기록</h2>
          <p className="yds-dbb__meta mt-1">
            {selectedLabel} · 실제 체결 기준으로 입력합니다. 목록 수정·삭제는 아래 기록에서만 합니다.
          </p>
          <div className="yds-dbb-dash__trade-stack">
            <div className="yds-dbb-trade">
              {detailMatchesSymbol ? (
                <TradeRecordEditor
                  key={symbol}
                  system="dbb"
                  symbol={symbol}
                  defaultWeightPct={50}
                  equityBuyIntent
                  deriveAmount
                />
              ) : (
                <p className="yds-dbb__status" role="status">
                  선택 종목 상세와 동기화되면 매수 기록을 입력할 수 있습니다.
                </p>
              )}
            </div>
            <div className="yds-dbb-dash__trade-fill">
              {!detailMatchesSymbol ? (
                <p className="yds-dbb__meta">종목 상세가 준비되면 신호 요약이 여기에 표시됩니다.</p>
              ) : selectedProgress?.statusView ? (
                <div className="yds-dbb-dash__trade-status" aria-label="이 종목 매수 현황">
                  <h3 className="yds-dbb-dash__trade-sub">이 종목 현황</h3>
                  <TradeRecordStatusBlock view={selectedProgress.statusView} />
                </div>
              ) : selectedProgress ? (
                <div className="yds-dbb-dash__trade-status" aria-label="이 종목 매수 현황">
                  <h3 className="yds-dbb-dash__trade-sub">이 종목 현황</h3>
                  <div className="yds-trade-status">
                    <div className="yds-trade-status__row">
                      <span>기록 비중</span>
                      <strong className="font-mono tabular-nums">
                        {Number(selectedProgress.recordedWeightPct).toFixed(0)}%
                      </strong>
                    </div>
                    <div className="yds-trade-status__row">
                      <span>평균 매수가 (USD)</span>
                      <strong className="font-mono tabular-nums">
                        {formatUsdPrice(selectedProgress.avgBuyPrice)}
                      </strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="yds-dbb-dash__trade-status" aria-label="선택 종목 신호 요약">
                  <h3 className="yds-dbb-dash__trade-sub">선택 종목 신호</h3>
                  <div className="yds-trade-status">
                    <div className="yds-trade-status__row yds-trade-status__row--emphasis">
                      <span>현재 신호</span>
                      <strong>{view.state?.label || "—"}</strong>
                    </div>
                    <div className="yds-trade-status__row">
                      <span>DBB SCORE</span>
                      <strong className="font-mono tabular-nums">{view.score} / 4</strong>
                    </div>
                    {conditionType ? (
                      <div className="yds-trade-status__row">
                        <span>후보 유형</span>
                        <strong>{conditionType.title}</strong>
                      </div>
                    ) : null}
                  </div>
                  <p className="yds-dbb__meta mt-2">저장된 매수 기록이 없으면 입력 폼만 표시됩니다.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="yds-dbb-section yds-dbb-all-section" aria-label="전체 개별 종목 목록">
        <header className="yds-dbb-section__head">
          <h2 className="yds-dbb-section__title">전체 개별 종목 목록</h2>
          <p className="yds-dbb__meta">후보·보유와 별도로 워치리스트 전체를 훑어볼 수 있습니다.</p>
        </header>
        <div className="yds-dbb-all">
          {equitySummaryVisibleRows(orderedSummary, summaryOpen).map((row) => {
            const chosen = chosenEquityView(row, signalViews, extraViews, payload)
            const summary = equitySummaryRow(chosen)
            const theme = row.holding ? row.group : chosen?.group || row.group || "—"
            return (
              <button
                key={`all-${row.symbol}`}
                type="button"
                className={`yds-dbb-all__row${row.symbol === symbol ? " is-selected" : ""}`}
                aria-pressed={row.symbol === symbol}
                onClick={() => setSymbol(row.symbol)}
              >
                <span className="yds-dbb-all__sym">{row.symbol}</span>
                <span className={`yds-dbb-all__theme${row.holding ? " is-holding" : ""}`}>
                  <span className="yds-dbb-all__theme-text">{theme}</span>
                  {row.holding ? <span className="yds-dbb-all__hold">보유</span> : null}
                </span>
                <span className="yds-dbb-all__count">{summary.countText}</span>
                <span className={`yds-dbb-all__stage is-${summary.stageClass}`}>{summary.stageLabel}</span>
              </button>
            )
          })}
        </div>
        {summaryCatalog.length > EQUITY_SUMMARY_PREVIEW_COUNT ? (
          <button
            type="button"
            className="yds-dbb-all__more"
            aria-expanded={summaryOpen}
            onClick={() => setSummaryOpen((open) => !open)}
          >
            {equitySummaryToggleLabel(summaryCatalog.length, summaryOpen)}
          </button>
        ) : null}
      </section>
    </div>
  )
}
