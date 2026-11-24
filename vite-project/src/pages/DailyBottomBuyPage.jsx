import { useEffect, useMemo, useRef, useState } from "react"
import {
  applyDailyBottomBuyAccess,
  fetchDailyBottomBuySnapshot,
} from "../utils/dailyBottomBuyApi.js"
import {
  formatDailyBottomDataBasis,
  pickDailyBottomAsOfDate,
} from "../utils/dailyBottomBuyDataBasis.js"
import {
  acknowledgeEpisodeTranche,
  syncDailyBottomEpisodes,
} from "../content/ydsDailyBottomBuyEpisodes.js"
import {
  buildDailyBottomBuyVisibility,
  DBB_PRO_LOCK_COPY,
} from "../content/ydsDailyBottomBuyProGate.js"
import { buildDbbMembershipAudienceCta } from "../content/ydsDailyBottomBuyAccessPolicy.js"
import { collectDbbBuyProgress, etfCardProgressEntry } from "../content/ydsDbbBuyProgress.js"
import { listTradeRecords, TRADE_RECORDS_CHANGED_EVENT } from "../content/ydsTradeRecords.js"
import { buildDbbTradeStatusView } from "../content/ydsTradeRecordsStatus.js"
import { useMembership } from "../context/MembershipContext.jsx"
import YdsProFeatureGate from "../components/market-analysis/YdsProFeatureGate.jsx"
import DbbMembershipAccessNotice from "../components/dbb/DbbMembershipAccessNotice.jsx"
import EtfDataAsOfBanner from "../components/dbb/EtfDataAsOfBanner.jsx"
import EtfInvestDecisionBoard from "../components/dbb/EtfInvestDecisionBoard.jsx"
import EtfInvestOverviewCards from "../components/dbb/EtfInvestOverviewCards.jsx"
import EtfInvestOverviewTable from "../components/dbb/EtfInvestOverviewTable.jsx"
import EtfQualityDetailPanel from "../components/dbb/EtfQualityDetailPanel.jsx"
import DbbBuyProgressSection from "../components/trade-records/DbbBuyProgressSection.jsx"
import TradeRecordEditor from "../components/trade-records/TradeRecordEditor.jsx"
import TradeRecordStatusBlock from "../components/trade-records/TradeRecordStatusBlock.jsx"
import DbbReturnHorizonNote from "../components/dbb/DbbReturnHorizonNote.jsx"
import DbbSplitSimResearchNote from "../components/dbb/DbbSplitSimResearchNote.jsx"
import CreditCycleBtdContextPanel from "../components/dbb/CreditCycleBtdContextPanel.jsx"
import {
  classifyEtfInvestDecision,
  formatEtfDbbStatusLabel,
  getEtfDbbComputeStatus,
  pickEtfDataAsOf,
} from "../content/ydsEtfInvestDecision.js"
import { scoredCountRank, sortByBuyConditionCount } from "../utils/buyConditionOrder.js"
import {
  closeTickerPicker,
  initialTickerPickerState,
  toggleTickerPicker,
} from "../utils/equityResearchDisplay.js"

function fmtNum(v, digits = 1) {
  if (v == null || !Number.isFinite(Number(v))) return "—"
  return Number(v).toFixed(digits)
}

function formatPrice(v) {
  if (v == null || !Number.isFinite(Number(v))) return null
  return Number(v).toFixed(2)
}

function etfTickerLabel(card) {
  if (!card?.symbol) return ""
  const theme = card.themeShort || card.theme || ""
  return theme ? `${theme} (${card.symbol})` : card.symbol
}

function etfClassLabel(card) {
  if (!card) return ""
  const parts = [card.sector, card.industry].filter(Boolean)
  return parts.join(" · ")
}

function etfQualityLabel(card) {
  return card?.qualityLabel || card?.quality?.label || "평가 보류"
}

function opportunityCardHasDetails(card) {
  if (!card) return false
  return [card.close, card.rsi14, card.stochK, card.bbPctB, card.ma20DevPct].some(
    (value) => value != null && value !== "",
  )
}

