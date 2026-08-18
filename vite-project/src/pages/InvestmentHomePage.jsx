import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { buildInvestmentHomeReport } from "../content/ydsInvestmentHomeEngine.js"
import {
  loadInvestmentHomeSettings,
  saveInvestmentHomeSettings,
} from "../content/ydsInvestmentHomeStorage.js"
import { useYdsMarketContext } from "../hooks/useYdsMarketContext.js"
import { useAppDataStore } from "../store/appDataStore.js"
import { panicDataFromCycleRow, mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import "../styles/yds-investment-home.css"

/** @param {number | null | undefined} value */
function formatMoney(value) {
  return `${Math.round(Number(value) || 0).toLocaleString("ko-KR")}원`
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

function HomeContent() {
  const marketContext = useYdsMarketContext()
  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)
  const [settings, setSettings] = useState(() => loadInvestmentHomeSettings())

  useEffect(() => {
    saveInvestmentHomeSettings(settings)
  }, [settings])

  const cycleHistory = useMemo(
    () => resolveCycleHistoryRows(mergeCycleRows(storeRows ?? [], [])),
    [storeRows],
  )
  const latestPanicData = useMemo(() => {
    const latest = cycleHistory[cycleHistory.length - 1] ?? null
    return latest ? panicDataFromCycleRow(latest) : null
  }, [cycleHistory])

  const report = useMemo(
    () => buildInvestmentHomeReport([], 0, null, marketContext, settings, latestPanicData),
    [latestPanicData, marketContext, settings],
  )

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
            <h2>4. 폭락 대응 준비도</h2>
            <p>월 적립 계획과 분리된 별도 대기자금 기능은 다음 단계에서 구현합니다.</p>
          </div>
        </div>
        <article className="yds-home-action-card">
          <span className="yds-home-action-card__label">목표 대기자금</span>
          <strong>{displayMoney(report.crashReserve.targetAmount, "설정 필요")}</strong>
          <p>월 적립과 분리된 폭락 대응 전용 자금 목표입니다.</p>
        </article>
        <div className="yds-home-actions yds-home-actions--readiness">
          <article className="yds-home-action-card">
            <span className="yds-home-action-card__label">현재 대기자금</span>
            <strong>{displayMoney(report.crashReserve.currentAmount, "설정 필요")}</strong>
            <p>현재 확보된 폭락 대응용 자금입니다.</p>
          </article>
          <article className="yds-home-action-card">
            <span className="yds-home-action-card__label">사용 가능</span>
            <strong>{displayMoney(report.crashReserve.availableAmount, "설정 필요")}</strong>
            <p>자동 주문 없이 사용자가 직접 판단하는 가이드 금액입니다.</p>
          </article>
          <article className="yds-home-action-card">
            <span className="yds-home-action-card__label">기본 단계 수</span>
            <strong>{report.crashReserve.stageCount}단계</strong>
            <p>기본값은 5단계이며 3~5단계로 조정할 수 있습니다.</p>
          </article>
          <article className="yds-home-action-card">
            <span className="yds-home-action-card__label">준비도</span>
            <strong>{report.crashReserve.readyPct == null ? "설정 필요" : `${report.crashReserve.readyPct}%`}</strong>
            <p>목표 대비 현재 대기자금 비율입니다.</p>
          </article>
          <article className="yds-home-action-card">
            <span className="yds-home-action-card__label">대응 단계 가이드</span>
            <strong>{report.stage.label}</strong>
            <p>{report.stage.actionGuide} 자동 주문 없이 화면 가이드만 표시합니다.</p>
          </article>
        </div>
        <div className="yds-home-crash-stages">
          {report.crashReserve.stages.map((stage) => (
            <article key={stage.id} className="yds-home-action-card">
              <span className="yds-home-action-card__label">{stage.label}</span>
              <strong>{stage.amount == null ? `${stage.pct}%` : `${stage.pct}% · ${formatMoney(stage.amount)}`}</strong>
              <p>{stage.completed ? "완료" : "미완료"}</p>
            </article>
          ))}
        </div>
        <div className="yds-home-form">
          <label className="yds-home-form__field">
            <span>대기자금 목표</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={settings.crashReserve.targetAmount}
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
              value={settings.crashReserve.currentAmount}
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
          <label className="yds-home-form__field">
            <span>투입 단계 수 (3~5)</span>
            <input
              type="number"
              inputMode="numeric"
              min="3"
              max="5"
              value={settings.crashReserve.stageCount}
              onChange={(e) =>
                setSettings((prev) => {
                  const stageCount = Math.max(3, Math.min(5, Math.round(Number(e.target.value) || 5)))
                  return {
                    ...prev,
                    crashReserve: {
                      ...prev.crashReserve,
                      stageCount,
                      stagePercentages: prev.crashReserve.stagePercentages.slice(0, stageCount),
                      stageStatuses: prev.crashReserve.stageStatuses.slice(0, stageCount),
                    },
                  }
                })
              }
            />
          </label>
        </div>
        <div className="yds-home-stage-percentages">
          {settings.crashReserve.stagePercentages.slice(0, settings.crashReserve.stageCount).map((value, index) => (
            <label key={`stage-pct-${index + 1}`} className="yds-home-form__field">
              <span>{index + 1}차 비율 (%)</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                max="100"
                value={value}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    crashReserve: {
                      ...prev.crashReserve,
                      stagePercentages: prev.crashReserve.stagePercentages.map((pct, pctIndex) =>
                        pctIndex === index ? Math.max(0, Math.round(Number(e.target.value) || 0)) : pct,
                      ),
                    },
                  }))
                }
              />
            </label>
          ))}
        </div>
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
