import { Menu } from "lucide-react"
import MembershipPlanBadge from "../MembershipPlanBadge.jsx"

export default function MobileAppHeader({ onMenuOpen, user, onLogin, onLogout, authPending = false }) {
  const name = user?.displayName || user?.email || "로그인 유저"

  return (
    <header
      className="yds-mobile-app-header flex shrink-0 flex-col border-b border-slate-200 bg-white lg:hidden"
      data-yds-mobile-header="pwa-safe-20261105"
    >
      {/* Opaque safe-area band — keeps notch/status region white in iOS PWA */}
      <div className="yds-mobile-app-header__safe" aria-hidden="true" />
      <div className="yds-mobile-app-header__bar flex min-h-[48px] items-center justify-between gap-2 px-2.5 py-1.5">
        <button
          type="button"
          onClick={onMenuOpen}
          className="touch-target flex shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-800"
          aria-label="메뉴"
        >
          <Menu size={18} strokeWidth={2.25} />
        </button>
        <div className="min-w-0 flex-1 px-1 text-center">
          <p className="m-0 font-display text-[15px] font-bold leading-none tracking-[0.03em] text-slate-900">
            Y&apos;ds
          </p>
          <p className="m-0 mt-0.5 text-[9px] font-medium tracking-[0.16em] text-slate-500">
            Market Cycle Lab
          </p>
        </div>
        <div className="yds-mobile-app-header__account flex min-h-[2.25rem] min-w-[6.5rem] max-w-[46%] shrink-0 flex-col items-end justify-center gap-0.5 overflow-visible">
          {user ? (
            <>
              <div className="yds-mobile-app-header__identity flex max-w-full items-center justify-end gap-1 overflow-visible">
                <span className="min-w-0 truncate text-[11px] font-semibold leading-tight text-slate-900">
                  {name}
                </span>
                <MembershipPlanBadge className="yds-membership-plan-badge--mobile shrink-0" />
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="text-[10px] font-semibold leading-none text-slate-700"
              >
                로그아웃
              </button>
            </>
          ) : authPending ? (
            <span
              className="text-[11px] font-medium text-slate-600"
              data-yds-auth-pending="1"
              aria-live="polite"
            >
              확인 중…
            </span>
          ) : (
            <button type="button" onClick={onLogin} className="text-[11px] font-semibold text-slate-800">
              로그인
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
