import { STOCK_PICK_SECTORS } from "../../content/ydsStockPickModel.js"
import { RECOMMEND_STATUS_THEME } from "../../content/ydsStockPickRecommendColors.js"
import { DEFAULT_STOCK_PICK_FILTERS } from "../../content/ydsStockPickFilterEngine.js"

/**
 * @param {{
 *   filters: import("../../content/ydsStockPickFilterEngine.js").StockPickFilterState
 *   onChange: (next: import("../../content/ydsStockPickFilterEngine.js").StockPickFilterState) => void
 *   resultCount: number
 *   className?: string
 * }} props
 */
export default function YdsStockPickFilterBar({
  filters,
  onChange,
  resultCount,
  className = "",
}) {
  const set = (patch) => onChange({ ...filters, ...patch })

  const reset = () => onChange({ ...DEFAULT_STOCK_PICK_FILTERS })

  return (
    <div className={["yds-spick-filter-bar", className].filter(Boolean).join(" ")}>
      <div className="yds-spick-filter-bar__row">
        <label className="yds-spick-filter-bar__field">
          <span className="yds-spick-filter-bar__label">국가</span>
          <select
            className="yds-spick-filter-bar__select"
            value={filters.country ?? "all"}
            onChange={(e) => set({ country: e.target.value })}
          >
            <option value="all">전체</option>
            <option value="US">US</option>
            <option value="KR">KR</option>
          </select>
        </label>

        <label className="yds-spick-filter-bar__field">
          <span className="yds-spick-filter-bar__label">섹터</span>
          <select
            className="yds-spick-filter-bar__select"
            value={filters.sector ?? "all"}
            onChange={(e) => set({ sector: e.target.value })}
          >
            {STOCK_PICK_SECTORS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="yds-spick-filter-bar__field">
          <span className="yds-spick-filter-bar__label">추천상태</span>
          <select
            className="yds-spick-filter-bar__select"
            value={filters.recommendStatus ?? "all"}
            onChange={(e) => set({ recommendStatus: e.target.value })}
          >
            <option value="all">전체</option>
            {Object.entries(RECOMMEND_STATUS_THEME).map(([id, t]) => (
              <option key={id} value={id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="yds-spick-filter-bar__field">
          <span className="yds-spick-filter-bar__label">AI점수</span>
          <select
            className="yds-spick-filter-bar__select"
            value={filters.aiScoreMin ?? ""}
            onChange={(e) =>
              set({
                aiScoreMin: e.target.value ? Number(e.target.value) : null,
              })
            }
          >
            <option value="">전체</option>
            <option value="90">90+</option>
            <option value="80">80+</option>
            <option value="70">70+</option>
            <option value="60">60+</option>
          </select>
        </label>

        <label className="yds-spick-filter-bar__field">
          <span className="yds-spick-filter-bar__label">등급</span>
          <select
            className="yds-spick-filter-bar__select"
            value={filters.grade ?? "all"}
            onChange={(e) => set({ grade: e.target.value })}
          >
            <option value="all">전체</option>
            {["A+", "A", "B", "C", "D", "F"].map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>

        <label className="yds-spick-filter-bar__field">
          <span className="yds-spick-filter-bar__label">신뢰도</span>
          <select
            className="yds-spick-filter-bar__select"
            value={filters.confidenceMin ?? ""}
            onChange={(e) =>
              set({
                confidenceMin: e.target.value ? Number(e.target.value) : null,
              })
            }
          >
            <option value="">전체</option>
            <option value="90">90+</option>
            <option value="80">80+</option>
            <option value="70">70+</option>
            <option value="60">60+</option>
          </select>
        </label>
      </div>

      <div className="yds-spick-filter-bar__toggles">
        <label className="yds-spick-filter-bar__check">
          <input
            type="checkbox"
            checked={Boolean(filters.favoritesOnly)}
            onChange={(e) => set({ favoritesOnly: e.target.checked })}
          />
          관심종목만
        </label>
        <label className="yds-spick-filter-bar__check">
          <input
            type="checkbox"
            checked={Boolean(filters.buyPossibleOnly)}
            onChange={(e) =>
              set({
                buyPossibleOnly: e.target.checked,
                noChaseOnly: e.target.checked ? false : filters.noChaseOnly,
              })
            }
          />
          매수가능만
        </label>
        <label className="yds-spick-filter-bar__check">
          <input
            type="checkbox"
            checked={Boolean(filters.noChaseOnly)}
            onChange={(e) =>
              set({
                noChaseOnly: e.target.checked,
                buyPossibleOnly: e.target.checked ? false : filters.buyPossibleOnly,
              })
            }
          />
          추천금지만
        </label>
        <button type="button" className="yds-spick-filter-bar__reset" onClick={reset}>
          초기화
        </button>
        <span className="yds-spick-filter-bar__count font-mono tabular-nums">
          {resultCount}종목
        </span>
      </div>
    </div>
  )
}
