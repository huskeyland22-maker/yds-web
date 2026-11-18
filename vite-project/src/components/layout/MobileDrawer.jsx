import { Link, useLocation } from "react-router-dom"
import { isDevMode } from "../../utils/devMode.js"
import PanicHistoryVerifyPanel from "../settings/PanicHistoryVerifyPanel.jsx"
import PwaDeveloperPanel from "../settings/PwaDeveloperPanel.jsx"
import { countUnreadPickAlerts } from "../../content/ydsStockPickAlertStorage.js"
import MarketShellNav from "./MarketShellNav.jsx"
import SidebarAccountPanel from "./SidebarAccountPanel.jsx"

/**
 * @param {{
 *   open: boolean
 *   onClose: () => void
 *   onOpenInput: () => void
 *   onOpenAccountSettings: () => void
 *   buildVersion?: string | null
 *   pwaLastSyncLabel?: string | null
 *   user: object | null
 *   onLogin: () => void
 *   onLogout: () => void
 * }} props
 */
export default function MobileDrawer({
  open,
  onClose,
  onOpenInput,
  onOpenAccountSettings,
  user,
  onLogin,
  onLogout,
}) {
  const location = useLocation()
  const pickAlertUnread = countUnreadPickAlerts()
  const isMarket = location.pathname === "/market-analysis"

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
        className="yds-mobile-drawer fixed top-0 left-0 z-[8600] flex h-[100dvh] w-[min(18.5rem,90vw)] flex-col border-r border-white/[0.08] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] lg:hidden"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-3 py-3">
          <div>
            <p className="m-0 text-sm font-semibold text-slate-100">
              {isMarket ? "YDS 투자 시스템" : "Y'ds"}
            </p>
            <p className="m-0 mt-0.5 text-[10px] text-sky-300/85">
              {isMarket ? "PRO" : "함께하는 인생 투자"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="touch-target text-slate-500">
            ✕
          </button>
        </div>
        <div className="yds-mobile-drawer__scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5">
          <MarketShellNav
            onNavigate={onClose}
            pickAlertUnread={pickAlertUnread}
            onOpenAccountSettings={onOpenAccountSettings}
            onOpenInputPanel={onOpenInput}
            inputLabel="AI 지표 입력"
          />

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
        </div>
        <div className="yds-mobile-drawer__dock shrink-0 border-t border-white/[0.06] px-2.5 py-2">
          <SidebarAccountPanel
            user={user}
            onLogin={onLogin}
            onLogout={onLogout}
            onNavigate={onClose}
          />
        </div>
      </aside>
    </>
  )
}
