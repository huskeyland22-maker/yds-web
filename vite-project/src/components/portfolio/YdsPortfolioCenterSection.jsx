import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { buildPortfolioCenterReport } from "../../content/ydsPortfolioCenterEngine.js"
import { todayDateKey } from "../../content/ydsPortfolioTradesStorage.js"
import { usePortfolioHoldings } from "../../hooks/usePortfolioHoldings.js"
import { useYdsMarketContext } from "../../hooks/useYdsMarketContext.js"
import YdsPortfolioStockSearchInput from "./YdsPortfolioStockSearchInput.jsx"

function StatCard({ label, value, sub, tone = "neutral" }) {
  const toneClass =
    tone === "up" ? "yds-pf-center__stat--up" : tone === "down" ? "yds-pf-center__stat--down" : ""
  return (
    <article className={`yds-pf-center__stat ${toneClass}`}>
      <span className="yds-pf-center__stat-key">{label}</span>
      <strong className="yds-pf-center__stat-val font-mono tabular-nums">{value}</strong>
      {sub ? <span className="yds-pf-center__stat-sub">{sub}</span> : null}
    </article>
  )
}

function OpinionBadge({ opinion }) {
  const cls = `yds-pf-center__opinion yds-pf-center__opinion--${opinion?.id ?? "hold"}`
  return <span className={cls}>{opinion?.label ?? "—"}</span>
}

