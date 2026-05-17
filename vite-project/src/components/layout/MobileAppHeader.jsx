import { Menu } from "lucide-react"

export default function MobileAppHeader({ onMenuOpen, user, onLogin, onLogout }) {
  return (
    <header className="flex min-h-[44px] shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] bg-[#0B0E14]/98 px-2.5 py-1.5 pt-[max(0.35rem,env(safe-area-inset-top))] backdrop-blur-sm lg:hidden">
      <button
        type="button"
        onClick={onMenuOpen}
        className="touch-target flex items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-slate-300"
        aria-label="메뉴"
      >
        <Menu size={18} />
      </button>
      <div className="min-w-0 flex-1 text-center">
        <p className="m-0 font-display text-[15px] font-bold leading-none tracking-[0.03em] text-slate-50">
          Y&apos;ds
        </p>
        <p className="m-0 mt-0.5 text-[9px] font-medium tracking-[0.16em] text-slate-300/65">
          Market Cycle Lab
        </p>
      </div>
      <div className="flex w-9 justify-end">
        {user ? (
          <button
            type="button"
            onClick={onLogout}
            className="max-w-[4.5rem] truncate text-[10px] font-medium text-slate-400"
          >
            로그아웃
          </button>
        ) : (
          <button type="button" onClick={onLogin} className="text-[10px] font-medium text-slate-400">
            로그인
          </button>
        )}
      </div>
    </header>
  )
}
