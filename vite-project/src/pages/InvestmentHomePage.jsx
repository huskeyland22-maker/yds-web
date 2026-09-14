import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { buildInvestmentHomeReport } from "../content/ydsInvestmentHomeEngine.js"
import {
  loadInvestmentHomeSettings,
  saveInvestmentHomeSettings,
} from "../content/ydsInvestmentHomeStorage.js"
import { fetchSpyDailyPrices } from "../content/ydsSpyDailyLoader.js"
import { buildStrategyMa40Judgment } from "../content/ydsStrategyMa40Engine.js"
import {
  cancelStrategyMonthlyInvestment,
  completeStrategyMonthlyInvestment,
  getStrategyMonthlyEntry,
  listStrategyMonthlyEntries,
  updateStrategyMonthlyInvestment,
} from "../content/ydsStrategyMonthlyLog.js"
import { computeStrategyReservePlan } from "../content/ydsStrategyReserveEngine.js"
import { useYdsMarketContext } from "../hooks/useYdsMarketContext.js"
import { useAppDataStore } from "../store/appDataStore.js"
import { panicDataFromCycleRow, mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import "../styles/yds-investment-home.css"

/** @returns {string} YYYY-MM */
function currentStrategyMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** @param {string} monthKey */
function formatMonthKeyLabel(monthKey) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(monthKey ?? ""))
  if (!m) return monthKey
  return `${Number(m[1])}년 ${Number(m[2])}월`
}

/** @param {string} completedAt */
function formatCompletedAtLabel(completedAt) {
  const raw = String(completedAt ?? "").trim()
  if (!raw) return "—"
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
  return raw
}

/** @param {number | null | undefined} value */
function formatMoney(value) {
  return `${Math.round(Number(value) || 0).toLocaleString("ko-KR")}원`
}

/** @param {string} code */
function formatMonthlyActionError(code) {
  const key = String(code ?? "").trim()
  const map = {
    invalid_month_key: "월 정보가 올바르지 않습니다.",
    already_completed: "이번 달 투자는 이미 완료 기록되어 있습니다.",
    invalid_amounts: "금액 입력이 올바르지 않습니다.",
    actual_extra_exceeds_target: "실제 추가 투자금이 목표 추가 투자금을 초과할 수 없습니다.",
    actual_extra_exceeds_reserve: "실제 추가 투자금이 Strategy Reserve 잔액을 초과할 수 없습니다.",
    not_found: "이번 달 완료 기록을 찾을 수 없습니다.",
    complete_failed: "투자 완료 기록에 실패했습니다.",
    update_failed: "완료 기록 수정에 실패했습니다.",
    cancel_failed: "완료 기록 취소에 실패했습니다.",
  }
  return map[key] || "요청을 처리할 수 없습니다. 입력값을 확인해주세요."
}

/** @param {number | null | undefined} value @param {string} fallback */
function displayMoney(value, fallback = "미입력") {
  return value == null ? fallback : formatMoney(value)
}

/** @param {number | null | undefined} value */
function formatSignedMoney(value) {
  const n = Math.round(Number(value) || 0)
  if (n > 0) return `+${n.toLocaleString("ko-KR")}원`
  if (n < 0) return `-${Math.abs(n).toLocaleString("ko-KR")}원`
  return "0원"
}

function MetricCard({ label, value, sub, tone = "" }) {
  return (
    <article className={`yds-home-metric ${tone ? `yds-home-metric--${tone}` : ""}`}>
      <span className="yds-home-metric__label">{label}</span>
      <strong className="yds-home-metric__value font-mono tabular-nums">{value}</strong>
      {sub ? <span className="yds-home-metric__sub">{sub}</span> : null}
    </article>
  )
}

/** @param {number | null | undefined} value */
function formatStageAmount(value) {
  return value == null ? "₩—" : formatMoney(value)
}

function CrashReserveStageBadge({ status, statusLabel }) {
  const tone =
    status === "COMPLETED"
      ? "completed"
      : status === "REVIEW_AVAILABLE"
        ? "review"
        : statusLabel === "시장 데이터 확인 필요"
          ? "data"
          : "waiting"
  return <span className={`yds-home-crash-stage__badge yds-home-crash-stage__badge--${tone}`}>{statusLabel}</span>
}

