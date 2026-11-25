import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useMembership } from "../context/MembershipContext.jsx"
import {
  PortfolioStateProvider,
  usePortfolioHoldings,
} from "../context/PortfolioStateContext.jsx"
import { loadCreditCycleUiModel } from "../credit-cycle/creditCycleBridge.js"
import {
  buildHomeCreditSummary,
  buildHomeEquityDbbSummary,
  buildHomeEtfDbbSummary,
  buildHomeFearSummary,
  buildHomeHeaderAsOfLabel,
  buildHomeJudgmentNarrative,
  buildHomePortfolioSummary,
  homeDayKey,
} from "../content/ydsHomeSummaryEngine.js"
import { useAppDataStore } from "../store/appDataStore.js"
import { usePanicStore } from "../store/panicStore.js"
import { mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import {
  latestCollectedHistoryRow,
  panicAsOfDate,
  resolveLivePanicData,
} from "../utils/panicDataFreshness.js"
import { panicDataFromCycleRow } from "../utils/cycleHistoryUtils.js"
import { fetchDailyBottomBuySnapshot } from "../utils/dailyBottomBuyApi.js"
import { fetchEquityDailyBottomBuy } from "../utils/equityDailyBottomBuyApi.js"
import { kstCalendarKey } from "../utils/formatDataAge.js"

const EQUITY_HOME_SYMBOL = "AMZN"

function HomePortfolioCard() {
  const { isLoggedOut, authReady, isLoading } = useMembership()
  const { portfolio, cashAmount, syncMode, isLoggedIn, syncReady } = usePortfolioHoldings()

  const summary = useMemo(() => {
    if (!authReady || isLoading) {
      return {
        mode: "loading",
        title: "내 투자",
        body: "로그인 상태 확인 중…",
        cta: "포트폴리오",
        showNumbers: false,
      }
    }
    const holdings = Array.isArray(portfolio?.holdings) ? portfolio.holdings : []
    return buildHomePortfolioSummary({
      isLoggedIn: isLoggedIn && !isLoggedOut,
      holdingCount: holdings.length,
      cashBalance: cashAmount > 0 ? cashAmount : null,
      syncMode: syncReady ? syncMode : null,
    })
  }, [
    authReady,
    isLoading,
    isLoggedIn,
    isLoggedOut,
    portfolio,
    cashAmount,
    syncMode,
    syncReady,
  ])

  return (
    <Link to="/portfolio" className="yds-home-card yds-home-card--link" data-section="portfolio">
      <header className="yds-home-card__head">
        <p className="yds-home-card__kicker">PORTFOLIO</p>
        <h2 className="yds-home-card__title">{summary.title}</h2>
      </header>
      <p className="yds-home-card__body">{summary.body}</p>
      {summary.mode === "ready" && summary.showNumbers ? (
        <p className="yds-home-card__metric">
          <span className="yds-home-card__num">{summary.holdingCount}</span>
          <span className="yds-home-card__unit">종 보유</span>
        </p>
      ) : null}
      <span className="yds-home-card__cta">{summary.cta}</span>
    </Link>
  )
}

export default function YdsHomePage() {
  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)
  const deskPanic = useAppDataStore((s) => s.deskResolvedPanicData)
  const hubPanic = useAppDataStore((s) => s.hubPanicMetrics)
  const storePanic = usePanicStore((s) => s.panicData)

  const [creditModel, setCreditModel] = useState(null)
  const [creditState, setCreditState] = useState("loading")
  const [etfPayload, setEtfPayload] = useState(null)
  const [etfState, setEtfState] = useState("loading")
  const [equityPayload, setEquityPayload] = useState(null)
  const [equityState, setEquityState] = useState("loading")

  const history = useMemo(
    () => resolveCycleHistoryRows(mergeCycleRows(storeRows ?? [], [])),
    [storeRows],
  )
  const latestCycleRow = latestCollectedHistoryRow(history)

  const historyPanic = useMemo(() => {
    if (!latestCycleRow) return null
    const panic = panicDataFromCycleRow(latestCycleRow)
    const rowDate = String(latestCycleRow.date ?? "").slice(0, 10)
    if (panic) {
      return {
        ...latestCycleRow,
        ...panic,
        date: /^\d{4}-\d{2}-\d{2}$/.test(rowDate) ? rowDate : latestCycleRow.date,
      }
    }
    return latestCycleRow
  }, [latestCycleRow])

  const panicData = useMemo(
    () => resolveLivePanicData(historyPanic, deskPanic ?? hubPanic, storePanic),
    [historyPanic, deskPanic, hubPanic, storePanic],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const dto = await loadCreditCycleUiModel()
        if (!cancelled) {
          setCreditModel(dto)
          setCreditState("ready")
        }
      } catch {
        if (!cancelled) {
          setCreditModel(null)
          setCreditState("error")
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    setEtfState("loading")
    fetchDailyBottomBuySnapshot({ signal: ctrl.signal })
      .then((json) => {
        if (ctrl.signal.aborted) return
        setEtfPayload(json)
        setEtfState("ready")
      })
      .catch(() => {
        if (ctrl.signal.aborted) return
        setEtfPayload(null)
        setEtfState("error")
      })
    return () => ctrl.abort()
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    setEquityState("loading")
    fetchEquityDailyBottomBuy(EQUITY_HOME_SYMBOL, { signal: ctrl.signal })
      .then((json) => {
        if (ctrl.signal.aborted) return
        setEquityPayload(json)
        setEquityState("ready")
      })
      .catch(() => {
        if (ctrl.signal.aborted) return
        setEquityPayload(null)
        setEquityState("error")
      })
    return () => ctrl.abort()
  }, [])

  const fear = useMemo(() => buildHomeFearSummary(panicData), [panicData])
  const credit = useMemo(() => {
    if (creditState === "loading") {
      return { ...buildHomeCreditSummary(null), loading: true, ready: false }
    }
    return buildHomeCreditSummary(creditModel)
  }, [creditModel, creditState])

  const etf = useMemo(() => {
    if (etfState === "loading") {
      return { ...buildHomeEtfDbbSummary(null), loading: true, message: "로딩 중…" }
    }
    if (etfState === "error") {
      return { ...buildHomeEtfDbbSummary(null), message: "데이터 없음" }
    }
    return buildHomeEtfDbbSummary(etfPayload)
  }, [etfPayload, etfState])

  const equity = useMemo(() => {
    if (equityState === "loading") {
      return { ...buildHomeEquityDbbSummary(null), loading: true, message: "로딩 중…" }
    }
    if (equityState === "error") {
      return { ...buildHomeEquityDbbSummary(null), message: "데이터 없음" }
    }
    return buildHomeEquityDbbSummary(equityPayload)
  }, [equityPayload, equityState])

  const todayKst = kstCalendarKey(new Date())
  const fearAsOf = homeDayKey(panicAsOfDate(panicData) || fear.asOf)
  const creditAsOf = homeDayKey(credit.asOf)

  const judgment = useMemo(
    () =>
      buildHomeJudgmentNarrative({
        fear,
        credit,
        fearAsOf,
        creditAsOf,
        today: todayKst,
      }),
    [fear, credit, fearAsOf, creditAsOf, todayKst],
  )

  const headerAsOf = useMemo(
    () =>
      buildHomeHeaderAsOfLabel({
        fearAsOf,
        creditAsOf,
        today: todayKst,
      }),
    [fearAsOf, creditAsOf, todayKst],
  )

  return (
    <div className="yds-home" data-page="yds-home">
      <header className="yds-home__hero" data-section="home-header">
        <p className="yds-home__brand">YDS INSIGHT</p>
        <h1 className="yds-home__title">오늘 한눈</h1>
        <p className="yds-home__lead">시장 상황과 투자 판단을 한눈에 확인합니다.</p>
        <p className="yds-home__asof">{headerAsOf.text}</p>
      </header>

      <section
        className="yds-home__judgment"
        aria-label="오늘의 시장 판단"
        data-section="home-judgment"
        data-deferred={judgment.deferred ? "true" : "false"}
      >
        <p className="yds-home__judgment-kicker">오늘의 시장 판단</p>
        <h2 className="yds-home__judgment-title">{judgment.headline}</h2>
        <ul className="yds-home__judgment-list">
          {judgment.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <div className="yds-home__grid">
        <Link to="/credit-cycle" className="yds-home-card yds-home-card--link" data-section="credit">
          <header className="yds-home-card__head">
            <p className="yds-home-card__kicker">CREDIT CYCLE</p>
            <h2 className="yds-home-card__title">신용 사이클</h2>
          </header>
          {credit.loading ? (
            <p className="yds-home-card__body">로딩 중…</p>
          ) : (
            <>
              <p className="yds-home-card__metric">
                <span className="yds-home-card__num">{credit.cciDisplay}</span>
                <span className="yds-home-card__unit">CCI</span>
              </p>
              <dl className="yds-home-card__facts">
                <div>
                  <dt>국면</dt>
                  <dd>{typeof credit.regime === "string" ? credit.regime : "—"}</dd>
                </div>
                <div>
                  <dt>Coverage</dt>
                  <dd>{credit.coverageDisplay}</dd>
                </div>
                <div>
                  <dt>PIT</dt>
                  <dd>{credit.pitLabel || "—"}</dd>
                </div>
                <div>
                  <dt>상태</dt>
                  <dd>
                    {credit.staleNames.length
                      ? `STALE · ${credit.staleNames.slice(0, 2).join(", ")}`
                      : credit.statusLabel || "—"}
                  </dd>
                </div>
                <div>
                  <dt>기준일</dt>
                  <dd>{credit.asOf || "—"}</dd>
                </div>
              </dl>
            </>
          )}
          <span className="yds-home-card__cta">신용 사이클 상세</span>
        </Link>

        <Link
          to="/market-analysis"
          className="yds-home-card yds-home-card--link"
          data-section="fear"
        >
          <header className="yds-home-card__head">
            <p className="yds-home-card__kicker">MARKET FEAR</p>
            <h2 className="yds-home-card__title">시장 공포</h2>
          </header>
          <dl className="yds-home-card__facts yds-home-card__facts--metrics">
            <div>
              <dt>VIX</dt>
              <dd className="yds-home-card__dd-lg">{fear.vix.display}</dd>
            </div>
            <div>
              <dt>CNN Fear &amp; Greed</dt>
              <dd className="yds-home-card__dd-lg">{fear.cnn.display}</dd>
            </div>
            <div>
              <dt>Put/Call</dt>
              <dd className="yds-home-card__dd-lg">{fear.putCall.display}</dd>
            </div>
            <div>
              <dt>BofA</dt>
              <dd className="yds-home-card__dd-lg">{fear.bofa.display}</dd>
            </div>
          </dl>
          <p className="yds-home-card__meta">
            기준일 {fearAsOf || "—"}
            {fear.highYieldHidden ? " · HY 수치 비공개" : ""}
          </p>
          <span className="yds-home-card__cta">시장 분석</span>
        </Link>

        <section className="yds-home-card" data-section="dbb" aria-label="저점 매수 기회">
          <header className="yds-home-card__head">
            <p className="yds-home-card__kicker">BUY THE DIP</p>
            <h2 className="yds-home-card__title">저점 매수 기회</h2>
          </header>
          <ul className="yds-home__dbb-list">
            <li>
              <Link to="/market-analysis" className="yds-home__dbb-row">
                <span className="yds-home__dbb-label">패닉 관련 분석</span>
                <span className="yds-home__dbb-value">시장 분석으로</span>
              </Link>
            </li>
            <li>
              <Link to="/daily-bottom-buy" className="yds-home__dbb-row">
                <span className="yds-home__dbb-label">ETF DBB</span>
                <span className="yds-home__dbb-value">
                  {etf.loading ? "로딩 중…" : etf.message}
                  {etf.asOf ? ` · ${etf.asOf}` : ""}
                </span>
              </Link>
            </li>
            <li>
              <Link to="/equity-daily-bottom-buy" className="yds-home__dbb-row">
                <span className="yds-home__dbb-label">Equity DBB</span>
                <span className="yds-home__dbb-value">
                  {equity.loading ? "로딩 중…" : equity.message}
                  {equity.asOf ? ` · ${equity.asOf}` : ""}
                </span>
              </Link>
            </li>
          </ul>
          <p className="yds-home-card__meta">N/4 점수와 CCI는 독립 · 합산 없음</p>
        </section>

        <PortfolioStateProvider>
          <HomePortfolioCard />
        </PortfolioStateProvider>
      </div>
    </div>
  )
}
