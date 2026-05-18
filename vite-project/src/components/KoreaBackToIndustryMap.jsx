import { useEffect, useState } from "react"

const SCROLL_SHOW_THRESHOLD = 600

/**
 * 상세 탐색 중 산업맵 복귀 — hash 앵커만 사용 (scrollTo 금지)
 * @param {{ active?: boolean }} props
 */
export default function KoreaBackToIndustryMap({ active = false }) {
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
    <a
      href="#industry-map"
      className={["valuechain-back-to-map", showBackToMap ? "is-visible" : ""].filter(Boolean).join(" ")}
      aria-label="산업맵으로 이동"
    >
      ↑ 산업맵
    </a>
  )
}
