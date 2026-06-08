import { useMemo, useState } from "react"
import { buildPositionRows } from "../../content/ydsPortfolioV2Engine.js"
import { usePortfolioCash } from "../../hooks/usePortfolioCash.js"
import { usePortfolioPositions } from "../../hooks/usePortfolioPositions.js"

function formatPct(v) {
  if (v == null || !Number.isFinite(v)) return "—"
  return `${v > 0 ? "+" : ""}${v}%`
}

export default function YdsPortfolioHoldingsSection() {
  const { cashAmount } = usePortfolioCash()
  const { positions, addPosition, removePosition } = usePortfolioPositions()

  const [name, setName] = useState("")
  const [ticker, setTicker] = useState("")
  const [country, setCountry] = useState(/** @type {'us'|'kr'} */ ("us"))
  const [buyDate, setBuyDate] = useState("")
  const [avgPrice, setAvgPrice] = useState("")
  const [quantity, setQuantity] = useState("")
  const [currentPrice, setCurrentPrice] = useState("")

  const { rows } = useMemo(
    () => buildPositionRows(positions, cashAmount),
    [positions, cashAmount],
  )

  function handleAdd(e) {
    e.preventDefault()
    if (!name.trim()) return
    addPosition({
      name: name.trim(),
      ticker: ticker.trim().toUpperCase(),
      country,
      buyDate: buyDate || new Date().toISOString().slice(0, 10),
      avgPrice: Number(avgPrice) || 0,
      quantity: Number(quantity) || 0,
      currentPrice: currentPrice ? Number(currentPrice) : null,
    })
    setName("")
    setTicker("")
    setBuyDate("")
    setAvgPrice("")
    setQuantity("")
    setCurrentPrice("")
  }

  return (
    <section className="yds-portfolio__section yds-portfolio-v2__section" aria-labelledby="pf-holdings">
      <h2 id="pf-holdings" className="yds-portfolio__section-title">
        1 · 현재 보유 종목
      </h2>

      {!rows.length ? (
        <p className="yds-portfolio-v2__empty">보유 종목을 추가하면 비중·수익률이 계산됩니다.</p>
      ) : (
        <div className="yds-portfolio-v2__table-wrap">
          <table className="yds-portfolio-v2__table">
            <thead>
              <tr>
                <th scope="col">종목명</th>
                <th scope="col">매수일</th>
                <th scope="col">평균단가</th>
                <th scope="col">보유수량</th>
                <th scope="col">평가금액</th>
                <th scope="col">수익률</th>
                <th scope="col">비중</th>
                <th scope="col" aria-label="관리" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.name}</strong>
                    {row.ticker ? (
                      <span className="yds-portfolio-v2__ticker font-mono tabular-nums">{row.ticker}</span>
                    ) : null}
                  </td>
                  <td className="font-mono tabular-nums">{row.buyDate}</td>
                  <td className="font-mono tabular-nums">{row.avgPrice.toLocaleString("ko-KR")}</td>
                  <td className="font-mono tabular-nums">{row.quantity.toLocaleString("ko-KR")}</td>
                  <td className="font-mono tabular-nums">{row.valuation.toLocaleString("ko-KR")}</td>
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
                  <td>
                    <button
                      type="button"
                      className="yds-portfolio-v2__btn yds-portfolio-v2__btn--danger"
                      onClick={() => removePosition(row.id)}
                      aria-label={`${row.name} 삭제`}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form className="yds-portfolio-v2__form" onSubmit={handleAdd}>
        <p className="yds-portfolio-v2__form-label">종목 추가</p>
        <div className="yds-portfolio-v2__form-grid">
          <label>
            <span>종목명</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="엔비디아" required />
          </label>
          <label>
            <span>티커</span>
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="NVDA"
              className="font-mono tabular-nums"
            />
          </label>
          <label>
            <span>시장</span>
            <select value={country} onChange={(e) => setCountry(/** @type {'us'|'kr'} */ (e.target.value))}>
              <option value="us">🇺🇸 미국</option>
              <option value="kr">🇰🇷 한국</option>
            </select>
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
            />
          </label>
          <label>
            <span>현재가 (선택)</span>
            <input
              type="number"
              min={0}
              value={currentPrice}
              onChange={(e) => setCurrentPrice(e.target.value)}
              className="font-mono tabular-nums"
            />
          </label>
        </div>
        <button type="submit" className="yds-portfolio-v2__btn yds-portfolio-v2__btn--primary">
          추가
        </button>
      </form>
    </section>
  )
}
