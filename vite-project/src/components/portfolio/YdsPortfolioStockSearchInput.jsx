import { useEffect, useId, useRef, useState } from "react"
import { searchPortfolioStocks } from "../../content/ydsPortfolioStockSearch.js"

/** @typedef {import("../../content/ydsPortfolioStockSearch.js").PortfolioStockOption} PortfolioStockOption */

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

  const results = searchPortfolioStocks(query)

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

  function selectStock(stock) {
    onChange(stock)
    setQuery(stock.name)
    setOpen(false)
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
    if (!open || !results.length) return

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
    <div className="yds-portfolio-v5__search" ref={rootRef}>
      <label className="yds-portfolio-v5__search-label">
        <span>종목 검색</span>
        <input
          type="search"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="현, 엔비디아, NVDA…"
          autoComplete="off"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          required={required}
          disabled={disabled}
        />
      </label>

      {open && query.trim() && results.length > 0 ? (
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
                <span className="yds-portfolio-v5__search-name">{stock.name}</span>
                <span className="yds-portfolio-v5__search-meta font-mono tabular-nums">
                  {stock.country === "kr" ? "🇰🇷" : "🇺🇸"} {stock.ticker}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {open && query.trim() && results.length === 0 ? (
        <p className="yds-portfolio-v5__search-empty">검색 결과가 없습니다.</p>
      ) : null}
    </div>
  )
}