function HomeContent() {
  const marketContext = useYdsMarketContext()
  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)
  const [settings, setSettings] = useState(() => loadInvestmentHomeSettings())
  const [spyPrices, setSpyPrices] = useState(/** @type {Record<string, number> | null} */ (null))
  const [monthlyLogNonce, setMonthlyLogNonce] = useState(0)
  const [monthlyPanel, setMonthlyPanel] = useState(
    /** @type {'idle' | 'confirm-complete' | 'edit' | 'confirm-cancel'} */ ("idle"),
  )
  const [draftActualExtra, setDraftActualExtra] = useState(0)
  const [draftCompletedAt, setDraftCompletedAt] = useState("")
  const [monthlyActionError, setMonthlyActionError] = useState("")

  const monthKey = useMemo(() => currentStrategyMonthKey(), [])

  useEffect(() => {
    saveInvestmentHomeSettings(settings)
  }, [settings])

  useEffect(() => {
    let cancelled = false
    fetchSpyDailyPrices().then((prices) => {
      if (!cancelled) setSpyPrices(prices)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const cycleHistory = useMemo(
    () => resolveCycleHistoryRows(mergeCycleRows(storeRows ?? [], [])),
    [storeRows],
  )
  const latestPanicData = useMemo(() => {
    const latest = cycleHistory[cycleHistory.length - 1] ?? null
    return latest ? panicDataFromCycleRow(latest) : null
  }, [cycleHistory])

  const report = useMemo(
    () => buildInvestmentHomeReport([], 0, null, marketContext, settings, latestPanicData, spyPrices),
    [latestPanicData, marketContext, settings, spyPrices],
  )

  const strategyJudgment = useMemo(() => buildStrategyMa40Judgment(spyPrices), [spyPrices])

  const strategyReserveAmount = settings.strategyReserve?.currentAmount ?? 0

  const strategyReservePlan = useMemo(() => {
    if (!strategyJudgment.ok || strategyJudgment.multiplier == null || strategyJudgment.stage == null) {
      return null
    }
    return computeStrategyReservePlan({
      stage: strategyJudgment.stage,
      multiplier: strategyJudgment.multiplier,
      strategyReserve: strategyReserveAmount,
      baseTotal: strategyJudgment.baseMonthlyKrw,
    })
  }, [strategyJudgment, strategyReserveAmount])

  const currentMonthEntry = useMemo(
    () => getStrategyMonthlyEntry(monthKey),
    [monthKey, monthlyLogNonce],
  )

  const recentMonthlyEntries = useMemo(() => {
    const rows = listStrategyMonthlyEntries()
      .slice()
      .sort((a, b) => String(b.monthKey).localeCompare(String(a.monthKey)))
    return rows.slice(0, 6)
  }, [monthlyLogNonce])

  const hasCrashTarget = report.crashReserve.targetAmount != null && report.crashReserve.targetAmount > 0

  function syncAfterMonthlyMutation() {
    setSettings(loadInvestmentHomeSettings())
    setMonthlyLogNonce((n) => n + 1)
    setMonthlyPanel("idle")
    setMonthlyActionError("")
  }

  function openCompleteConfirm() {
    if (!strategyReservePlan || currentMonthEntry) return
    setDraftActualExtra(strategyReservePlan.actualExtra)
    setDraftCompletedAt(new Date().toISOString().slice(0, 10))
    setMonthlyActionError("")
    setMonthlyPanel("confirm-complete")
  }

  function openEditPanel() {
    if (!currentMonthEntry) return
    setDraftActualExtra(currentMonthEntry.actualExtra)
    setDraftCompletedAt(formatCompletedAtLabel(currentMonthEntry.completedAt))
    setMonthlyActionError("")
    setMonthlyPanel("edit")
  }

  function submitComplete() {
    if (!strategyReservePlan) return
    const result = completeStrategyMonthlyInvestment({
      monthKey,
      completedAt: draftCompletedAt,
      stage: strategyReservePlan.stage,
      multiplier: strategyReservePlan.multiplier,
      baseTotal: strategyReservePlan.baseTotal,
      targetTotal: strategyReservePlan.targetTotal,
      targetExtra: strategyReservePlan.targetExtra,
      actualExtra: draftActualExtra,
    })
    if (!result.ok) {
      setMonthlyActionError(result.error || "complete_failed")
      return
    }
    syncAfterMonthlyMutation()
  }

  function submitUpdate() {
    if (!currentMonthEntry) return
    const result = updateStrategyMonthlyInvestment(monthKey, {
      actualExtra: draftActualExtra,
      completedAt: draftCompletedAt,
    })
    if (!result.ok) {
      setMonthlyActionError(result.error || "update_failed")
      return
    }
    syncAfterMonthlyMutation()
  }

  function submitCancel() {
    const result = cancelStrategyMonthlyInvestment(monthKey)
    if (!result.ok) {
      setMonthlyActionError(result.error || "cancel_failed")
      return
    }
    syncAfterMonthlyMutation()
  }

  const confirmMaxExtra = strategyReservePlan
    ? Math.min(strategyReservePlan.targetExtra, strategyReserveAmount)
    : 0
  const confirmActualTotal = strategyReservePlan
    ? strategyReservePlan.baseTotal + Math.max(0, Math.round(Number(draftActualExtra) || 0))
    : 0
  const confirmReserveAfter = Math.max(
    0,
    strategyReserveAmount - Math.max(0, Math.round(Number(draftActualExtra) || 0)),
  )

  const editRestoredReserve = currentMonthEntry
    ? strategyReserveAmount + currentMonthEntry.actualExtra
    : 0
  const editMaxExtra = currentMonthEntry
    ? Math.min(currentMonthEntry.targetExtra, editRestoredReserve)
    : 0
  const editActualTotal = currentMonthEntry
    ? currentMonthEntry.baseTotal + Math.max(0, Math.round(Number(draftActualExtra) || 0))
    : 0
  const editReserveAfter = currentMonthEntry
    ? Math.max(0, currentMonthEntry.reserveBefore - Math.max(0, Math.round(Number(draftActualExtra) || 0)))
    : 0

  return (
    <div className="yds-home min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-home__header">
        <div className="yds-home__header-main">
          <p className="yds-home__kicker">YDS 2.0 · Long-term Investment System</p>
          <h1 className="yds-home__title">투자 운영 대시보드</h1>
          <p className="yds-home__sub">
            매달 미국 대표지수 ETF를 꾸준히 적립하고, 대폭락장에서는 준비한 비상자금만 추가 투입하는 장기 투자
            화면입니다.
          </p>
        </div>
        <div className={`yds-home-stage yds-home-stage--${report.stage.tone}`}>
          <span className="yds-home-stage__eyebrow">보조 지표 · 현재 시장 상태</span>
          <strong className="yds-home-stage__title">{report.stage.label}</strong>
          <span className="yds-home-stage__score">
            {report.market.score == null ? "시장 데이터 대기" : `시장 스트레스 ${report.market.score} / 100`}
          </span>
        </div>
      </header>

      <section className="yds-home__section">
        <div className="yds-home__section-head">
          <div>
            <h2>1. YDS 투자 현황 Hero</h2>
            <p>{report.monthKey} 기준 누적 투자와 현재 자금 상태</p>
          </div>
        </div>
        <div className="yds-home__metrics">
          <MetricCard
            label="총 투자자산"
            value={displayMoney(report.overview.totalInvestmentAssets)}
            sub="YDS 2.0 시작 자산 기준"
            tone="accent"
          />
          <MetricCard
            label="누적 투자금"
            value={displayMoney(report.overview.cumulativeInvestedAmount)}
            sub="opening balance 기준 누적 투자금"
          />
          <MetricCard
            label="현재 평가금액"
            value={displayMoney(report.overview.currentValuationAmount)}
            sub="현재 등록된 총 평가금액"
            tone="accent"
          />
          <MetricCard
            label="현재 평가손익"
            value={report.overview.currentProfitLoss == null ? "미입력" : formatSignedMoney(report.overview.currentProfitLoss)}
            sub="계좌별 opening balance 손익 합계"
          />
          <MetricCard
            label="이번 달 적립 예정금"
            value={displayMoney(report.overview.monthlyPlannedAmount, "설정 필요")}
            sub="세 계좌 월 적립 계획 합계"
          />
          <MetricCard
            label="연간 적립 예정금"
            value={displayMoney(report.overview.annualPlannedAmount, "설정 필요")}
            sub="월 적립 계획 x 12"
          />
        </div>
        <div className="yds-home-account-summary">
          <div className="yds-home-account-summary__head">
            <strong>계좌별 적립 계획</strong>
            <span>opening balance와 월 적립 계획을 분리해 표시합니다.</span>
          </div>
          <div className="yds-home-account-summary__rows">
            {report.accounts.map((account) => (
              <div key={account.id} className="yds-home-account-summary__row">
                <span>{account.name}</span>
                <span>{displayMoney(account.openingValuation)}</span>
                <span>{displayMoney(account.monthlyContributionPlan, "설정 필요")}</span>
              </div>
            ))}
            <div className="yds-home-account-summary__row yds-home-account-summary__row--total">
              <span>월 합계</span>
              <span>{displayMoney(report.overview.currentValuationAmount)}</span>
              <span>{displayMoney(report.overview.monthlyPlannedAmount, "설정 필요")}</span>
            </div>
          </div>
        </div>
        <div className="yds-home-account-grid">
          {report.accounts.map((account, index) => (
            <article key={account.id} className="yds-home-account-card">
              <div className="yds-home-account-card__head">
                <strong>{account.name}</strong>
                <span>{account.purpose}</span>
              </div>
              <dl className="yds-home-account-card__stats">
                <div>
                  <dt>현재 평가금액</dt>
                  <dd>{formatMoney(account.openingValuation)}</dd>
                </div>
                <div>
                  <dt>누적 투자금</dt>
                  <dd>{formatMoney(account.openingContribution)}</dd>
                </div>
                <div>
                  <dt>평가손익</dt>
                  <dd>{formatSignedMoney(account.openingProfitLoss)}</dd>
                </div>
                <div>
                  <dt>월 적립 예정금</dt>
                  <dd>
                    <input
                      className="yds-home-inline-input"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={settings.accounts[index]?.monthlyContributionPlan ?? 0}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          accounts: prev.accounts.map((row, rowIndex) =>
                            rowIndex === index
                              ? {
                                  ...row,
                                  monthlyContributionPlan: Math.max(0, Math.round(Number(e.target.value) || 0)),
                                }
                              : row,
                          ),
                        }))
                      }
                    />
                  </dd>
                </div>
              </dl>
              <div className="yds-home-account-card__holdings">
                <span>보유 ETF</span>
                <p>
                  {account.holdings.length
                    ? account.holdings.map((holding) => `${holding.name || holding.ticker}`).join(", ")
                    : "현재 보유 ETF 내역은 아직 입력되지 않음"}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="yds-home__section">
        <div className="yds-home__section-head">
          <div>
            <h2>2. 이번 달 투자 행동</h2>
            <p>시장 예측보다 이번 달 적립을 어떻게 유지할지 먼저 보여줍니다.</p>
          </div>
        </div>
        <div className="yds-home-priority-card">
          <div>
            <span className="yds-home-action-card__label">이번 달 적립</span>
            <strong className="yds-home-priority-card__title">{report.actions.monthlyStatus}</strong>
            <p className="yds-home-priority-card__desc">{report.actions.monthlyPlanLine}</p>
          </div>
          <dl className="yds-home-market-card__meta">
            <div>
              <dt>시장 상태</dt>
              <dd>{report.actions.marketLine}</dd>
            </div>
            <div>
              <dt>행동</dt>
              <dd>{report.actions.actionLine}</dd>
            </div>
            <div>
              <dt>대기자금 준비</dt>
              <dd>
                {report.crashReserve.targetAmount
                  ? `${displayMoney(report.crashReserve.currentAmount)} / 목표 ${displayMoney(report.crashReserve.targetAmount)}`
                  : "설정 필요"}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="yds-home__section" aria-label="YDS 인생 투자전략">
        <div className="yds-home__section-head">
          <div>
            <h2>YDS 인생 투자전략</h2>
            <p>
              YDS 2.0 적립 계획(계좌별 월 적립 예정)과 별개로, 아래는 현재 시장 단계(MA40)와 Strategy
              Reserve를 반영한 <strong>이번 달 실제 투자 계획</strong>입니다.
            </p>
          </div>
        </div>
        {strategyJudgment.ok ? (
          <div className="yds-home-strategy-card">
            <div className="yds-home-strategy-card__hero">
              <span className="yds-home-action-card__label">현재 투자 단계</span>
              <strong className="yds-home-strategy-card__title">
                {strategyJudgment.stageLabel} · {strategyJudgment.multiplier}x
              </strong>
              <p className="yds-home-strategy-card__desc">
                기준 {strategyJudgment.indexLabel} ({strategyJudgment.dataProxy} 대용) ·{" "}
                {strategyJudgment.barBasis} {strategyJudgment.weekEnd}
              </p>
            </div>
            <dl className="yds-home-market-card__meta">
              <div>
                <dt>현재 종가</dt>
                <dd className="font-mono tabular-nums">
                  {strategyJudgment.close == null
                    ? "—"
                    : strategyJudgment.close.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </dd>
              </div>
              <div>
                <dt>MA40</dt>
                <dd className="font-mono tabular-nums">
                  {strategyJudgment.ma40 == null
                    ? "—"
                    : strategyJudgment.ma40.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </dd>
              </div>
              <div>
                <dt>MA40 대비 괴리율</dt>
                <dd className="font-mono tabular-nums">{strategyJudgment.deviationLabel ?? "—"}</dd>
              </div>
              <div>
                <dt>ETF 배분</dt>
                <dd>ETF별 투자금 배분은 사용자 판단</dd>
              </div>
            </dl>
            <ul className="yds-home-strategy-card__table">
              {strategyJudgment.stageTable.map((row) => (
                <li key={row.stage} className={row.stage === strategyJudgment.stage ? "is-active" : undefined}>
                  <span>
                    {row.stage}단계 · {row.multiplier}x
                  </span>
                  <span>{row.rule}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="yds-home-strategy-card yds-home-strategy-card--error">
            <strong className="yds-home-strategy-card__title">데이터 사용 불가</strong>
            <p className="yds-home-strategy-card__desc">
              {strategyJudgment.reason || "완료 주봉을 확인할 수 없어 투자단계를 계산하지 않습니다."}
            </p>
            <p className="yds-home-strategy-card__note">
              임의의 1.0x나 목표 투자금을 표시하지 않습니다. 진행 중 주봉은 사용하지 않습니다.
            </p>
          </div>
        )}

        <div className="yds-home-strategy-card yds-home-strategy-reserve">
          <div className="yds-home-strategy-card__hero">
            <span className="yds-home-action-card__label">Strategy Reserve</span>
            <strong className="yds-home-strategy-card__title">현재 여유자금</strong>
            <p className="yds-home-strategy-card__desc">
              Crash Reserve(폭락 대기자금)와 별개입니다. 실제 여유자금만 입력하며, 추가 투자는 이 한도
              안에서만 계산합니다.
            </p>
          </div>
          <div className="yds-home-form yds-home-form--strategy-reserve">
            <label className="yds-home-form__field">
              <span>Strategy Reserve (₩)</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="10000"
                placeholder="예: 500000"
                value={strategyReserveAmount || ""}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    strategyReserve: {
                      currentAmount: Math.max(0, Math.round(Number(e.target.value) || 0)),
                    },
                  }))
                }
              />
            </label>
          </div>

          {strategyReservePlan ? (
            <>
              <div className="yds-home-strategy-actual">
                <span className="yds-home-strategy-actual__label">이번 달 실제 투자금</span>
                <strong className="yds-home-strategy-actual__value font-mono tabular-nums">
                  {formatMoney(strategyReservePlan.actualTotal)}
                </strong>
                <span className="yds-home-strategy-actual__sub">
                  {strategyReservePlan.stage}단계 · {strategyReservePlan.multiplier}x · 기본{" "}
                  {formatMoney(strategyReservePlan.baseTotal)}
                  {strategyReservePlan.actualExtra > 0
                    ? ` + 추가 ${formatMoney(strategyReservePlan.actualExtra)}`
                    : " (추가 없음)"}
                </span>
              </div>
              <dl className="yds-home-market-card__meta yds-home-strategy-reserve__plan">
                <div>
                  <dt>기본 투자금</dt>
                  <dd className="font-mono tabular-nums">{formatMoney(strategyReservePlan.baseTotal)}</dd>
                </div>
                <div>
                  <dt>목표 총 투자금</dt>
                  <dd className="font-mono tabular-nums">{formatMoney(strategyReservePlan.targetTotal)}</dd>
                </div>
                <div>
                  <dt>목표 추가 투자금</dt>
                  <dd className="font-mono tabular-nums">{formatMoney(strategyReservePlan.targetExtra)}</dd>
                </div>
                <div className="yds-home-strategy-reserve__emphasis">
                  <dt>실제 추가 투자 가능금액</dt>
                  <dd className="font-mono tabular-nums">{formatMoney(strategyReservePlan.actualExtra)}</dd>
                </div>
                <div>
                  <dt>현재 Strategy Reserve</dt>
                  <dd className="font-mono tabular-nums">{formatMoney(strategyReserveAmount)}</dd>
                </div>
                <div>
                  <dt>투자 후 예상 Reserve</dt>
                  <dd className="font-mono tabular-nums">{formatMoney(strategyReservePlan.reserveAfter)}</dd>
                </div>
                <div>
                  <dt>ETF 배분</dt>
                  <dd>ETF별 투자금 배분은 사용자 판단</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="yds-home-strategy-card__note">
              시장 단계(MA40)가 확정되지 않아 목표·실제 투자금을 계산하지 않습니다. Reserve 잔액만
              저장됩니다.
            </p>
          )}
        </div>

        <div className="yds-home-strategy-card yds-home-strategy-month">
          <div className="yds-home-strategy-card__hero">
            <span className="yds-home-action-card__label">이번 달 투자</span>
            <strong className="yds-home-strategy-card__title">{formatMonthKeyLabel(monthKey)}</strong>
            <p className="yds-home-strategy-card__desc">
              ※ 실제 증권계좌 주문은 실행하지 않으며, 사용자가 직접 투자한 내용을 기록합니다.
            </p>
          </div>

          {currentMonthEntry ? (
            <>
              <p className="yds-home-strategy-month__status">
                {formatMonthKeyLabel(currentMonthEntry.monthKey)} 투자 완료
              </p>
              <div className="yds-home-strategy-actual yds-home-strategy-actual--done">
                <span className="yds-home-strategy-actual__label">기록된 실제 투자금</span>
                <strong className="yds-home-strategy-actual__value font-mono tabular-nums">
                  {formatMoney(currentMonthEntry.actualTotal)}
                </strong>
              </div>
              <dl className="yds-home-market-card__meta">
                <div>
                  <dt>투자 완료일</dt>
                  <dd>{formatCompletedAtLabel(currentMonthEntry.completedAt)}</dd>
                </div>
                <div>
                  <dt>당시 단계</dt>
                  <dd>
                    {currentMonthEntry.stage == null
                      ? "—"
                      : `${currentMonthEntry.stage}단계 · ${currentMonthEntry.multiplier}x`}
                  </dd>
                </div>
                <div>
                  <dt>실제 추가 투자금</dt>
                  <dd className="font-mono tabular-nums">{formatMoney(currentMonthEntry.actualExtra)}</dd>
                </div>
                <div>
                  <dt>투자 전 Reserve</dt>
                  <dd className="font-mono tabular-nums">{formatMoney(currentMonthEntry.reserveBefore)}</dd>
                </div>
                <div>
                  <dt>투자 후 Reserve</dt>
                  <dd className="font-mono tabular-nums">{formatMoney(currentMonthEntry.reserveAfter)}</dd>
                </div>
              </dl>

              {monthlyPanel === "idle" ? (
                <div className="yds-home-strategy-month__actions">
                  <button type="button" className="yds-home-strategy-month__btn" onClick={openEditPanel}>
                    수정
                  </button>
                  <button
                    type="button"
                    className="yds-home-strategy-month__btn yds-home-strategy-month__btn--ghost"
                    onClick={() => {
                      setMonthlyActionError("")
                      setMonthlyPanel("confirm-cancel")
                    }}
                  >
                    취소
                  </button>
                </div>
              ) : null}

              {monthlyPanel === "edit" ? (
                <div className="yds-home-strategy-month__confirm">
                  <p className="yds-home-strategy-month__confirm-title">완료 기록 수정</p>
                  <div className="yds-home-strategy-actual yds-home-strategy-actual--done">
                    <span className="yds-home-strategy-actual__label">수정 후 실제 투자금</span>
                    <strong className="yds-home-strategy-actual__value font-mono tabular-nums">
                      {formatMoney(editActualTotal)}
                    </strong>
                  </div>
                  <div className="yds-home-form yds-home-form--strategy-reserve">
                    <label className="yds-home-form__field">
                      <span>실제 추가 투자금 (₩)</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max={editMaxExtra}
                        step="1000"
                        value={draftActualExtra}
                        onChange={(e) => {
                          const raw = Math.round(Number(e.target.value) || 0)
                          setDraftActualExtra(Math.max(0, Math.min(editMaxExtra, raw)))
                        }}
                      />
                    </label>
                    <label className="yds-home-form__field">
                      <span>투자 완료일</span>
                      <input
                        type="date"
                        value={draftCompletedAt}
                        onChange={(e) => setDraftCompletedAt(e.target.value)}
                      />
                    </label>
                  </div>
                  <dl className="yds-home-market-card__meta">
                    <div>
                      <dt>투자 후 Reserve</dt>
                      <dd className="font-mono tabular-nums">{formatMoney(editReserveAfter)}</dd>
                    </div>
                  </dl>
                  {monthlyActionError ? (
                    <p className="yds-home-strategy-card__note">
                      {formatMonthlyActionError(monthlyActionError)}
                    </p>
                  ) : null}
                  <div className="yds-home-strategy-month__actions">
                    <button type="button" className="yds-home-strategy-month__btn" onClick={submitUpdate}>
                      수정 저장
                    </button>
                    <button
                      type="button"
                      className="yds-home-strategy-month__btn yds-home-strategy-month__btn--ghost"
                      onClick={() => {
                        setMonthlyPanel("idle")
                        setMonthlyActionError("")
                      }}
                    >
                      닫기
                    </button>
                  </div>
                </div>
              ) : null}

              {monthlyPanel === "confirm-cancel" ? (
                <div className="yds-home-strategy-month__confirm">
                  <p className="yds-home-strategy-month__confirm-title">
                    이번 달 투자 완료 기록을 취소할까요? 사용했던 Strategy Reserve는 복구됩니다.
                  </p>
                  {monthlyActionError ? (
                    <p className="yds-home-strategy-card__note">
                      {formatMonthlyActionError(monthlyActionError)}
                    </p>
                  ) : null}
                  <div className="yds-home-strategy-month__actions">
                    <button type="button" className="yds-home-strategy-month__btn" onClick={submitCancel}>
                      기록 취소
                    </button>
                    <button
                      type="button"
                      className="yds-home-strategy-month__btn yds-home-strategy-month__btn--ghost"
                      onClick={() => {
                        setMonthlyPanel("idle")
                        setMonthlyActionError("")
                      }}
                    >
                      닫기
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : strategyReservePlan ? (
            <>
              {monthlyPanel === "idle" ? (
                <div className="yds-home-strategy-month__actions">
                  <button
                    type="button"
                    className="yds-home-strategy-month__btn"
                    onClick={openCompleteConfirm}
                  >
                    이번 달 투자 완료
                  </button>
                </div>
              ) : null}

              {monthlyPanel === "confirm-complete" ? (
                <div className="yds-home-strategy-month__confirm">
                  <p className="yds-home-strategy-month__confirm-title">
                    이번 달 실제 투자 내용을 확인해주세요.
                  </p>
                  <div className="yds-home-strategy-actual">
                    <span className="yds-home-strategy-actual__label">이번 달 실제 투자금</span>
                    <strong className="yds-home-strategy-actual__value font-mono tabular-nums">
                      {formatMoney(confirmActualTotal)}
                    </strong>
                  </div>
                  <dl className="yds-home-market-card__meta">
                    <div>
                      <dt>기본 투자금</dt>
                      <dd className="font-mono tabular-nums">
                        {formatMoney(strategyReservePlan.baseTotal)}
                      </dd>
                    </div>
                    <div>
                      <dt>실제 추가 투자금</dt>
                      <dd className="font-mono tabular-nums">{formatMoney(draftActualExtra)}</dd>
                    </div>
                    <div>
                      <dt>투자 후 Reserve</dt>
                      <dd className="font-mono tabular-nums">{formatMoney(confirmReserveAfter)}</dd>
                    </div>
                  </dl>
                  <div className="yds-home-form yds-home-form--strategy-reserve">
                    <label className="yds-home-form__field">
                      <span>실제 추가 투자금 (₩)</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max={confirmMaxExtra}
                        step="1000"
                        value={draftActualExtra}
                        onChange={(e) => {
                          const raw = Math.round(Number(e.target.value) || 0)
                          setDraftActualExtra(Math.max(0, Math.min(confirmMaxExtra, raw)))
                        }}
                      />
                    </label>
                    <label className="yds-home-form__field">
                      <span>투자 완료일</span>
                      <input
                        type="date"
                        value={draftCompletedAt}
                        onChange={(e) => setDraftCompletedAt(e.target.value)}
                      />
                    </label>
                  </div>
                  <dl className="yds-home-market-card__meta yds-home-strategy-reserve__plan">
                    <div>
                      <dt>현재 단계</dt>
                      <dd>
                        {strategyReservePlan.stage}단계 · {strategyReservePlan.multiplier}x
                      </dd>
                    </div>
                    <div>
                      <dt>목표 총 투자금</dt>
                      <dd className="font-mono tabular-nums">
                        {formatMoney(strategyReservePlan.targetTotal)}
                      </dd>
                    </div>
                    <div>
                      <dt>목표 추가 투자금</dt>
                      <dd className="font-mono tabular-nums">
                        {formatMoney(strategyReservePlan.targetExtra)}
                      </dd>
                    </div>
                    <div>
                      <dt>투자 전 Reserve</dt>
                      <dd className="font-mono tabular-nums">{formatMoney(strategyReserveAmount)}</dd>
                    </div>
                  </dl>
                  {monthlyActionError ? (
                    <p className="yds-home-strategy-card__note">
                      {formatMonthlyActionError(monthlyActionError)}
                    </p>
                  ) : null}
                  <div className="yds-home-strategy-month__actions">
                    <button type="button" className="yds-home-strategy-month__btn" onClick={submitComplete}>
                      투자 완료 기록
                    </button>
                    <button
                      type="button"
                      className="yds-home-strategy-month__btn yds-home-strategy-month__btn--ghost"
                      onClick={() => {
                        setMonthlyPanel("idle")
                        setMonthlyActionError("")
                      }}
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <p className="yds-home-strategy-card__note">
              MA40 시장 판단이 확정되지 않아 이번 달 투자 완료를 기록할 수 없습니다.
            </p>
          )}
        </div>

        <div className="yds-home-strategy-card yds-home-strategy-month-history">
          <div className="yds-home-strategy-card__hero">
            <span className="yds-home-action-card__label">월별 투자 기록</span>
            <strong className="yds-home-strategy-card__title">최근 완료 기록</strong>
            <p className="yds-home-strategy-card__desc">최대 6개월 · 과거 스냅샷(현재 MA40/Reserve와 독립)</p>
          </div>
          {recentMonthlyEntries.length === 0 ? (
            <p className="yds-home-strategy-card__note">아직 완료된 월별 기록이 없습니다.</p>
          ) : (
            <ul className="yds-home-strategy-month-history__list">
              {recentMonthlyEntries.map((row) => (
                <li key={`${row.monthKey}-${row.completedAt}`}>
                  <span>{formatMonthKeyLabel(row.monthKey)}</span>
                  <span>{row.stage == null ? "—" : `${row.stage}단계`}</span>
                  <span className="font-mono tabular-nums">{formatMoney(row.actualTotal)}</span>
                  <span className="font-mono tabular-nums">+{formatMoney(row.actualExtra)}</span>
                  <span className="font-mono tabular-nums">{formatMoney(row.reserveAfter)}</span>
                  <span>완료</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="yds-home__section">
        <div className="yds-home__section-head">
          <div>
            <h2>3. 현재 시장 상태</h2>
            <p>시장 스트레스는 적립 중단 여부와 비상자금 사용 여부를 판단하는 보조 정보입니다.</p>
          </div>
        </div>
        <div className="yds-home-market-card">
          <div>
            <strong className="yds-home-market-card__title">
              {report.stage.id === "NORMAL" && "🟢 "}
              {report.stage.id === "CAUTION" && "🟡 "}
              {report.stage.id === "HIGH_STRESS" && "🟠 "}
              {report.stage.id === "CRASH" && "🔴 "}
              {report.stage.id === "EXTREME" && "🔴🔴 "}
              {report.stage.label}
            </strong>
            <p className="yds-home-market-card__desc">{report.stage.actionGuide}</p>
          </div>
          <dl className="yds-home-market-card__meta">
            <div>
              <dt>상태</dt>
              <dd>{report.stage.label}</dd>
            </div>
            <div>
              <dt>행동 가이드</dt>
              <dd>{report.stage.actionGuide}</dd>
            </div>
            <div>
              <dt>데이터 기준일</dt>
              <dd>
                {report.market.dataQuality?.dataDate ?? "미확인"}
                {report.market.dataQuality?.ageDays != null ? ` · ${report.market.dataQuality.ageDays}일 전` : ""}
                {report.market.dataQuality?.stale ? " · stale" : ""}
              </dd>
            </div>
            <div>
              <dt>상세 시장 분석</dt>
              <dd>
                <Link to="/market-analysis">/market-analysis 바로가기</Link>
              </dd>
            </div>
          </dl>
        </div>
        <div className="yds-home-stress-grid">
          <article className="yds-home-action-card">
            <span className="yds-home-action-card__label">단기 공포</span>
            <strong>{report.market.components.shortTermFear.value == null ? "데이터 대기" : `${report.market.components.shortTermFear.value} / 100`}</strong>
            <p>VIX · Put/Call · CNN Fear & Greed</p>
          </article>
          <article className="yds-home-action-card">
            <span className="yds-home-action-card__label">중기 위험</span>
            <strong>{report.market.components.mediumTermRisk.value == null ? "데이터 대기" : `${report.market.components.mediumTermRisk.value} / 100`}</strong>
            <p>BofA · High Yield 기반</p>
          </article>
        </div>
      </section>

      <section className="yds-home__section">
        <div className="yds-home__section-head">
          <div>
            <h2>4. Crash Reserve · 폭락 대응 준비</h2>
            <p>
              월 적립 {displayMoney(report.overview.monthlyPlannedAmount, "30만원")}과 별도로 관리하는 대기자금입니다.
              자동 주문 없이 검토 금액만 표시하며, 최종 판단은 본인이 합니다.
            </p>
          </div>
        </div>

        <article className="yds-home-crash-summary">
          <dl className="yds-home-crash-summary__grid">
            <div>
              <dt>목표금액</dt>
              <dd>{hasCrashTarget ? formatMoney(report.crashReserve.targetAmount) : "설정 필요"}</dd>
            </div>
            <div>
              <dt>현재금액</dt>
              <dd>
                {!hasCrashTarget
                  ? settings.crashReserve.currentAmount > 0
                    ? formatMoney(settings.crashReserve.currentAmount)
                    : "설정 필요"
                  : formatMoney(report.crashReserve.currentAmount ?? 0)}
              </dd>
            </div>
            <div>
              <dt>사용 가능</dt>
              <dd>{hasCrashTarget ? formatMoney(report.crashReserve.availableAmount ?? 0) : "설정 필요"}</dd>
            </div>
            <div>
              <dt>준비도</dt>
              <dd>{report.crashReserve.readyPct == null ? "설정 필요" : `${report.crashReserve.readyPct}%`}</dd>
            </div>
          </dl>
          <dl className="yds-home-crash-summary__context">
            <div>
              <dt>SPY Drawdown (52주)</dt>
              <dd>
                {report.crashReserve.drawdown?.pct == null
                  ? "데이터 확인 필요"
                  : `${report.crashReserve.drawdown.pct}% · ${report.crashReserve.drawdown.level.label}`}
                {report.crashReserve.drawdown?.dataDate
                  ? ` · 기준일 ${report.crashReserve.drawdown.dataDate}`
                  : ""}
                {report.crashReserve.drawdown?.stale ? " · 데이터 오래됨" : ""}
              </dd>
            </div>
            <div>
              <dt>Market Stress</dt>
              <dd>
                {report.market.score == null
                  ? "데이터 확인 필요"
                  : `${report.market.score} / ${report.stage.label}`}
                {report.market.dataQuality?.dataDate ? ` · 기준일 ${report.market.dataQuality.dataDate}` : ""}
                {report.market.dataQuality?.stale ? " · 데이터 오래됨" : ""}
              </dd>
            </div>
          </dl>
        </article>

        <div className="yds-home-crash-split">
          <div className="yds-home-crash-split__head">
            <strong>분할 검토</strong>
            <span>각 단계 20% · 조건 충족 시에만 투입 검토 가능</span>
          </div>
          <div className="yds-home-crash-stage-list">
            {report.crashReserve.stages.map((stage, index) => (
              <article key={stage.id} className="yds-home-crash-stage">
                <div className="yds-home-crash-stage__main">
                  <span className="yds-home-crash-stage__label">
                    {index + 1}차 {stage.pct}%
                  </span>
                  <strong className="yds-home-crash-stage__amount font-mono tabular-nums">
                    {formatStageAmount(stage.amount)}
                  </strong>
                  <span className="yds-home-crash-stage__hint">검토 금액</span>
                </div>
                <CrashReserveStageBadge status={stage.status} statusLabel={stage.statusLabel} />
                <label className="yds-home-crash-stage__done">
                  <input
                    type="checkbox"
                    checked={settings.crashReserve.stageStatuses[index] ?? false}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        crashReserve: {
                          ...prev.crashReserve,
                          stageStatuses: prev.crashReserve.stageStatuses.map((value, rowIndex) =>
                            rowIndex === index ? e.target.checked : value,
                          ),
                        },
                      }))
                    }
                  />
                  <span>완료 처리</span>
                </label>
              </article>
            ))}
          </div>
        </div>

        <div className="yds-home-form yds-home-form--crash">
          <label className="yds-home-form__field">
            <span>Crash Reserve 목표금액</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="10000"
              placeholder="예: 1,000,000"
              value={settings.crashReserve.targetAmount || ""}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  crashReserve: {
                    ...prev.crashReserve,
                    targetAmount: Math.max(0, Math.round(Number(e.target.value) || 0)),
                  },
                }))
              }
            />
          </label>
          <label className="yds-home-form__field">
            <span>현재 대기자금</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="10000"
              value={settings.crashReserve.currentAmount || ""}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  crashReserve: {
                    ...prev.crashReserve,
                    currentAmount: Math.max(0, Math.round(Number(e.target.value) || 0)),
                  },
                }))
              }
            />
          </label>
        </div>
        <p className="yds-home-crash-note">
          opening balance나 총 투자자산을 Crash Reserve로 자동 계산하지 않습니다. 목표금액은 사용자가 직접
          입력합니다.
        </p>
      </section>

      <section className="yds-home__section">
        <div className="yds-home__section-head">
          <div>
            <h2>5. 장기 투자 진행률</h2>
            <p>큰 기능 없이도 투자 시작 시점과 목표 기간을 기준으로 현재 위치를 보여줍니다.</p>
          </div>
        </div>
        <div className="yds-home-progress">
          <article className="yds-home-action-card">
            <span className="yds-home-action-card__label">투자 계획</span>
            <strong>{report.progress.planLabel}</strong>
            <p>{report.progress.isConfigured ? "장기 적립 계획이 설정되어 있습니다." : "장기 투자 계획을 설정하세요."}</p>
          </article>
          <article className="yds-home-action-card">
            <span className="yds-home-action-card__label">투자 시작일</span>
            <strong>{report.progress.investmentStartMonth || "설정 필요"}</strong>
            <p>장기 적립을 시작한 기준 월입니다.</p>
          </article>
          <article className="yds-home-action-card">
            <span className="yds-home-action-card__label">목표까지 남은 기간</span>
            <strong>{report.progress.remainingMonths == null ? "설정 필요" : `${report.progress.remainingMonths}개월`}</strong>
            <p>{report.progress.targetEndMonth ? `${report.progress.targetEndMonth} 목표` : "목표 기간을 입력해 주세요."}</p>
          </article>
          <article className="yds-home-action-card">
            <span className="yds-home-action-card__label">진행률</span>
            <strong>{report.progress.progressPct ?? "설정 필요"}</strong>
            <p>{report.progress.elapsedMonths == null ? "경과 기간 계산 전" : `${report.progress.elapsedMonths}개월 진행`}</p>
          </article>
        </div>
        <div className="yds-home-form">
          <label className="yds-home-form__field">
            <span>투자 시작 월</span>
            <input
              type="month"
              value={settings.investmentStartMonth}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  investmentStartMonth: String(e.target.value || ""),
                }))
              }
            />
          </label>
          <label className="yds-home-form__field">
            <span>목표 기간 (년)</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={settings.targetDurationYears}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  targetDurationYears: Math.max(0, Math.round(Number(e.target.value) || 0)),
                }))
              }
            />
          </label>
        </div>
      </section>

      <section className="yds-home__section">
        <div className="yds-home__section-head">
          <div>
            <h2>6. 투자 대상 ETF</h2>
            <p>오늘의 매수 추천이 아니라 장기 적립 대상으로 보는 대표 ETF입니다.</p>
          </div>
        </div>
        <div className="yds-home-target">
          <div className="yds-home-target__main">
            <strong>{report.investmentTarget.title}</strong>
            <p>{report.investmentTarget.summary}</p>
            <div className="yds-home-target__badges">
              {report.investmentTarget.candidates.map((item) => (
                <span key={item.ticker} className="yds-home-target__badge">
                  {item.ticker === "SPY" && "S&P500 · SPY"}
                  {item.ticker === "QQQ" && "NASDAQ 100 · QQQ"}
                  {item.ticker === "VGT" && "미국 기술주 · VGT"}
                </span>
              ))}
            </div>
          </div>
          <aside className="yds-home-target__aside">
            <strong>종목 분석</strong>
            <p>개별 종목 추천·AI 상세·성과 검증은 그대로 유지하고, 메인에서는 보조 흐름으로만 둡니다.</p>
            <div className="yds-home-target__links">
              <Link to="/stock-picks">종목추천</Link>
              <Link to="/performance-validation">성과 검증</Link>
              <Link to="/portfolio">포트폴리오</Link>
            </div>
          </aside>
        </div>
      </section>

      <section className="yds-home__section">
        <div className="yds-home__section-head">
          <div>
            <h2>7. 투자 원칙</h2>
            <p>시장 예측보다 적립 지속과 자산 축적을 우선하는 YDS 2.0의 기본 원칙입니다.</p>
          </div>
        </div>
        <div className="yds-home-principles">
          {report.principles.map((item, index) => (
            <article key={item} className="yds-home-action-card">
              <span className="yds-home-action-card__label">{String(index + 1).padStart(2, "0")}</span>
              <strong>{item}</strong>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

export default function InvestmentHomePage() {
  return <HomeContent />
}
