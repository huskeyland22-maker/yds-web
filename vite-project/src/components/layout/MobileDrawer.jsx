import { useState } from "react"
import { NavLink, Link } from "react-router-dom"
import { isDevMode } from "../../utils/devMode.js"
import {
  getCoreNavItems,
  getOtherNavItems,
  getSidebarFooterLinks,
} from "../../utils/appNavItems.js"
import PanicHistoryVerifyPanel from "../settings/PanicHistoryVerifyPanel.jsx"
import PwaDeveloperPanel from "../settings/PwaDeveloperPanel.jsx"
import { countUnreadPickAlerts } from "../../content/ydsStockPickAlertStorage.js"

export default function MobileDrawer({ open, onClose, onOpenInput, onOpenAccountSettings, buildVersion }) {
  const [otherOpen, setOtherOpen] = useState(false)
  const coreItems = getCoreNavItems()
  const otherItems = getOtherNavItems()
  const footerLinks = getSidebarFooterLinks()
  const pickAlertUnread = countUnreadPickAlerts()

  if (!open) return null

  return (
    <>
      <button
        type="button"
        aria-label="메뉴 닫기"
        className="fixed inset-0 z-[8500] bg-black/55 lg:hidden"
        onClick={onClose}
      />
      <aside
        className="fixed top-0 left-0 z-[8600] flex h-[100dvh] w-[min(18.5rem,90vw)] flex-col border-r border-white/[0.08] bg-[#0a0d14] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] lg:hidden"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-3">
          <div>
            <p className="m-0 text-sm font-semibold text-slate-100">Y&apos;ds</p>
            <p className="m-0 mt-0.5 text-[10px] text-sky-300/85">함께하는 인생 투자</p>
          </div>
          <button type="button" onClick={onClose} className="touch-target text-slate-500">
            ✕
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-2 overflow-y-auto p-2.5" aria-label="핵심 메뉴">
          {coreItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              onClick={onClose}
              className={({ isActive }) =>
                [
                  "block rounded-2xl border px-3 py-2.5 transition",
                  item.tone === "brand"
                    ? isActive
                      ? "border-sky-400/45 bg-sky-500/[0.16]"
                      : "border-sky-500/20 bg-sky-500/[0.07]"
                    : isActive
                      ? "border-rose-400/40 bg-rose-500/[0.14]"
                      : "border-rose-500/18 bg-rose-500/[0.06]",
                ].join(" ")
              }
            >
              <span className="block text-[13px] font-semibold text-slate-50">{item.label}</span>
              <span className="mt-0.5 block text-[11px] text-slate-400">{item.subtitle}</span>
            </NavLink>
          ))}

          <div className="mt-1 border-t border-white/[0.06] pt-2">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-[12px] font-semibold text-slate-500"
              aria-expanded={otherOpen}
              onClick={() => setOtherOpen((v) => !v)}
            >
              <span>기타 기능</span>
              <span className="font-mono text-[11px]">{otherOpen ? "⌃" : "⌄"}</span>
            </button>
            {otherOpen ? (
              <div className="flex flex-col gap-0.5" aria-label="기타 기능">
                {otherItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={({ isActive }) =>
                      [
                        "flex items-center rounded-md px-3 py-2 text-[12px] font-medium transition",
                        isActive
                          ? "bg-white/[0.08] text-slate-50"
                          : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200",
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
              </div>
            ) : null}
          </div>

          <div className="mt-1 border-t border-white/[0.06] pt-2">
            {footerLinks.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  [
                    "block rounded-md px-3 py-2 text-[12px] font-medium transition",
                    isActive
                      ? "bg-white/[0.06] text-slate-200"
                      : "text-slate-500 hover:text-slate-300",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenAccountSettings?.()
              }}
              className="mt-0.5 flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[12px] font-medium text-slate-500"
            >
              <span>계정 설정</span>
              <span aria-hidden>›</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenInput?.()
              }}
              className="mt-2 rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2.5 text-left text-[13px] font-medium text-sky-100"
            >
              AI 지표 입력
            </button>
          </div>

          {isDevMode() ? (
            <>
              <Link
                to="/admin"
                onClick={onClose}
                className="rounded-md px-3 py-2 text-[11px] text-cyan-400/90"
              >
                운영자 대시보드
              </Link>
              <Link
                to="/debug-data"
                onClick={onClose}
                className="rounded-md px-3 py-2 text-[11px] text-amber-400/90"
              >
                Supabase 디버그
              </Link>
              <PwaDeveloperPanel />
              <PanicHistoryVerifyPanel />
            </>
          ) : null}
        </nav>
        {buildVersion ? (
          <p className="m-0 border-t border-white/[0.06] px-3 py-2 font-mono text-[9px] text-slate-600">
            {buildVersion}
          </p>
        ) : null}
      </aside>
    </>
  )
}
