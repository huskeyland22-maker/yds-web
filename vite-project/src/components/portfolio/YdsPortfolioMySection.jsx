import { useMemo, useState } from "react"
import { buildPortfolioSummary } from "../../content/ydsPortfolioV2Engine.js"
import { usePortfolioCash } from "../../hooks/usePortfolioCash.js"
import { usePortfolioHoldings } from "../../hooks/usePortfolioHoldings.js"

function formatPct(v) {
  if (v == null || !Number.isFinite(v)) return "—"
  return `${v > 0 ? "+" : ""}${v}%`
}

export default function YdsPortfolioMySection() {
  const { cashAmount } = usePortfolioCash()
  const { positions, manualPositions, addManualPosition, removeManualPosition } =
    usePortfolioHoldings()

  const [name, setName] = useState("")
  const [buyDate, setBuyDate] = useState("")
  const [avgPrice, setAvgPrice] = useState("")
  const [quantity, setQuantity] = useState("")

  const summary = useMemo(
    () => buildPortfolioSummary(positions, cashAmount),
    [positions, cashAmount],
  )

  function handleManualAdd(e) {
    e.preventDefault()
    if (!name.trim()) return
    addManualPosition({
      name: name.trim(),
      buyDate: buyDate || new Date().toISOString().slice(0, 10),
      avgPrice: Number(avgPrice) || 0,
      quantity: Number(quantity) || 0,
    })
    setName("")
    setBuyDate("")
    setAvgPrice("")
    setQuantity("")
  }

  return (
    <section
      className="yds-portfolio__section yds-portfolio-v2__section yds-portfolio-v3__my"
      aria-labelledby="pf-my"
    >
      <h2 id="pf-my" className="yds-portfolio__section-title">
        1 · 내 포트폴리오
      </h2>

      <div className="yds-portfolio-v3__hero" aria-label="포트폴리오 요약">
        <div className="yds-portfolio-v3__metric yds-portfolio-v3__metric--primary">
          <p className="yds-portfolio-v3__metric-label">총 평가금액</p>
          <p className="yds-portfolio-v3__metric-value font-mono tabular-nums">
            {summary.totalValue > 0 ? summary.totalValue.toLocaleString("ko-KR") : "—"}
            {summary.totalValue > 0 ? <span className="yds-portfolio-v3__metric-unit">원</span> : null}
          </p>
        </div>
        <div className="yds-portfolio-v3__metric">
          <p className="yds-portfolio-v3__metric-label">총 수익률</p>
          <p
            className={[
              "yds-portfolio-v3__metric-value font-mono tabular-nums",
              summary.totalReturnPct != null && summary.totalReturnPct > 0
                ? "yds-portfolio-v2__up"
                : "",
              summary.totalReturnPct != null && summary.totalReturnPct < 0
                ? "yds-portfolio-v2__down"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {formatPct(summary.totalReturnPct)}
          </p>
        </div>
        <div className="yds-portfolio-v3__metric">
          <p className="yds-portfolio-v3__metric-label">현금 비중</p>
          <p className="yds-portfolio-v3__metric-value font-mono tabular-nums">
            {summary.totalValue > 0 ? `${summary.cashPct}%` : "—"}
          </p>
        </div>
      </div>

      {!summary.rows.length ? (
        <p className="yds-portfolio-v2__empty">
          매수 기록을 남기면 보유 종목이 자동으로 표시됩니다.
        </p>
      ) : (
        <div className="yds-portfolio-v2__table-wrap">
          <table className="yds-portfolio-v2__table yds-portfolio-v3__holdings-table">
            <thead>
              <tr>
                <th scope="col">보유 종목</th>
                <th scope="col">수익률</th>
                <th scope="col">비중</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.name}</strong>
                    {row.source === "manual" ? (
                      <span className="yds-portfolio-v2__tag">직접입력</span>
                    ) : null}
                  </td>
                  <td
                    className={[
                      "font-mono tabular-nums",
                      row.returnPct != null && row.returnPct > 0 ? "yds-portfolio-v2__up" : "",
                      row.returnPct != null && row.returnPct < 0 ? "yds-portfolio-v2__down" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {formatPct(row.returnPct)}
                  </td>
                  <td className="font-mono tabular-nums">{row.weightPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="yds-portfolio-v2__manual">
        <summary className="yds-portfolio-v2__manual-summary">보유 직접 입력 (선택)</summary>
        <form className="yds-portfolio-v2__form" onSubmit={handleManualAdd}>
          <div className="yds-portfolio-v2__form-grid yds-portfolio-v2__form-grid--manual">
            <label>
              <span>종목명</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="엔비디아" required />
            </label>
            <label>
              <span>매수일</span>
              <input type="date" value={buyDate} onChange={(e) => setBuyDate(e.target.value)} />
            </label>
            <label>
              <span>평균단가</span>
              <input
                type="number"
                min={0}
                value={avgPrice}
                onChange={(e) => setAvgPrice(e.target.value)}
                className="font-mono tabular-nums"
                required
              />
            </label>
            <label>
              <span>보유수량</span>
              <input
                type="number"
                min={0}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="font-mono tabular-nums"
                required
              />
            </label>
          </div>
          <button type="submit" className="yds-portfolio-v2__btn yds-portfolio-v2__btn--primary">
            추가
          </button>
        </form>
        {manualPositions.length ? (
          <ul className="yds-portfolio-v2__manual-list">
            {manualPositions.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                <button
                  type="button"
                  className="yds-portfolio-v2__btn yds-portfolio-v2__btn--danger"
                  onClick={() => removeManualPosition(p.id)}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </details>
    </section>
  )
}
