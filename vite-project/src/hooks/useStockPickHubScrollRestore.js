import { useEffect } from "react"

const SCROLL_KEY = "yds-spick-hub-scroll-y"

/** 상세 분석 진입 전 스크롤 저장 · 뒤로 복귀 시 복원 */
export function useStockPickHubScrollRestore() {
  useEffect(() => {
    const raw = sessionStorage.getItem(SCROLL_KEY)
    if (raw) {
      const y = Number(raw)
      if (Number.isFinite(y) && y > 0) {
        requestAnimationFrame(() => {
          window.scrollTo({ top: y, behavior: "instant" })
        })
      }
      sessionStorage.removeItem(SCROLL_KEY)
    }

    return () => {
      sessionStorage.setItem(SCROLL_KEY, String(window.scrollY))
    }
  }, [])
}
