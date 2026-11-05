import { Menu } from "lucide-react"
import MembershipPlanBadge from "../MembershipPlanBadge.jsx"

export default function MobileAppHeader({ onMenuOpen, user, onLogin, onLogout, authPending = false }) {
  const name = user?.displayName || user?.email || "로그인 유저"

  return (
    <header
      className="yds-mobile-app-header flex min-h-[48px] shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] px-2.5 py-1.5 pt-[max(0.35rem,env(safe-area-inset-top))] lg:hidden"
      data-yds-mobile-header="mhb-20261104"
    >
      <button
        type="button"
        onClick={onMenuOpen}
        className="touch-target flex shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-slate-300"
        aria-label="메뉴"
      >
        <Menu size={18} />
      </button>
      <div className="min-w-0 flex-1 px-1 text-center">
        <p className="m-0 font-display text-[15px] font-bold leading-none tracking-[0.03em] text-slate-50">
          Y&apos;ds
        </p>
        <p className="m-0 mt-0.5 text-[9px] font-medium tracking-[0.16em] text-slate-300/65">
          Market Cycle Lab
        </p>
      </div>
      <div className="yds-mobile-app-header__account flex min-h-[2.25rem] min-w-[6.5rem] max-w-[46%] shrink-0 flex-col items-end justify-center gap-0.5 overflow-visible">
        {user ? (
          <>
            <div className="yds-mobile-app-header__identity flex max-w-full items-center justify-end gap-1 overflow-visible">
              <span className="min-w-0 truncate text-[11px] font-semibold leading-tight text-slate-100">
                {name}
              </span>
              <MembershipPlanBadge className="yds-membership-plan-badge--mobile shrink-0" />
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="text-[10px] font-medium leading-none text-slate-400"
            >
              로그아웃
            </button>
          </>
        ) : authPending ? (
          <span
            className="text-[11px] font-medium text-slate-400"
            data-yds-auth-pending="1"
            aria-live="polite"
          >
            확인 중…
          </span>
        ) : (
          <button type="button" onClick={onLogin} className="text-[11px] font-medium text-slate-300">
            로그인
          </button>
        )}
      </div>
    </header>
  )
}
