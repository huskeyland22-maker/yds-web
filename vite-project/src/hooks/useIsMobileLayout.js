import { useEffect, useState } from "react"

/** Tailwind `lg` (1024px) 미만 = 모바일 셸 */
const QUERY = "(max-width: 1023px)"

export function useIsMobileLayout() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(QUERY).matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const fn = () => setMobile(mq.matches)
    mq.addEventListener("change", fn)
    return () => mq.removeEventListener("change", fn)
  }, [])
  return mobile
}
