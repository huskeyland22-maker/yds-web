import { NavLink } from "react-router-dom"
import { countUnreadPickAlerts } from "../../content/ydsStockPickAlertStorage.js"
import AiReportMarketStatusBlock from "../AiReportMarketStatusBlock.jsx"
import YdsV1ReleaseBadge from "../trust/YdsV1ReleaseBadge.jsx"
import { getPrimaryNavItems, getSecondaryNavItems } from "../../utils/appNavItems.js"
import { LAUNCH_FOOTER_LINKS } from "../../content/ydsLaunchContent.js"

/**
 * @param {{
 *   sidebarPulse: object
 *   onOpenInputPanel: () => void
 * }} props
 */
export default function AppSidebar({ sidebarPulse, onOpenInputPanel }) {
  const navItems = getPrimaryNavItems()
  const secondaryNavItems = getSecondaryNavItems()
  const aiStatus = sidebarPulse?.aiReportStatus ?? null
  const pickAlertUnread = countUnreadPickAlerts()

  return (
    <aside className="hidden w-[10rem] shrink-0 flex-col overflow-y-auto border-r border-white/[0.06] bg-[#0B0E14] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] lg:flex lg:h-[100dvh]">
      <div className="shrink-0 px-2 pb-2 pt-2.5 lg:border-b lg:border-white/[0.06] lg:px-2.5 lg:pb-2.5 lg:pt-3">
        <p className="m-0 font-display text-[17px] font-bold leading-none tracking-[0.03em] text-slate-50">
          Y&apos;ds
        </p>
        <div className="mt-1.5">
          <YdsV1ReleaseBadge compact />
        </div>
      </div>
      <nav className="flex flex-col gap-0.5 px-2 py-2" aria-label="주요 메뉴">
        {navItems.map((item, i) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              [
                "flex w-full items-center gap-1.5 rounded-card border px-2 py-1.5 text-[11px] transition",
                isActive
                  ? "border-indigo-500/30 bg-indigo-500/[0.14] text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                  : "border-transparent text-slate-400 hover:border-white/[0.06] hover:bg-white/[0.03] hover:text-slate-200",
              ].join(" ")
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`font-mono text-trading-2xs tabular-nums ${isActive ? "text-indigo-300/95" : "text-slate-600"}`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 truncate font-medium leading-tight tracking-tight">{item.label}</span>
                {item.path === "/stock-picks" && pickAlertUnread > 0 ? (
                  <span className="ml-auto rounded-full bg-rose-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {pickAlertUnread}
                  </span>
                ) : null}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <nav className="flex flex-col gap-0.5 px-2 pb-2" aria-label="보조 메뉴">
        {secondaryNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              [
                "flex w-full items-center rounded-card border px-2 py-1.5 text-[11px] transition",
                isActive
                  ? "border-indigo-500/30 bg-indigo-500/[0.14] text-slate-50"
                  : "border-transparent text-slate-500 hover:border-white/[0.06] hover:bg-white/[0.03] hover:text-slate-300",
              ].join(" ")
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <nav
        className="mt-2 hidden flex-col gap-0.5 border-t border-white/[0.06] px-2 pt-2 lg:flex"
        aria-label="출시 안내"
      >
        <p className="m-0 px-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600">
          출시 안내
        </p>
        {LAUNCH_FOOTER_LINKS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              [
                "rounded-md px-2 py-1 text-[10px] font-medium transition",
                isActive
                  ? "bg-white/[0.06] text-slate-200"
                  : "text-slate-500 hover:text-slate-300",
              ].join(" ")
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto hidden lg:block lg:border-t lg:border-white/[0.06] lg:px-2 lg:pb-3 lg:pt-2.5">
        {aiStatus ? <AiReportMarketStatusBlock status={aiStatus} compact /> : null}
        <button
          type="button"
          onClick={onOpenInputPanel}
          className="mt-3 w-full rounded-lg border border-violet-500/25 bg-violet-500/[0.08] px-2 py-2 text-[11px] font-medium text-violet-200/95 transition hover:border-violet-400/35 hover:bg-violet-500/[0.14]"
        >
          AI 리포트 입력
        </button>
      </div>
    </aside>
  )
}
