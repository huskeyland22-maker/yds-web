import { NavLink } from "react-router-dom"
import { Link } from "react-router-dom"
import { isDevMode } from "../../utils/devMode.js"

const LINKS = [
  { to: "/cycle", label: "시장 사이클" },
  { to: "/value-chain", label: "코리아 밸류체인" },
  { to: "/trading-log", label: "트레이딩 로그" },
]

export default function MobileDrawer({ open, onClose, onOpenInput, buildVersion }) {
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
      className="fixed top-0 left-0 z-[8600] flex h-[100dvh] w-[min(18rem,88vw)] flex-col border-r border-white/[0.08] bg-[#0a0d14] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] lg:hidden"
    >
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-3">
        <p className="m-0 text-sm font-semibold text-slate-100">메뉴</p>
        <button type="button" onClick={onClose} className="touch-target text-slate-500">
          ✕
        </button>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {LINKS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) =>
              [
                "rounded-md px-3 py-2.5 text-[13px] font-medium transition",
                isActive ? "bg-white/[0.08] text-slate-50" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200",
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
          className="mt-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-3 py-2.5 text-left text-[13px] font-medium text-violet-200"
        >
          AI 지표 입력
        </button>
        {isDevMode() ? (
          <Link
            to="/debug-data"
            onClick={onClose}
            className="rounded-md px-3 py-2 text-[11px] text-amber-400/90"
          >
            Supabase 디버그
          </Link>
        ) : null}
      </nav>
      {buildVersion ? (
        <p className="m-0 border-t border-white/[0.06] px-3 py-2 font-mono text-[9px] text-slate-600">{buildVersion}</p>
      ) : null}
    </aside>
  </>
  )
}
