import { useEffect, useId, useMemo, useRef, useState } from "react"
import {
  PORTFOLIO_STOCK_CATALOG,
  searchPortfolioStocks,
} from "../../content/ydsPortfolioStockSearch.js"

/** @typedef {import("../../content/ydsPortfolioStockSearch.js").PortfolioStockOption} PortfolioStockOption */

const POPULAR_TICKERS = ["005380", "NVDA", "AAPL", "005930", "AVGO", "TSLA"]

/**
 * @param {string} text
 * @param {string} query
 */
function highlightParts(text, query) {
  const q = String(query ?? "").trim().toLowerCase()
  if (!q || !text) return [{ text, match: false }]
  const lower = text.toLowerCase()
  const idx = lower.indexOf(q)
  if (idx < 0) return [{ text, match: false }]
  return [
    { text: text.slice(0, idx), match: false },
    { text: text.slice(idx, idx + q.length), match: true },
    { text: text.slice(idx + q.length), match: false },
  ].filter((p) => p.text)
}

/**
 * @param {{
 *   value: PortfolioStockOption | null
 *   onChange: (stock: PortfolioStockOption | null) => void
 *   required?: boolean
 *   disabled?: boolean
 * }} props
 */
export default function YdsPortfolioStockSearchInput({ value, onChange, required, disabled }) {
  const listId = useId()
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const [query, setQuery] = useState(value?.name ?? "")
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const popularStocks = useMemo(
    () =>
      POPULAR_TICKERS.map((ticker) =>
        PORTFOLIO_STOCK_CATALOG.find((s) => s.ticker === ticker),
      ).filter(Boolean),
    [],
  )

  const results = useMemo(() => {
    const q = query.trim()
    if (!q) return popularStocks.slice(0, 6)
    return searchPortfolioStocks(q, 8)
  }, [query, popularStocks])

  const showList = open && results.length > 0
  const isBrowseMode = !query.trim()

  useEffect(() => {
    setQuery(value?.name ?? "")
  }, [value])

  useEffect(() => {
    function onDocClick(e) {
      if (!rootRef.current?.contains(/** @type {Node} */ (e.target))) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  /** @param {PortfolioStockOption} stock */
  function selectStock(stock) {
    onChange(stock)
    setQuery(stock.name)
    setOpen(false)
  }

  function clearSelection() {
    onChange(null)
    setQuery("")
    setOpen(true)
  }

  function handleInputChange(e) {
    const next = e.target.value
    setQuery(next)
    setOpen(true)
    if (value && next.trim() !== value.name) {
      onChange(null)
    }
  }

  function handleKeyDown(e) {
    if (!showList) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % results.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => (i - 1 + results.length) % results.length)
    } else if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault()
      selectStock(results[activeIndex])
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div className="yds-portfolio-v5__search yds-portfolio-v64__search" ref={rootRef}>
      <label className="yds-portfolio-v5__search-label">
        <span>종목 검색</span>
        <input
          type="search"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="현대차, 엔비디아, NVDA…"
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          required={required}
          disabled={disabled}
        />
      </label>

      {value ? (
        <div className="yds-portfolio-v64__search-chip">
          <span className="font-mono tabular-nums">
            {value.country === "kr" ? "🇰🇷" : "🇺🇸"} {value.ticker}
          </span>
          <button type="button" className="yds-portfolio-v64__search-chip-clear" onClick={clearSelection}>
            변경
          </button>
        </div>
      ) : null}

      {showList ? (
        <>
          {isBrowseMode ? (
            <p className="yds-portfolio-v64__search-hint">자주 쓰는 종목 · 이름·티커·초성 검색</p>
          ) : null}
          <ul id={listId} className="yds-portfolio-v5__search-list" role="listbox">
            {results.map((stock, index) => (
              <li key={stock.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={[
                    "yds-portfolio-v5__search-item",
                    index === activeIndex ? "yds-portfolio-v5__search-item--active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectStock(stock)}
                >
                  <span className="yds-portfolio-v5__search-name">
                    {highlightParts(stock.name, query).map((part, i) =>
                      part.match ? (
                        <mark key={i} className="yds-portfolio-v64__search-mark">
                          {part.text}
                        </mark>
                      ) : (
                        <span key={i}>{part.text}</span>
                      ),
                    )}
                  </span>
                  <span className="yds-portfolio-v5__search-meta font-mono tabular-nums">
                    {stock.country === "kr" ? "🇰🇷" : "🇺🇸"}{" "}
                    {highlightParts(stock.ticker, query).map((part, i) =>
                      part.match ? (
                        <mark key={i} className="yds-portfolio-v64__search-mark">
                          {part.text}
                        </mark>
                      ) : (
                        <span key={i}>{part.text}</span>
                      ),
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {open && query.trim() && results.length === 0 ? (
        <p className="yds-portfolio-v5__search-empty">검색 결과가 없습니다.</p>
      ) : null}
    </div>
  )
}
