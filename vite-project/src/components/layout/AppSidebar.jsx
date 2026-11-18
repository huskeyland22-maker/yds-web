import { useLocation } from "react-router-dom"
import { countUnreadPickAlerts } from "../../content/ydsStockPickAlertStorage.js"
import MarketShellNav from "./MarketShellNav.jsx"
import SidebarAccountPanel from "./SidebarAccountPanel.jsx"

/**
 * @param {{
 *   sidebarPulse?: object
 *   onOpenInputPanel: () => void
 *   onOpenAccountSettings: () => void
 *   user: object | null
 *   onLogin: () => void
 *   onLogout: () => void
 *   buildVersion?: string | null
 *   pwaLastSyncLabel?: string | null
 * }} props
 */
export default function AppSidebar({
  onOpenInputPanel,
  onOpenAccountSettings,
  user,
  onLogin,
  onLogout,
}) {
  const location = useLocation()
  const pickAlertUnread = countUnreadPickAlerts()
  const isMarket = location.pathname === "/market-analysis"

  return (
    <aside
      className={[
        "yds-sidebar hidden w-[15.5rem] shrink-0 flex-col border-r border-white/[0.06] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] lg:flex",
        isMarket ? "yds-sidebar--market" : "",
      ].join(" ")}
    >
      {isMarket ? (
        <div className="yds-sidebar__brand shrink-0 px-3.5 pb-3 pt-3.5">
          <span className="min-w-0">
            <p className="m-0 text-[15px] font-semibold leading-tight text-slate-50">YDS 투자 시스템</p>
            <p className="m-0 mt-1 text-[10px] font-semibold tracking-wide text-violet-300">PRO</p>
          </span>
        </div>
      ) : (
        <div className="yds-sidebar__brand shrink-0 px-3.5 pb-3 pt-3.5 lg:border-b lg:border-white/[0.06]">
          <span className="yds-sidebar__mark" aria-hidden>
            Y
          </span>
          <span className="min-w-0">
            <p className="m-0 font-display text-[17px] font-semibold leading-none tracking-[0.04em] text-slate-50">
              Y&apos;ds
            </p>
            <p className="m-0 mt-1.5 text-[10px] font-medium tracking-[0.02em] text-slate-500">
              함께하는 인생 투자
            </p>
          </span>
        </div>
      )}

      <div className="yds-sidebar__scroll">
        <MarketShellNav
          pickAlertUnread={pickAlertUnread}
          onOpenAccountSettings={onOpenAccountSettings}
          onOpenInputPanel={onOpenInputPanel}
          inputLabel="AI 리포트 입력"
        />
      </div>

      <div className="yds-sidebar__dock">
        <SidebarAccountPanel user={user} onLogin={onLogin} onLogout={onLogout} />
      </div>
    </aside>
  )
}
