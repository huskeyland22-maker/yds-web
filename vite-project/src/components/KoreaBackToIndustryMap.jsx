import { useEffect, useState } from "react"

const SCROLL_SHOW_THRESHOLD = 600

/**
 * @param {{ active?: boolean; onBackToMap: () => void }} props
 */
export default function KoreaBackToIndustryMap({ active = false, onBackToMap }) {
  const [showBackToMap, setShowBackToMap] = useState(false)

  useEffect(() => {
    if (!active || typeof window === "undefined") {
      setShowBackToMap(false)
      return
    }

    const onScroll = () => {
      setShowBackToMap(window.scrollY > SCROLL_SHOW_THRESHOLD)
    }

    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [active])

  if (!active) return null

  return (
    <button
      type="button"
      onClick={onBackToMap}
      className={["valuechain-back-to-map", showBackToMap ? "is-visible" : ""].filter(Boolean).join(" ")}
      aria-label="산업맵으로 이동"
    >
      ↑ 산업맵
    </button>
  )
}
