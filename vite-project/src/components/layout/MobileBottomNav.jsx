import { Activity, BarChart3, Bell, FileText, FlaskConical, ListChecks } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"
import { getPrimaryNavItems, NAV_MOBILE_SHORT } from "../../utils/ydsUiLabels.js"

const ICON_BY_PATH = {
  "/market-analysis": Activity,
  "/watchlist": ListChecks,
  "/alert-center": Bell,
  "/ai-daily-report": FileText,
  "/performance-center": BarChart3,
  "/performance-dashboard": BarChart3,
  "/lab": FlaskConical,
}

const SHORT_LABEL = NAV_MOBILE_SHORT

function buildNavItems() {
  return getPrimaryNavItems().map((item) => ({
    id: item.path.slice(1).replace(/-/g, "_") || "market_analysis",
    path: item.path,
    label: SHORT_LABEL[item.path] ?? item.label,
    icon: ICON_BY_PATH[item.path] ?? Activity,
  }))
}

/**
 * @param {{ onAi?: () => void; onSettings?: () => void }} props
 */
export default function MobileBottomNav({ onAi: _onAi, onSettings: _onSettings }) {
  const location = useLocation()
  const navigate = useNavigate()
  const items = buildNavItems()

  const activeId = (() => {
    const p = location.pathname
    if (
      p.startsWith("/market-analysis") ||
      p.startsWith("/market-dashboard") ||
      p.startsWith("/cycle") ||
      p === "/"
    )
      return "market_analysis"
    if (p.startsWith("/watchlist")) return "watchlist"
    if (p.startsWith("/alert-center")) return "alert_center"
    if (p.startsWith("/ai-daily-report")) return "ai_daily_report"
    if (p.startsWith("/performance-center") || p.startsWith("/performance-dashboard"))
      return "performance_center"
    if (p.startsWith("/lab") || p.startsWith("/panic-validation")) return "lab"
    return null
  })()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[8000] border-t border-white/[0.08] bg-[#080b12]/96 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="주요 메뉴"
    >
      <ul className="m-0 flex list-none items-stretch justify-around px-0.5 pt-0.5">
        {items.map((item) => {
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
                <Icon size={18} strokeWidth={active ? 2.25 : 1.75} className={active ? "text-sky-400/90" : ""} />
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
