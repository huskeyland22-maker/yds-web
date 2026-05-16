import { useLocation, useNavigate } from "react-router-dom"
import { BarChart3, Home, Layers, Menu } from "lucide-react"

const ITEMS = [
  { id: "home", label: "홈", path: "/cycle", icon: Home },
  { id: "market", label: "시장", path: "/cycle", hash: "#desk", icon: BarChart3 },
  { id: "sector", label: "섹터", path: "/value-chain", icon: Layers },
  { id: "menu", label: "메뉴", action: "menu", icon: Menu },
]

export default function MobileBottomNav({ onMenu }) {
  const location = useLocation()
  const navigate = useNavigate()

  const activeId = (() => {
    if (location.pathname.startsWith("/value-chain")) return "sector"
    if (location.pathname.startsWith("/trading-log")) return "menu"
    return "home"
  })()

  const onTap = (item) => {
    if (item.action === "menu") {
      onMenu?.()
      return
    }
    if (item.hash && item.path === location.pathname) {
      document.querySelector(item.hash)?.scrollIntoView({ behavior: "smooth", block: "start" })
      return
    }
    navigate(item.path + (item.hash ?? ""))
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[8000] border-t border-white/[0.08] bg-[#080b12]/97 backdrop-blur-sm lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="주요 메뉴"
    >
      <ul className="m-0 flex list-none items-stretch justify-around px-0.5 pt-0.5">
        {ITEMS.map((item) => {
          const Icon = item.icon
          const active =
            item.id === activeId || (item.id === "market" && location.pathname === "/cycle")
          return (
            <li key={item.id} className="flex flex-1">
              <button
                type="button"
                onClick={() => onTap(item)}
                className={[
                  "flex min-h-[46px] w-full flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1 transition",
                  active ? "text-slate-100" : "text-slate-500 active:text-slate-300",
                ].join(" ")}
              >
                <Icon size={17} strokeWidth={active ? 2.2 : 1.75} className={active ? "text-sky-400/85" : ""} />
                <span className="text-[10px] font-medium tracking-tight">{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
