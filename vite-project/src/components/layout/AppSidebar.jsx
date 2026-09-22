import { useState } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { countUnreadPickAlerts } from "../../content/ydsStockPickAlertStorage.js"
import AiReportMarketStatusBlock from "../AiReportMarketStatusBlock.jsx"
import YdsV1ReleaseBadge from "../trust/YdsV1ReleaseBadge.jsx"
import {
  getCoreNavItems,
  getOtherNavItems,
  getSidebarFooterLinks,
} from "../../utils/appNavItems.js"

/**
 * @param {{
 *   sidebarPulse: object
 *   onOpenInputPanel: () => void
 *   onOpenAccountSettings: () => void
 * }} props
 */
export default function AppSidebar({ sidebarPulse, onOpenInputPanel, onOpenAccountSettings }) {
  const location = useLocation()
  const coreItems = getCoreNavItems()
  const otherItems = getOtherNavItems()
  const footerLinks = getSidebarFooterLinks()
  const aiStatus = sidebarPulse?.aiReportStatus ?? null
  const pickAlertUnread = countUnreadPickAlerts()
  const [otherOpen, setOtherOpen] = useState(false)
  // Daily Bottom Buy는 신호·단계만으로 충분 — 패닉 기반「오늘의 해석」비표시
  const hideTodayInterpretation =
    location.pathname === "/daily-bottom-buy" || location.pathname === "/"

  return (
    <aside className="yds-sidebar hidden w-[15.5rem] shrink-0 flex-col overflow-y-auto border-r border-white/[0.06] bg-[#0B0E14] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] lg:flex lg:h-[100dvh]">
      <div className="shrink-0 px-3.5 pb-3 pt-3.5 lg:border-b lg:border-white/[0.06]">
        <p className="m-0 font-display text-[17px] font-semibold leading-none tracking-[0.04em] text-slate-50">
          Y&apos;ds
        </p>
        <p className="m-0 mt-1.5 text-[10px] font-medium tracking-[0.02em] text-slate-500">
          함께하는 인생 투자
        </p>
        <div className="mt-2.5">
          <YdsV1ReleaseBadge compact />
        </div>
      </div>

      <nav className="flex flex-col gap-1 px-2.5 py-3" aria-label="핵심 메뉴">
        {coreItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/" || item.path === "/daily-bottom-buy"}
            className={({ isActive }) =>
              [
                "yds-sidebar-core group block rounded-md border-l-2 px-3 py-2.5 transition",
                item.tone === "brand"
                  ? isActive
                    ? "border-l-sky-400/70 bg-sky-500/[0.1]"
                    : "border-l-transparent hover:border-l-sky-500/35 hover:bg-white/[0.03]"
                  : isActive
                    ? "border-l-rose-400/65 bg-rose-500/[0.08]"
                    : "border-l-transparent hover:border-l-rose-500/30 hover:bg-white/[0.03]",
              ].join(" ")
            }
          >
            {({ isActive }) => (
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span
                    className={[
                      "block text-[12.5px] font-semibold leading-snug tracking-tight",
                      isActive ? "text-slate-50" : "text-slate-300",
                    ].join(" ")}
                  >
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">
                    {item.subtitle}
                  </span>
                </span>
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mx-2.5 border-t border-white/[0.06]" />

      <div className="px-2.5 py-2">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold tracking-tight text-slate-500 transition hover:bg-white/[0.03] hover:text-slate-300"
          aria-expanded={otherOpen}
          onClick={() => setOtherOpen((v) => !v)}
        >
          <span>기타 기능</span>
          <span className="font-mono text-[10px] text-slate-600">{otherOpen ? "⌃" : "⌄"}</span>
        </button>
        {otherOpen ? (
          <nav className="mt-0.5 flex flex-col gap-0.5" aria-label="기타 기능">
            {otherItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  [
                    "flex items-center rounded-md px-2 py-1.5 text-[11px] font-medium transition",
                    isActive
                      ? "bg-white/[0.07] text-slate-100"
                      : "text-slate-500 hover:bg-white/[0.03] hover:text-slate-300",
                  ].join(" ")
                }
              >
                <span className="min-w-0 truncate">{item.label}</span>
                {item.path === "/stock-picks" && pickAlertUnread > 0 ? (
                  <span className="ml-auto rounded-full bg-rose-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {pickAlertUnread}
                  </span>
                ) : null}
              </NavLink>
            ))}
          </nav>
        ) : null}
      </div>

      <div className="mx-2.5 border-t border-white/[0.06]" />

      <nav className="flex flex-col gap-0.5 px-2.5 py-2" aria-label="안내">
        {footerLinks.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              [
                "rounded-md px-2 py-1.5 text-[11px] font-medium transition",
                isActive ? "bg-white/[0.06] text-slate-200" : "text-slate-500 hover:text-slate-300",
              ].join(" ")
            }
          >
            {item.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={onOpenAccountSettings}
          className="mt-0.5 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[11px] font-medium text-slate-500 transition hover:bg-white/[0.03] hover:text-slate-300"
        >
          <span>계정 설정</span>
          <span className="text-slate-600" aria-hidden>
            ›
          </span>
        </button>
      </nav>

      <div className="mt-auto hidden border-t border-white/[0.06] px-2.5 pb-3 pt-2 lg:block">
        {!hideTodayInterpretation && aiStatus ? (
          <AiReportMarketStatusBlock status={aiStatus} compact />
        ) : null}
        <button
          type="button"
          onClick={onOpenInputPanel}
          className="mt-2 w-full rounded-lg border border-sky-500/25 bg-sky-500/[0.08] px-2 py-2 text-[11px] font-medium text-sky-100/95 transition hover:border-sky-400/35 hover:bg-sky-500/[0.14]"
        >
          AI 리포트 입력
        </button>
      </div>
    </aside>
  )
}
