import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { PortfolioStateProvider, usePortfolioHoldings } from "../context/PortfolioStateContext.jsx"
import { buildInvestmentHomeReport } from "../content/ydsInvestmentHomeEngine.js"
import {
  loadInvestmentHomeSettings,
  saveInvestmentHomeSettings,
} from "../content/ydsInvestmentHomeStorage.js"
import { useYdsMarketContext } from "../hooks/useYdsMarketContext.js"
import "../styles/yds-investment-home.css"

/** @param {number | null | undefined} value */
function formatMoney(value) {
  return `${Math.round(Number(value) || 0).toLocaleString("ko-KR")}원`
}

/** @param {number | null | undefined} value @param {string} fallback */
function displayMoney(value, fallback = "아직 입력되지 않음") {
  return value == null ? fallback : formatMoney(value)
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
  const { trades, cashAmount, portfolio } = usePortfolioHoldings()
  const [settings, setSettings] = useState(() => loadInvestmentHomeSettings())

  useEffect(() => {
    saveInvestmentHomeSettings(settings)
  }, [settings])

  const report = useMemo(
    () => buildInvestmentHomeReport(trades, cashAmount, portfolio, marketContext, settings),
    [trades, cashAmount, portfolio, marketContext, settings],
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
            {report.market.score == null ? "시장 데이터 대기" : `시장 스트레스 ${report.market.score}`}
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
            sub="보유 자산 + 현금"
            tone="accent"
          />
          <MetricCard
            label="누적 투자금"
            value={displayMoney(report.overview.cumulativeInvestedAmount)}
            sub="기존 buy 거래 누적"
          />
          <MetricCard
            label="현재 평가금액"
            value={displayMoney(report.overview.currentValuationAmount)}
            sub="보유 중인 투자자산 평가"
            tone="accent"
          />
          <MetricCard
            label="이번 달 적립 예정금"
            value={displayMoney(report.overview.monthlyPlannedAmount, "설정 필요")}
            sub="수동 입력 · 아직 자동 알고리즘 없음"
          />
          <MetricCard
            label="이번 달 실제 투자금"
            value={displayMoney(report.overview.monthlyInvestedAmount)}
            sub="기존 buy 거래 합산"
          />
          <MetricCard
            label="대기 현금"
            value={displayMoney(report.overview.waitingCash)}
            sub="당장 적립 또는 추가 투입 전까지 보유하는 현금"
          />
          <MetricCard
            label="비상자금"
            value={displayMoney(report.overview.emergencyCash, "설정 필요")}
            sub={
              report.overview.reserveTarget > 0
                ? `${formatMoney(report.overview.reserveTarget)} 목표`
                : "설정 필요"
            }
            tone="warn"
          />
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
              <dt>비상자금</dt>
              <dd>{report.overview.reserveStatus}</dd>
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
              {report.stage.id === "normal" && "🟢 "}
              {report.stage.id === "adjustment" && "🟡 "}
              {report.stage.id === "stress" && "🟠 "}
              {report.stage.id === "fear" && "🔴 "}
              {report.stage.id === "crash" && "🔴🔴 "}
              {report.stage.label}
            </strong>
            <p className="yds-home-market-card__desc">{report.ydsActionLine}</p>
          </div>
          <dl className="yds-home-market-card__meta">
            <div>
              <dt>적립 중단 필요 여부</dt>
              <dd>{report.stage.id === "crash" ? "아니오 · 평소 적립은 유지" : "아니오 · 예정된 적립 유지"}</dd>
            </div>
            <div>
              <dt>비상자금 사용 여부</dt>
              <dd>{report.stage.id === "crash" ? "검토 가능" : "아직 사용하지 않음"}</dd>
            </div>
            <div>
              <dt>상세 시장 분석</dt>
              <dd>
                <Link to="/market-analysis">/market-analysis 바로가기</Link>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="yds-home__section">
        <div className="yds-home__section-head">
          <div>
            <h2>4. 폭락 대응 준비도</h2>
            <p>대폭락장이 왔을 때만 사용할 비상자금을 별도로 관리합니다.</p>
          </div>
        </div>
        <div className="yds-home-actions yds-home-actions--readiness">
          <article className="yds-home-action-card">
            <span className="yds-home-action-card__label">비상자금 목표</span>
            <strong>{report.overview.reserveTarget > 0 ? formatMoney(report.overview.reserveTarget) : "설정 필요"}</strong>
            <p>생활비와 분리해서 보관할 목표 금액입니다.</p>
          </article>
          <article className="yds-home-action-card">
            <span className="yds-home-action-card__label">현재 비상자금</span>
            <strong>{displayMoney(report.overview.emergencyCash, "설정 필요")}</strong>
            <p>{report.overview.reserveStatus}</p>
          </article>
          <article className="yds-home-action-card">
            <span className="yds-home-action-card__label">추가 투입 가능 금액</span>
            <strong>{displayMoney(report.overview.deployableCashAmount, "설정 필요")}</strong>
            <p>대폭락 구간에서만 검토하는 추가 투입 여력입니다.</p>
          </article>
          <article className="yds-home-action-card">
            <span className="yds-home-action-card__label">비상자금 준비율</span>
            <strong>{report.overview.reserveCoveragePct == null ? "설정 필요" : `${Math.round(report.overview.reserveCoveragePct)}%`}</strong>
            <p>{report.overview.deploymentReadiness}</p>
          </article>
        </div>
        <div className="yds-home-form">
          <label className="yds-home-form__field">
            <span>이번 달 적립 예정금</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={settings.monthlyPlannedAmount}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  monthlyPlannedAmount: Math.max(0, Math.round(Number(e.target.value) || 0)),
                }))
              }
            />
          </label>
          <label className="yds-home-form__field">
            <span>비상자금 목표/예약금</span>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={settings.emergencyCashReserve}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  emergencyCashReserve: Math.max(0, Math.round(Number(e.target.value) || 0)),
                }))
              }
            />
          </label>
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
  return (
    <PortfolioStateProvider>
      <HomeContent />
    </PortfolioStateProvider>
  )
}
