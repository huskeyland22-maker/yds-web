import { STOCK_PICK_COUNTRIES } from "../../content/ydsStockPickModel.js"

/**
 * @param {{
 *   countryId: import("../../content/ydsStockPickModel.js").StockPickCountryId
 *   onCountryChange: (id: import("../../content/ydsStockPickModel.js").StockPickCountryId) => void
 *   className?: string
 * }} props
 */
export default function YdsStockPickCountryTabs({ countryId, onCountryChange, className = "" }) {
  return (
    <div
      className={["yds-spick-country-tabs", className].filter(Boolean).join(" ")}
      role="tablist"
      aria-label="국가 선택"
    >
      {STOCK_PICK_COUNTRIES.map((country) => (
        <button
          key={country.id}
          type="button"
          role="tab"
          aria-selected={countryId === country.id}
          className={[
            "yds-spick-country-tabs__btn",
            countryId === country.id ? "yds-spick-country-tabs__btn--active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onCountryChange(country.id)}
        >
          <span className="yds-spick-country-tabs__emoji" aria-hidden>
            {country.emoji}
          </span>
          {country.label}
        </button>
      ))}
    </div>
  )
}
