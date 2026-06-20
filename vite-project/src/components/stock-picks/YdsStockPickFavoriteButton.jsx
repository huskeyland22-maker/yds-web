/**
 * @param {{ active: boolean; onToggle: () => void }} props
 */
export default function YdsStockPickFavoriteButton({ active, onToggle }) {
  return (
    <button
      type="button"
      className={["yds-spick-fav", active ? "yds-spick-fav--active" : ""].filter(Boolean).join(" ")}
      aria-pressed={active}
      aria-label={active ? "관심종목 해제" : "관심종목 등록"}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggle()
      }}
    >
      {active ? "⭐" : "☆"}
    </button>
  )
}
