import { Activity, Home, Menu, Sparkles } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"
import { getCoreNavItems, NAV_MOBILE_SHORT } from "../../utils/ydsUiLabels.js"

const ICON_BY_PATH = {
  "/": Home,
  "/market-analysis": Activity,
  "/stock-picks": Sparkles,
}

/**
 * @param {{ onAi?: () => void; onSettings?: () => void }} props
 */
export default function MobileBottomNav({ onAi: _onAi, onSettings }) {
  const location = useLocation()
  const navigate = useNavigate()
  const core = getCoreNavItems()

  const items = [
    ...core.map((item) => ({
      id: item.path === "/" ? "life_strategy" : "market_panic",
      path: item.path,
      label: NAV_MOBILE_SHORT[item.path] ?? item.shortLabel,
      icon: ICON_BY_PATH[item.path] ?? Activity,
      end: item.path === "/",
    })),
    {
      id: "stock_picks",
      path: "/stock-picks",
      label: NAV_MOBILE_SHORT["/stock-picks"] ?? "종목",
      icon: Sparkles,
      end: false,
    },
    {
      id: "more",
      path: null,
      label: "메뉴",
      icon: Menu,
      end: false,
    },
  ]

  const activeId = (() => {
    const p = location.pathname
    if (p === "/" || p === "") return "life_strategy"
    if (
      p.startsWith("/market-analysis") ||
      p.startsWith("/market-dashboard") ||
      p.startsWith("/cycle")
    )
      return "market_panic"
    if (p.startsWith("/stock-picks")) return "stock_picks"
    return "more"
  })()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[8000] border-t border-white/[0.08] bg-[#080b12]/96 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="핵심 메뉴"
    >
      <ul className="m-0 flex list-none items-stretch justify-around px-0.5 pt-0.5">
        {items.map((item) => {
          const Icon = item.icon
          const active = item.id === activeId
          return (
            <li key={item.id} className="flex min-w-0 flex-1">
              <button
                type="button"
                onClick={() => {
                  if (item.id === "more") {
                    onSettings?.()
                    return
                  }
                  navigate(item.path)
                }}
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
