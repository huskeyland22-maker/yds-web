/**
 * @param {{
 *   value: string
 *   onChange: (value: string) => void
 *   resultCount?: number
 * }} props
 */
export default function YdsStockPickSearchBar({ value, onChange, resultCount }) {
  return (
    <div className="yds-spick-search">
      <label className="yds-spick-search__label" htmlFor="spick-search-input">
        종목 검색
      </label>
      <input
        id="spick-search-input"
        type="search"
        className="yds-spick-search__input"
        placeholder="종목명 · 티커 (로컬 검색)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        enterKeyHint="search"
      />
      {value.trim() ? (
        <p className="yds-spick-search__meta font-mono tabular-nums" role="status">
          {resultCount ?? 0}건 · API 재조회 없음
        </p>
      ) : null}
    </div>
  )
}
