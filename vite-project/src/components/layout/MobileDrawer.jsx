import { NavLink } from "react-router-dom"
import { Link } from "react-router-dom"
import { isDevMode } from "../../utils/devMode.js"
import { getPrimaryNavItems } from "../../utils/appNavItems.js"
import { LAUNCH_FOOTER_LINKS } from "../../content/ydsLaunchContent.js"
import PanicHistoryVerifyPanel from "../settings/PanicHistoryVerifyPanel.jsx"
import PwaDeveloperPanel from "../settings/PwaDeveloperPanel.jsx"

export default function MobileDrawer({ open, onClose, onOpenInput, buildVersion }) {
  if (!open) return null

  const links = getPrimaryNavItems()

  return (
    <>
      <button
        type="button"
        aria-label="메뉴 닫기"
        className="fixed inset-0 z-[8500] bg-black/55 lg:hidden"
        onClick={onClose}
      />
      <aside
        className="fixed top-0 left-0 z-[8600] flex h-[100dvh] w-[min(18rem,88vw)] flex-col border-r border-white/[0.08] bg-[#0a0d14] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] lg:hidden"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-3">
          <p className="m-0 text-sm font-semibold text-slate-100">메뉴</p>
          <button type="button" onClick={onClose} className="touch-target text-slate-500">
            ✕
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2" aria-label="주요 메뉴">
          {links.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                [
                  "rounded-md px-3 py-2.5 text-[13px] font-medium transition",
                  isActive
                    ? "bg-white/[0.08] text-slate-50"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
          <p className="mt-3 mb-1 px-3 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            출시 안내
          </p>
          {LAUNCH_FOOTER_LINKS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                [
                  "rounded-md px-3 py-2 text-[12px] font-medium transition",
                  isActive
                    ? "bg-white/[0.06] text-slate-200"
                    : "text-slate-500 hover:bg-white/[0.03] hover:text-slate-300",
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
              onOpenInput?.()
            }}
            className="mt-2 rounded-md border border-violet-500/30 bg-violet-500/10 px-3 py-2.5 text-left text-[13px] font-medium text-violet-200"
          >
            AI 지표 입력
          </button>
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
