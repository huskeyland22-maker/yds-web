import { Activity, ArrowDownCircle } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"
import { NAV_MOBILE_SHORT } from "../../utils/ydsUiLabels.js"

/** 모바일 하단 네비 — 최종 2탭 */
const BOTTOM_ITEMS = [
  {
    id: "daily_bottom",
    path: "/daily-bottom-buy",
    label: NAV_MOBILE_SHORT["/daily-bottom-buy"] ?? "일상 저점매수",
    icon: ArrowDownCircle,
  },
  {
    id: "market_panic",
    path: "/market-analysis",
    label: NAV_MOBILE_SHORT["/market-analysis"] ?? "패닉",
    icon: Activity,
  },
]

/**
 * @param {{ onAi?: () => void; onSettings?: () => void }} props
 */
export default function MobileBottomNav({ onAi: _onAi, onSettings: _onSettings }) {
  const location = useLocation()
  const navigate = useNavigate()

  const activeId = (() => {
    const p = location.pathname
    if (p.startsWith("/daily-bottom-buy")) return "daily_bottom"
    if (
      p.startsWith("/market-analysis") ||
      p.startsWith("/market-dashboard") ||
      p.startsWith("/cycle")
    )
      return "market_panic"
    return null
  })()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[8000] border-t border-white/[0.08] bg-[#080b12]/96 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="모바일 주요 화면"
    >
      <ul className="m-0 flex list-none items-stretch justify-around px-0.5 pt-0.5">
        {BOTTOM_ITEMS.map((item) => {
          const Icon = item.icon
          const active = item.id === activeId
          return (
            <li key={item.id} className="flex min-w-0 flex-1">
              <button
                type="button"
                onClick={() => navigate(item.path)}
                className={[
                  "flex min-h-[48px] w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-md px-0.5 py-1 transition",
                  active ? "text-slate-100" : "text-slate-500 active:text-slate-300",
                ].join(" ")}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  size={18}
                  strokeWidth={active ? 2.25 : 1.75}
                  className={active ? "text-sky-400/90" : ""}
                />
                <span className="max-w-full truncate text-[9px] font-medium tracking-tight sm:text-[10px]">
                  {item.label}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
