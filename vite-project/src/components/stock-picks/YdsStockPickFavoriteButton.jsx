/**
 * @param {{ active: boolean; onToggle: () => void }} props
 */
export default function YdsStockPickFavoriteButton({ active, onToggle }) {
  return (
    <button
      type="button"
      className={["yds-spick-fav", active ? "yds-spick-fav--active" : ""].filter(Boolean).join(" ")}
      aria-pressed={active}
      aria-label={active ? "즐겨찾기 해제" : "즐겨찾기 추가"}
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