function SectorBar({ sectors, cashPct }) {
  if (!sectors.length && cashPct <= 0) {
    return <p className="yds-pf-center__note">보유 종목을 등록하면 업종 비중이 표시됩니다.</p>
  }
  const rows = [...sectors]
  if (cashPct > 0) rows.push({ sector: "현금", weightPct: cashPct })

  return (
    <div className="yds-pf-center__sector-list">
      {rows.map((row) => (
        <div key={row.sector} className="yds-pf-center__sector-row">
          <div className="yds-pf-center__sector-head">
            <span>{row.sector}</span>
            <strong className="font-mono tabular-nums">{row.weightPct}%</strong>
          </div>
          <div className="yds-pf-center__sector-track" aria-hidden="true">
            <div className="yds-pf-center__sector-fill" style={{ width: `${Math.min(100, row.weightPct)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function YdsPortfolioCenterSection() {
  const marketContext = useYdsMarketContext()
  const { trades, addTrade, portfolio, cashAmount, quoteMap, usdkrw, quotesLoading } =
    usePortfolioHoldings()

  const [selectedStock, setSelectedStock] = useState(
    /** @type {import("../../content/ydsPortfolioStockSearch.js").PortfolioStockOption | null} */ (null),
  )
  const [quantity, setQuantity] = useState("")
  const [unitPrice, setUnitPrice] = useState("")

  const report = useMemo(
    () => buildPortfolioCenterReport(trades, cashAmount, marketContext, quoteMap, usdkrw, portfolio),
    [trades, cashAmount, marketContext, quoteMap, usdkrw, portfolio],
  )

  function handleRegister(e) {
    e.preventDefault()
    if (!selectedStock?.ticker) return
    const qty = Number(quantity)
    const unit = Number(unitPrice)
    if (!qty || qty <= 0 || !unit || unit <= 0) return

    addTrade({
      action: "buy",
      name: selectedStock.name,
      ticker: selectedStock.ticker,
      country: selectedStock.country,
      quantity: qty,
      unitPrice: unit,
      date: todayDateKey(),
      memo: "포트폴리오 센터 등록",
    })

    setSelectedStock(null)
    setQuantity("")
    setUnitPrice("")
  }

  const returnTone =
    report.totalReturnPct != null && report.totalReturnPct > 0
      ? "up"
      : report.totalReturnPct != null && report.totalReturnPct < 0
        ? "down"
        : "neutral"

  return (
    <div className="yds-pf-center">
      <header className="yds-pf-center__header">
        <div>
          <p className="yds-pf-center__kicker">Portfolio Center · 실제 자산 관리</p>
          <h2 className="yds-pf-center__title">포트폴리오 센터</h2>
          <p className="yds-pf-center__sub">
            보유 종목을{" "}
            <Link to="/market-analysis">시장상태</Link>
            와 연결해 분석합니다 · 추천이 아닌 운영 리포트
            {marketContext?.ready ? (
              <>
                {" "}
                · 현재 {marketContext.strategyEmoji} {marketContext.strategyLabel}
              </>
            ) : null}
            {quotesLoading ? " · 시세 갱신 중…" : null}
          </p>
        </div>
        {report.hasHoldings ? (
          <div className="yds-pf-center__hero-mini font-mono tabular-nums">
            <span>총자산</span>
            <strong>{Math.round(report.totalAssets).toLocaleString("ko-KR")}원</strong>
          </div>
        ) : null}
      </header>

      <section className="yds-pf-center__section" aria-labelledby="pfc-register">
        <h3 id="pfc-register" className="yds-pf-center__h2">
          1 · 보유종목 등록
        </h3>
        <form className="yds-pf-center__form" onSubmit={handleRegister}>
          <div className="yds-pf-center__form-grid">
            <div className="yds-pf-center__field-wide">
              <span className="yds-pf-center__label">종목명</span>
              <YdsPortfolioStockSearchInput value={selectedStock} onChange={setSelectedStock} required />
            </div>
            <label>
              <span className="yds-pf-center__label">수량</span>
              <input
                type="number"
                min={0.0001}
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="10"
                className="font-mono tabular-nums"
                required
              />
            </label>
            <label>
              <span className="yds-pf-center__label">평단</span>
              <input
                type="number"
                min={0.01}
                step="any"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder={selectedStock?.country === "kr" ? "230000" : "120"}
                className="font-mono tabular-nums"
                required
              />
            </label>
          </div>
          <button type="submit" className="yds-pf-center__btn" disabled={!selectedStock?.ticker}>
            보유 등록 (매수 기록)
          </button>
        </form>
        <p className="yds-pf-center__note">
          종목 검색 후 수량·평단을 입력합니다 · 매도·수정은 하단 거래 기록에서 관리
        </p>
      </section>

      <section className="yds-pf-center__section" aria-labelledby="pfc-analysis">
        <h3 id="pfc-analysis" className="yds-pf-center__h2">
          2 · 포트폴리오 분석
        </h3>
        <div className="yds-pf-center__stat-grid">
          <StatCard
            label="시장 적합도"
            value={`${report.analysis.marketFitPct}%`}
            sub={report.analysis.marketFitLabel}
            tone={report.analysis.marketFitPct >= 75 ? "up" : report.analysis.marketFitPct < 50 ? "down" : "neutral"}
          />
          <StatCard
            label="위험도"
            value={report.analysis.risk.label}
            sub={`점수 ${report.analysis.risk.score}`}
            tone={report.analysis.risk.label === "높음" ? "down" : "neutral"}
          />
          <StatCard
            label="집중도"
            value={report.analysis.concentration.label}
            sub={`최대 ${report.analysis.concentration.maxWeight}% · HHI ${report.analysis.concentration.hhi}`}
          />
          <StatCard
            label="현금 비중"
            value={`${report.cashPct}%`}
            sub={`주식 ${Math.round(100 - report.cashPct)}%`}
          />
          {report.totalReturnPct != null ? (
            <StatCard
              label="총 수익률"
              value={`${report.totalReturnPct > 0 ? "+" : ""}${report.totalReturnPct}%`}
              tone={returnTone}
            />
          ) : null}
        </div>
      </section>

      <section className="yds-pf-center__section" aria-labelledby="pfc-holdings">
        <h3 id="pfc-holdings" className="yds-pf-center__h2">
          3 · 종목별 의견
        </h3>
        {!report.holdings.length ? (
          <p className="yds-pf-center__note">등록된 보유 종목이 없습니다.</p>
        ) : (
          <div className="yds-pf-center__table-wrap">
            <table className="yds-pf-center__table">
              <thead>
                <tr>
                  <th>종목</th>
                  <th>업종</th>
                  <th>비중</th>
                  <th>수익률</th>
                  <th>상태</th>
                  <th>의견</th>
                </tr>
              </thead>
              <tbody>
                {report.holdings.map((row) => (
                  <tr key={row.id ?? row.ticker}>
                    <td>
                      <strong>{row.name}</strong>
                      <span className="yds-pf-center__ticker font-mono">{row.ticker}</span>
                    </td>
                    <td>{row.sectorLabel}</td>
                    <td className="font-mono tabular-nums">{row.weightPct}%</td>
                    <td
                      className={`font-mono tabular-nums ${
                        row.returnPct != null && row.returnPct > 0
                          ? "yds-pf-center__up"
                          : row.returnPct != null && row.returnPct < 0
                            ? "yds-pf-center__down"
                            : ""
                      }`}
                    >
                      {row.returnPct != null ? `${row.returnPct > 0 ? "+" : ""}${row.returnPct}%` : "—"}
                    </td>
                    <td>{row.action?.stockStatus?.label ?? "—"}</td>
                    <td>
                      <OpinionBadge opinion={row.opinion} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="yds-pf-center__split">
        <section className="yds-pf-center__section" aria-labelledby="pfc-sector">
          <h3 id="pfc-sector" className="yds-pf-center__h2">
            4 · 섹터 분석
          </h3>
          <SectorBar sectors={report.sectorBreakdown.sectors} cashPct={report.sectorBreakdown.cashPct} />
        </section>

        <section className="yds-pf-center__section" aria-labelledby="pfc-market">
          <h3 id="pfc-market" className="yds-pf-center__h2">
            5 · 시장상태 연동
          </h3>
          <div className="yds-pf-center__market-card">
            <p className="yds-pf-center__market-stage">
              {report.market.stageEmoji} {report.market.stageLabel}
              <span className="yds-pf-center__market-panic"> · {report.market.panicLabel}</span>
            </p>
            <div className="yds-pf-center__alloc-grid">
              <div>
                <span className="yds-pf-center__alloc-key">권장 현금</span>
                <strong className="font-mono tabular-nums">{report.market.recommendedCashPct}%</strong>
              </div>
              <div>
                <span className="yds-pf-center__alloc-key">권장 주식</span>
                <strong className="font-mono tabular-nums">{report.market.recommendedStockPct}%</strong>
              </div>
              <div>
                <span className="yds-pf-center__alloc-key">실제 현금</span>
                <strong className="font-mono tabular-nums">{report.market.actualCashPct}%</strong>
              </div>
              <div>
                <span className="yds-pf-center__alloc-key">실제 주식</span>
                <strong className="font-mono tabular-nums">{report.market.actualStockPct}%</strong>
              </div>
            </div>
            {report.market.note ? <p className="yds-pf-center__note">{report.market.note}</p> : null}
            {report.analysis.rebalance?.conclusion ? (
              <p className="yds-pf-center__rebalance">{report.analysis.rebalance.conclusion}</p>
            ) : null}
          </div>
        </section>
      </div>

      <section className="yds-pf-center__section" aria-labelledby="pfc-risk">
        <h3 id="pfc-risk" className="yds-pf-center__h2">
          6 · 리스크 경고
        </h3>
        {!report.warnings.length ? (
          <p className="yds-pf-center__note yds-pf-center__note--ok">현재 특별 경고 없음</p>
        ) : (
          <ul className="yds-pf-center__warnings">
            {report.warnings.map((w, i) => (
              <li key={i} className={`yds-pf-center__warn yds-pf-center__warn--${w.level}`}>
                {w.message}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
