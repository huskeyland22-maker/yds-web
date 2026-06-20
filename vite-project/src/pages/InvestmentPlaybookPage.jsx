import { useMemo } from "react"
import { Link } from "react-router-dom"
import { buildInvestmentPlaybookReport } from "../content/ydsInvestmentPlaybookEngine.js"
import { PortfolioStateProvider, usePortfolioHoldings } from "../context/PortfolioStateContext.jsx"
import { useYdsMarketContext } from "../hooks/useYdsMarketContext.js"
import { useAppDataStore } from "../store/appDataStore.js"
import { panicDataFromCycleRow, mergeCycleRows } from "../utils/cycleHistoryUtils.js"
import { resolveCycleHistoryRows } from "../utils/panicHistoryRows.js"
import YdsV1ReleaseBadge from "../components/trust/YdsV1ReleaseBadge.jsx"

function PrincipleCard({ title, children, active = false }) {
  return (
    <article className={`yds-playbook__card ${active ? "yds-playbook__card--active" : ""}`}>
      {title ? <h3 className="yds-playbook__card-title">{title}</h3> : null}
      {children}
    </article>
  )
}

function RuleList({ items, variant = "action" }) {
  return (
    <ul className={`yds-playbook__list yds-playbook__list--${variant}`}>
      {items.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  )
}

function PlaybookContent() {
  const marketContext = useYdsMarketContext()
  const storeRows = useAppDataStore((s) => s.cycleMetricHistory)
  const history = useMemo(
    () => resolveCycleHistoryRows(mergeCycleRows(storeRows ?? [], [])),
    [storeRows],
  )
  const panicData = useMemo(() => {
    const latest = history[history.length - 1] ?? null
    return latest ? panicDataFromCycleRow(latest) : null
  }, [history])

  const { trades, cashAmount, quoteMap, usdkrw } = usePortfolioHoldings()

  const report = useMemo(
    () =>
      buildInvestmentPlaybookReport(
        marketContext?.ready ? marketContext : null,
        trades,
        cashAmount,
        quoteMap,
        usdkrw,
        panicData,
      ),
    [marketContext, trades, cashAmount, quoteMap, usdkrw, panicData],
  )

  const { snapshot, compliance } = report

  return (
    <div className="yds-playbook min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-playbook__header">
        <div>
          <YdsV1ReleaseBadge compact />
          <p className="yds-playbook__kicker">Investment Playbook · YDS</p>
          <h1 className="yds-playbook__title">투자 원칙 센터</h1>
          <p className="yds-playbook__sub">
            <Link to="/market-analysis">시장분석</Link> 결과를 행동 원칙으로 · 현재{" "}
            <strong>{snapshot.currentMarketLabel}</strong>
            {snapshot.panicScore != null ? (
              <>
                {" "}
                · 패닉 {snapshot.panicScore}점
              </>
            ) : null}
          </p>
        </div>
        <div className="yds-playbook__compliance-badge">
          <span className="yds-playbook__compliance-grade">{compliance.grade}</span>
          <strong className="yds-playbook__compliance-pct font-mono tabular-nums">
            {compliance.scorePct}%
          </strong>
          <span className="yds-playbook__compliance-label">준수율</span>
        </div>
      </header>

      <section className="yds-playbook__section" aria-labelledby="pb-compliance">
        <h2 id="pb-compliance" className="yds-playbook__h2">
          6 · 준수율
        </h2>
        <p className="yds-playbook__note">
          포트폴리오·최근 거래가 Playbook과 얼마나 맞는지 ·{" "}
          <Link to="/portfolio">포트폴리오 센터</Link> 데이터 기준
        </p>
        <div className="yds-playbook__compliance-grid">
          {compliance.items.map((item) => (
            <div
              key={item.id}
              className={`yds-playbook__compliance-row ${item.ok ? "yds-playbook__compliance-row--ok" : "yds-playbook__compliance-row--warn"}`}
            >
              <span>{item.label}</span>
              <span>{item.detail}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="yds-playbook__section" aria-labelledby="pb-market">
        <h2 id="pb-market" className="yds-playbook__h2">
          1 · 시장상태별 행동원칙
        </h2>
        <div className="yds-playbook__grid">
          {snapshot.marketPrinciples.map((p) => (
            <PrincipleCard
              key={p.id}
              title={`${p.emoji} ${p.label}${p.isCurrent ? " · 현재" : ""}`}
              active={p.isCurrent}
            >
              <p className="yds-playbook__strategy">{p.strategy}</p>
              <RuleList items={p.actions} />
              {p.avoid.length ? (
                <>
                  <p className="yds-playbook__avoid-title">금지</p>
                  <RuleList items={p.avoid} variant="avoid" />
                </>
              ) : null}
              <p className="yds-playbook__cash">{p.cashGuide}</p>
            </PrincipleCard>
          ))}
        </div>
      </section>

      <section className="yds-playbook__section" aria-labelledby="pb-panic">
        <h2 id="pb-panic" className="yds-playbook__h2">
          2 · 패닉강도별 분할매수 원칙
        </h2>
        <div className="yds-playbook__grid yds-playbook__grid--panic">
          {snapshot.panicBands.map((band) => {
            const active =
              snapshot.panicScore != null &&
              snapshot.panicScore >= band.min &&
              snapshot.panicScore <= band.max
            return (
              <PrincipleCard key={band.label} title={band.label} active={active}>
                <RuleList items={band.rules} />
              </PrincipleCard>
            )
          })}
        </div>
      </section>

      <div className="yds-playbook__split">
        <section className="yds-playbook__section" aria-labelledby="pb-profit">
          <h2 id="pb-profit" className="yds-playbook__h2">
            3 · 수익률 원칙
          </h2>
          {snapshot.profitRules.map((r) => (
            <div key={r.label} className="yds-playbook__rule-row">
              <span className="yds-playbook__rule-th font-mono tabular-nums">{r.label}</span>
              <span>{r.action}</span>
            </div>
          ))}
        </section>

        <section className="yds-playbook__section" aria-labelledby="pb-loss">
          <h2 id="pb-loss" className="yds-playbook__h2">
            4 · 손실 원칙
          </h2>
          {snapshot.lossRules.map((r) => (
            <div key={r.label} className="yds-playbook__rule-row yds-playbook__rule-row--loss">
              <span className="yds-playbook__rule-th font-mono tabular-nums">{r.label}</span>
              <span>{r.action}</span>
            </div>
          ))}
        </section>
      </div>

      <section className="yds-playbook__section" aria-labelledby="pb-portfolio">
        <h2 id="pb-portfolio" className="yds-playbook__h2">
          5 · 포트폴리오 원칙
        </h2>
        <div className="yds-playbook__alloc">
          <div>
            <span className="yds-playbook__alloc-key">권장 현금</span>
            <strong className="font-mono tabular-nums">{snapshot.portfolio.recommendedCashPct}%</strong>
            <span className="yds-playbook__alloc-actual">
              실제 {compliance.analysis.actualCashPct}%
            </span>
          </div>
          <div>
            <span className="yds-playbook__alloc-key">권장 주식</span>
            <strong className="font-mono tabular-nums">{snapshot.portfolio.recommendedStockPct}%</strong>
          </div>
          <div>
            <span className="yds-playbook__alloc-key">미국</span>
            <strong className="font-mono tabular-nums">{snapshot.portfolio.recommendedUsPct}%</strong>
          </div>
          <div>
            <span className="yds-playbook__alloc-key">한국</span>
            <strong className="font-mono tabular-nums">{snapshot.portfolio.recommendedKrPct}%</strong>
          </div>
        </div>
        <p className="yds-playbook__note">{snapshot.portfolio.note}</p>
        {snapshot.buyIntensityPct != null ? (
          <p className="yds-playbook__note">신규 투입 매수 강도 · {snapshot.buyIntensityPct}%</p>
        ) : null}
      </section>

      <p className="yds-playbook__foot">
        Playbook은 YDS 시장상태·패닉·포트폴리오 엔진과 연동 · 투자 책임은 본인에게 있습니다
      </p>
    </div>
  )
}

export default function InvestmentPlaybookPage() {
  return (
    <PortfolioStateProvider>
      <PlaybookContent />
    </PortfolioStateProvider>
  )
}