function OpportunityFacts({ card }) {
  return (
    <dl className="yds-dbb-cand__metrics">
      <div>
        <dt>현재가</dt>
        <dd>{formatPrice(card.close) != null ? `$${formatPrice(card.close)}` : "—"}</dd>
      </div>
      <div>
        <dt>RSI</dt>
        <dd>{fmtNum(card.rsi14)}</dd>
      </div>
      <div>
        <dt>Stoch</dt>
        <dd>{fmtNum(card.stochK)}</dd>
      </div>
      <div>
        <dt>BB</dt>
        <dd>{fmtNum(card.bbPctB, 2)}</dd>
      </div>
      <div>
        <dt>MA20</dt>
        <dd>{fmtNum(card.ma20DevPct)}%</dd>
      </div>
    </dl>
  )
}

/**
 * 일상 저점매수 V1 — Panic과 분리된 보조 신호 화면
 * UI flow mirrors equity daily-bottom-buy; ETF snapshot + trade records stay ETF-specific.
 */
export default function DailyBottomBuyPage() {
  const { isPro, detailAccess, authReady, isLoading: membershipLoading, isLoggedOut, status } = useMembership()
  const analysisAllowed = detailAccess === true
  const visibility = useMemo(() => buildDailyBottomBuyVisibility(analysisAllowed), [analysisAllowed])
  const audienceCta = useMemo(
    () => buildDbbMembershipAudienceCta({ isPro, detailAccess: analysisAllowed, isLoggedOut, status }),
    [isPro, analysisAllowed, isLoggedOut, status],
  )
  const [payload, setPayload] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [episodes, setEpisodes] = useState({})
  const [recordsVersion, setRecordsVersion] = useState(0)
  /** Empty until user picks an ETF — never auto-saves a trade. */
  const [symbol, setSymbol] = useState("")
  const [query, setQuery] = useState("")
  const [picker, setPicker] = useState(initialTickerPickerState)
  const pickerRef = useRef(null)
  const [listOpen, setListOpen] = useState(false)

  useEffect(() => {
    const onChange = () => setRecordsVersion((n) => n + 1)
    window.addEventListener(TRADE_RECORDS_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(TRADE_RECORDS_CHANGED_EVENT, onChange)
  }, [])

  useEffect(() => {
    if (!authReady || membershipLoading) return undefined
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    fetchDailyBottomBuySnapshot({ signal: ctrl.signal })
      .then((data) => {
        const gated = applyDailyBottomBuyAccess(data, analysisAllowed)
        setPayload(gated)
        setEpisodes(syncDailyBottomEpisodes(gated.all || []))
      })
      .catch((err) => {
        if (err?.name === "AbortError") return
        setError(err?.message || "불러오기 실패")
      })
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [authReady, membershipLoading, analysisAllowed])

  useEffect(() => {
    if (!picker.open) return undefined
    function onPointerDown(event) {
      if (!pickerRef.current?.contains(event.target)) setPicker(closeTickerPicker())
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [picker.open])

  const etfList = useMemo(
    () => sortByBuyConditionCount(payload?.all || [], (card) => scoredCountRank(card?.ok, card?.count)),
    [payload],
  )
  const strong = useMemo(() => etfList.filter((card) => card.ok && card.count >= 4), [etfList])
  const primary = useMemo(() => etfList.filter((card) => card.ok && card.count === 3), [etfList])
  const opportunities = useMemo(() => [...strong, ...primary], [strong, primary])

  const visibleEtfs = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return etfList
    return etfList.filter((card) => {
      const hay =
        `${card.symbol || ""} ${card.themeShort || ""} ${card.theme || ""} ${card.role || ""} ${card.sector || ""} ${card.industry || ""}`.toLowerCase()
      return hay.includes(q)
    })
  }, [etfList, query])

  const selected = useMemo(() => {
    if (!symbol) return null
    return etfList.find((card) => card.symbol === symbol) || null
  }, [etfList, symbol])

  const selectedRecords = useMemo(() => {
    void recordsVersion
    if (!symbol) return []
    return listTradeRecords("dbb", symbol)
  }, [symbol, recordsVersion])

  const selectedStatus = useMemo(() => {
    if (!selected?.ok) return null
    return buildDbbTradeStatusView(selected, selectedRecords, selected.asOfDate)
  }, [selected, selectedRecords])

  const dataBasis = useMemo(() => {
    const asOfDate = pickDailyBottomAsOfDate(payload?.all)
    return formatDailyBottomDataBasis({ asOfDate, source: payload?.source })
  }, [payload])

  const buyProgress = useMemo(() => {
    void recordsVersion
    return collectDbbBuyProgress(
      (payload?.all || []).map((card) => etfCardProgressEntry(card)).filter(Boolean),
    )
  }, [payload, recordsVersion])

  const creditBuySide = useMemo(() => {
    if (!selected) {
      return {
        product: "etf",
        symbol: null,
        scoreNOf4: null,
        stageLabel: null,
        buyOk: false,
        priceAsOf: null,
      }
    }
    return {
      product: "etf",
      symbol: selected.symbol || null,
      scoreNOf4: selected.ok ? selected.count ?? null : null,
      stageLabel: selected.ok ? selected.stage?.label || null : null,
      buyOk: Boolean(selected.ok),
      priceAsOf: pickEtfDataAsOf(selected) || selected.asOfDate || null,
    }
  }, [selected])

  function onAck(sym, kind) {
    acknowledgeEpisodeTranche(sym, kind)
    if (payload?.all) setEpisodes(syncDailyBottomEpisodes(payload.all))
  }

  function onRecordsChange() {
    setRecordsVersion((n) => n + 1)
  }

  function selectSymbol(next) {
    setSymbol(next)
    setPicker(closeTickerPicker())
  }

  const selectedLabel = selected ? etfTickerLabel(selected) : "ETF를 선택하세요"
  const stageId = selected?.ok ? selected.stage?.id || "wait" : "error"

  return (
    <div className="yds-dbb yds-dbb--dashboard min-w-0 w-full">
      <header className="yds-dbb__hero">
        <p className="yds-dbb__kicker">DAILY BOTTOM BUY · QUALITY</p>
        <h1 className="yds-dbb__title">일상 조정 매수</h1>
        <p className="yds-dbb__lead">
          15개 ETF의 장기 품질평가와 현재 저점 매수 조건을 나란히 확인해 투자 판단을 돕습니다. 두
          결과는 합산하지 않습니다.
        </p>
      </header>

      <DbbMembershipAccessNotice cta={audienceCta} />

      <DbbBuyProgressSection
        items={buyProgress}
        onSelectSymbol={selectSymbol}
        showBuyLines
        selectedSymbol={symbol || null}
        focusStatus
      />

      <details className="yds-dbb-card yds-dbb-research mb-3">
        <summary className="yds-dbb-section__title">과거 연구 기준</summary>
        <DbbReturnHorizonNote />
        <DbbSplitSimResearchNote />
      </details>

      <details className="yds-dbb__notice yds-dbb__notice--fold">
        <summary className="yds-dbb__notice-summary">
          <span className="yds-dbb__notice-summary-text">
            <span className="yds-dbb__notice-summary-label">이용 안내</span>
            <span className="yds-dbb__notice-summary-lead">
              3개→1차 · 4개→추가 · 신호 후 추가 하락 가능
            </span>
          </span>
        </summary>
        <div className="yds-dbb__notice-body">
          <p>3개 충족 → 1차 매수 후보 · 4개 충족 → 추가 매수 후보</p>
          <p>신호 발생 후 추가 하락할 수 있습니다.</p>
          <DbbSplitSimResearchNote />
          <p className="yds-dbb__notice-muted">
            분할매수 검토용 보조 신호입니다. 대형 시장 패닉은 Panic Index를 참고합니다.
          </p>
          <p className="yds-dbb__notice-muted">
            미국 거래일 종가가 갱신되면 같은 한국 날짜 안에서도 신호가 바뀔 수 있습니다.
          </p>
        </div>
      </details>

      {loading && <p className="yds-dbb__status">불러오는 중…</p>}
      {error && !payload && <p className="yds-dbb__status yds-dbb__status--err">{error}</p>}

      {payload ? (
        <>
          <div className="yds-dbb__meta-block">
            <p className="yds-dbb__meta">{dataBasis.line}</p>
            {dataBasis.warn ? (
              <p className="yds-dbb__meta-warn" role="status">
                {dataBasis.warn}
              </p>
            ) : null}
            <p className="yds-dbb__meta yds-dbb__meta--thresholds">
              RSI≤36 · Stoch≤15.4 · BB%B≤0.01 · MA20≤-4.2%
            </p>
          </div>

          <EtfDataAsOfBanner cards={etfList} />

          <EtfInvestOverviewCards cards={etfList} selectedSymbol={symbol} onSelect={selectSymbol} />

          <EtfInvestOverviewTable cards={etfList} selectedSymbol={symbol} onSelect={selectSymbol} />

          <EtfInvestDecisionBoard cards={etfList} selectedSymbol={symbol} onSelect={selectSymbol} />

          <section className="yds-dbb-card mb-3" aria-label="오늘의 조정매수 후보">
            <h2 className="yds-dbb-section__title">오늘의 조정매수 후보</h2>
            <p className="yds-dbb__meta mt-2">3개 이상 조건 · 현재 매수 기회</p>
            {!opportunities.length ? (
              <p className="yds-dbb__status">지금 3개 이상 충족 ETF가 없습니다.</p>
            ) : (
              <ul className="yds-dbb-cands">
                {opportunities.map((card) => {
                  const isStrong = card.count >= 4
                  return (
                    <li key={card.symbol} className="yds-dbb-cands__item min-w-0">
                      <button
                        type="button"
                        className={`yds-dbb-cand w-full min-w-0 px-3 py-2 text-left text-sm${
                          card.symbol === symbol ? " is-selected" : ""
                        }`}
                        aria-pressed={card.symbol === symbol}
                        onClick={() => selectSymbol(card.symbol)}
                      >
                        <p className="yds-dbb-cand__name">
                          <span className="yds-dbb-cand__title">{card.themeShort || card.theme || card.symbol}</span>
                          <span className="yds-dbb-cand__ticker">{card.symbol}</span>
                        </p>
                        {etfClassLabel(card) ? (
                          <p className="yds-dbb-cand__detail">{etfClassLabel(card)}</p>
                        ) : null}
                        <p className="yds-dbb-cand__type">{isStrong ? "강한 저점" : "1차 매수"}</p>
                        <p className="yds-dbb-cand__detail">{card.stage?.label || `${card.count}/4`}</p>
                        <p className="yds-dbb-cand__status">품질 {etfQualityLabel(card)}</p>
                        <p className="yds-dbb-cand__status">
                          {classifyEtfInvestDecision(card).shortLabel}
                        </p>
                        {payload?.access === "full" ? (
                          opportunityCardHasDetails(card) ? (
                            <OpportunityFacts card={card} />
                          ) : (
                            <p className="yds-dbb-cand__status">상세 데이터 없음</p>
                          )
                        ) : null}
                        {visibility.proSplitActions && card.stage?.splitHint ? (
                          <p className="yds-dbb-cand__status">{card.stage.splitHint}</p>
                        ) : null}
                      </button>
                      {visibility.proSplitActions ? (
                        <button
                          type="button"
                          className="yds-dbb-ack"
                          onClick={() => onAck(card.symbol, isStrong ? "add" : "primary")}
                        >
                          {isStrong ? "추가 50% 검토 표시" : "1차 50% 검토 표시"}
                        </button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="yds-dbb-card mb-3" aria-label="종목 선택">
            <h2 className="yds-dbb-section__title">종목 선택</h2>
            <p className="yds-dbb__notice-muted mt-2">
              현재 매수 기회에 없어도 워치리스트 ETF를 골라 상태를 보고 매수 기록을 입력할 수 있습니다. 매수일은
              실제 체결일입니다. 과거 신호일은 메모에만 적으세요. 기록 입력이 신호·에피소드를 다시 만들지
              않습니다.
            </p>
            <div className="yds-dbb-picker" ref={pickerRef}>
              <button
                type="button"
                className="yds-dbb-picker__toggle"
                aria-expanded={picker.open}
                aria-controls="etf-ticker-list"
                onClick={() => setPicker((state) => toggleTickerPicker(state))}
              >
                <span>{selectedLabel}</span>
                <span aria-hidden="true">{picker.open ? "▲" : "▼"}</span>
              </button>
              {picker.open ? (
                <div className="yds-dbb-picker__panel" id="etf-ticker-list">
                  <label className="yds-dbb-picker__field">
                    검색
                    <input
                      className="yds-dbb-picker__input"
                      value={query}
                      placeholder="티커 · 테마 · 섹터"
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <ul className="yds-dbb-research-list" aria-label="ETF 선택 목록">
                    {visibleEtfs.map((card) => (
                      <li key={card.symbol}>
                        <button
                          type="button"
                          className={`yds-dbb-research-list__item${card.symbol === symbol ? " is-selected" : ""}`}
                          aria-pressed={card.symbol === symbol}
                          onClick={() => selectSymbol(card.symbol)}
                        >
                          {etfTickerLabel(card)}
                          {etfClassLabel(card) ? ` · ${etfClassLabel(card)}` : ""}
                          {card.ok ? ` · ${card.count}/4` : " · 데이터 없음"}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {visibleEtfs.length === 0 ? <p className="yds-dbb__status">검색 결과가 없습니다.</p> : null}
                </div>
              ) : null}
            </div>
          </section>

          {symbol && selected ? (
            <div className="yds-dbb-dash mb-3">
              <div className="yds-dbb-dash__detail">
                <section className="yds-dbb-card">
                  <h2 className="yds-dbb-section__title">현재 상태</h2>
                  <p className="yds-dbb-card__ticker mt-2">
                    {selected.themeShort || selected.theme || selected.symbol}
                    <span className="yds-dbb-card__theme-inline"> {selected.symbol}</span>
                  </p>
                  {selected.role ? <p className="yds-dbb__meta">{selected.role}</p> : null}
                  {etfClassLabel(selected) ? (
                    <p className="yds-dbb__meta">{etfClassLabel(selected)}</p>
                  ) : null}
                  <p className="yds-dbb__meta">품질 평가 · {etfQualityLabel(selected)}</p>
                  <p className="yds-dbb__meta">
                    통합 분류 · {classifyEtfInvestDecision(selected).shortLabel}
                  </p>
                  <p className="yds-dbb__meta">DBB · {formatEtfDbbStatusLabel(selected)}</p>
                  {visibility.proPrice && formatPrice(selected.close) != null ? (
                    <p className="yds-dbb-price tabular-nums">${formatPrice(selected.close)}</p>
                  ) : null}
                  <p className="yds-dbb__meta">
                    {(() => {
                      const st = getEtfDbbComputeStatus(selected)
                      const asOf = pickEtfDataAsOf(selected)
                      if (st.id === "error") {
                        return `DBB 데이터 오류 · ${st.detailLabel || st.detail || "unavailable"}`
                      }
                      if (st.id === "stale") {
                        return `가격 기준일 ${st.detail} · 데이터 지연 (${st.lagDays}일)`
                      }
                      if (selected.ok && asOf) return `가격 기준일 ${asOf}`
                      if (selected.ok) return "가격 기준일 확인 불가"
                      return "데이터 부족 · 신호 미표시"
                    })()}
                  </p>
                  {episodes[selected.symbol]?.uiNote ? (
                    <p className="yds-dbb-card__episode">{episodes[selected.symbol].uiNote}</p>
                  ) : null}
                </section>

                <EtfQualityDetailPanel card={selected} />

                <section
                  className={`yds-dbb-card yds-dbb-score yds-dbb-card--${
                    stageId === "strong"
                      ? "strong"
                      : stageId === "primary"
                        ? "primary"
                        : stageId === "watch"
                          ? "watch"
                          : "wait"
                  }`}
                  aria-label="DBB 매수 분석"
                >
                  <h2 className="yds-dbb-section__title">DBB 매수 분석</h2>
                  <p className="yds-dbb-score__state">
                    {selected.ok ? selected.stage?.label || "대기" : "데이터 없음"}
                  </p>
                  <p className="yds-dbb-card__count">{selected.ok ? `${selected.count} / 4` : "— / 4"}</p>
                  <YdsProFeatureGate
                    unlocked={visibility.proScoreDetail}
                    title={DBB_PRO_LOCK_COPY.title}
                    body={DBB_PRO_LOCK_COPY.body}
                    className="yds-pro-gate--compact"
                  >
                    {selected.ok && selected.stage?.splitHint ? (
                      <p className="yds-dbb-card__hint">{selected.stage.splitHint}</p>
                    ) : null}
                    {selected.ok && selected.count === 2 ? (
                      <p className="yds-dbb-card__watch-hint">아직 매수 단계 아님</p>
                    ) : null}
                  </YdsProFeatureGate>
                </section>

                {selected.ok ? (
                  <YdsProFeatureGate
                    unlocked={visibility.proConditions}
                    title={DBB_PRO_LOCK_COPY.title}
                    body={DBB_PRO_LOCK_COPY.body}
                  >
                    <section className="yds-dbb-card">
                      <h2 className="yds-dbb-section__title">4 CONDITIONS</h2>
                      {payload?.access === "full" && selected.flags ? (
                        <ul className="yds-dbb-cond mt-2">
                          {[
                            {
                              id: "rsi",
                              label: "RSI",
                              value: fmtNum(selected.rsi14),
                              pass: selected.flags.rsi,
                              th: "≤36",
                            },
                            {
                              id: "stoch",
                              label: "Stoch",
                              value: fmtNum(selected.stochK),
                              pass: selected.flags.stoch,
                              th: "≤15.4",
                            },
                            {
                              id: "bb",
                              label: "BB %B",
                              value: fmtNum(selected.bbPctB, 2),
                              pass: selected.flags.bb,
                              th: "≤0.01",
                            },
                            {
                              id: "ma20",
                              label: "MA20",
                              value: `${fmtNum(selected.ma20DevPct)}%`,
                              pass: selected.flags.ma20,
                              th: "≤-4.2%",
                            },
                          ].map((row) => (
                            <li
                              key={row.id}
                              className={`yds-dbb-cond__row${row.pass ? " is-pass" : " is-fail"}`}
                            >
                              <span className="yds-dbb-metric__label yds-dbb-cond__name">{row.label}</span>
                              <span
                                className={`yds-dbb-cond__value tabular-nums ${row.pass ? "yds-dbb-metric__value is-ok" : "yds-dbb-metric__value"}`}
                              >
                                {row.value}
                              </span>
                              <span className="yds-dbb-metric__label yds-dbb-cond__th">{row.th}</span>
                              <span className="yds-dbb-cond__mark" aria-label={row.pass ? "충족" : "미충족"}>
                                {row.pass ? "✓" : "✕"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="yds-dbb-card__hint mt-2">상세 데이터 없음</p>
                      )}
                    </section>
                  </YdsProFeatureGate>
                ) : null}

                {selectedStatus?.hasRecords ? (
                  <section className="yds-dbb-card" aria-label="기록 현황">
                    <h2 className="yds-dbb-section__title">기록 현황</h2>
                    <p className="yds-dbb-card__hold mt-2">
                      보유 중 · {Number(selectedStatus.recordedWeightPct).toFixed(0)}% 매수
                    </p>
                    <div className="yds-dbb-card__trade-status mt-2">
                      <TradeRecordStatusBlock view={selectedStatus} />
                    </div>
                  </section>
                ) : null}

                {visibility.proSplitActions && selected.ok && selected.count >= 3 ? (
                  <button
                    type="button"
                    className="yds-dbb-ack"
                    onClick={() => onAck(selected.symbol, selected.count >= 4 ? "add" : "primary")}
                  >
                    {selected.count >= 4 ? "추가 50% 검토 표시" : "1차 50% 검토 표시"}
                  </button>
                ) : null}
              </div>

              <CreditCycleBtdContextPanel buySide={creditBuySide} />

              <section className="yds-dbb-card yds-dbb-dash__trade" aria-label="매수 기록">
                <h2 className="yds-dbb-section__title">매수 기록</h2>
                <p className="yds-dbb__notice-muted mt-2">
                  기회 카드에서 쓰던 것과 같은 매수 기록입니다. 실제 매수일·가격·금액·비중을 입력하세요.
                </p>
                <div className="yds-dbb-trade mt-2">
                  <TradeRecordEditor
                    key={symbol}
                    system="dbb"
                    symbol={symbol}
                    defaultWeightPct={50}
                    deriveAmount
                    onChange={onRecordsChange}
                  />
                </div>
              </section>
            </div>
          ) : (
            <>
              <section className="yds-dbb-card yds-dbb-select-hint mb-3" role="status">
                <h2 className="yds-dbb-section__title">ETF를 선택하세요</h2>
                <p className="yds-dbb__meta mt-2">
                  후보·목록·품질 카드에서 ETF를 고르면 기존 Buy-the-Dip 엔진의 N/4 점수·단계·조건이
                  여기에 표시됩니다. 선택 전에는 매수 기록이 저장되지 않습니다.
                </p>
                <p className="yds-dbb__meta">
                  오른쪽(또는 아래) Credit Cycle 패널의 CCI는 매수 점수와 합산하지 않습니다.
                </p>
              </section>
              <div className="mb-3">
                <CreditCycleBtdContextPanel buySide={creditBuySide} />
              </div>
            </>
          )}

          <section className="yds-dbb-section" aria-label="전체 ETF 목록">
            <header className="yds-dbb-section__head">
              <h2 className="yds-dbb-section__title">전체 {payload.all.length}개 ETF</h2>
            </header>
            <div className="yds-dbb-all">
              {(listOpen ? etfList : etfList.slice(0, 10)).map((card) => (
                <button
                  key={`all-${card.symbol}`}
                  type="button"
                  className={`yds-dbb-all__row${card.symbol === symbol ? " is-selected" : ""}`}
                  aria-pressed={card.symbol === symbol}
                  onClick={() => selectSymbol(card.symbol)}
                >
                  <span className="yds-dbb-all__sym">{card.symbol}</span>
                  <span className="yds-dbb-all__theme">
                    {card.themeShort || card.theme}
                    {etfClassLabel(card) ? ` · ${etfClassLabel(card)}` : ""}
                    {card.qualityGrade
                      ? ` · Q ${card.qualityGrade}${card.qualityScore != null ? ` ${card.qualityScore}` : ""}`
                      : ` · 품질 ${etfQualityLabel(card)}`}
                    {` · ${classifyEtfInvestDecision(card).shortLabel}`}
                  </span>
                  <span className="yds-dbb-all__count">{card.ok ? `${card.count}/4` : "—"}</span>
                  <span className={`yds-dbb-all__stage is-${card.ok ? card.stage?.id || "wait" : "error"}`}>
                    {card.ok ? card.stage?.label || "대기" : "데이터 없음"}
                  </span>
                </button>
              ))}
            </div>
            {etfList.length > 10 ? (
              <button
                type="button"
                className="yds-dbb-all__more"
                aria-expanded={listOpen}
                onClick={() => setListOpen((open) => !open)}
              >
                {listOpen ? "목록 접기" : `나머지 ${etfList.length - 10}개 더 보기`}
              </button>
            ) : null}
          </section>

          <footer className="yds-dbb__footer">
            <p>분할: 3개 → 1차 50%, 4개 → 추가 50%. 4개 없이 반등 시 잔여 50% 자동 미사용.</p>
            <p>자동매매 없음 · 일별 반복 매수 없음 · 동일 조정은 3→4 한 에피소드.</p>
            <p className="yds-dbb__notice-muted">Panic Index와 완전히 별개의 시스템입니다.</p>
          </footer>
        </>
      ) : null}
    </div>
  )
}
