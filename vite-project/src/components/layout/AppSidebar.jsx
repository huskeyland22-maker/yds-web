import { NavLink } from "react-router-dom"
import { getPrimaryNavItems } from "../../utils/appNavItems.js"

/**
 * @param {{
 *   sidebarPulse: object
 *   deskPanicData: object | null
 *   onOpenInputPanel: () => void
 * }} props
 */
export default function AppSidebar({ sidebarPulse, deskPanicData, onOpenInputPanel }) {
  const navItems = getPrimaryNavItems()

  return (
    <aside className="hidden w-[10rem] shrink-0 flex-col overflow-y-auto border-r border-white/[0.06] bg-[#0B0E14] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] lg:flex lg:h-[100dvh]">
      <div className="shrink-0 px-2 pb-2 pt-2.5 lg:border-b lg:border-white/[0.06] lg:px-2.5 lg:pb-2.5 lg:pt-3">
        <p className="m-0 font-display text-[17px] font-bold leading-none tracking-[0.03em] text-slate-50">
          Y&apos;ds
        </p>
        <p className="m-0 mt-1.5 text-[9px] font-medium tracking-[0.16em] text-slate-300/65">Market Cycle Lab</p>
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
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto hidden lg:block lg:border-t lg:border-white/[0.06] lg:px-2 lg:pb-3 lg:pt-2.5">
        <p className="m-0 text-trading-2xs font-semibold tracking-[0.1em] text-slate-500">시장 상태</p>
        <dl className="m-0 mt-2 space-y-1.5 text-trading-xs leading-snug">
          <div className="flex justify-between gap-2 border-b border-white/[0.04] pb-2">
            <dt className="shrink-0 text-slate-500">위험 선호</dt>
            <dd
              className={
                sidebarPulse.riskAppetite === "ON"
                  ? "text-right font-medium text-emerald-300/95"
                  : sidebarPulse.riskAppetite === "OFF"
                    ? "text-right font-medium text-rose-300/90"
                    : "text-right text-amber-200/85"
              }
            >
              {sidebarPulse.riskAppetite === "ON"
                ? "선호 우위"
                : sidebarPulse.riskAppetite === "OFF"
                  ? "회피 우위"
                  : sidebarPulse.riskAppetite}
            </dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-white/[0.04] pb-2">
            <dt className="shrink-0 text-slate-500">시장 분위기</dt>
            <dd className="text-right text-slate-200">{sidebarPulse.marketMood}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-white/[0.04] pb-2">
            <dt className="shrink-0 text-slate-500">주도 섹터</dt>
            <dd className="max-w-[9rem] truncate text-right text-slate-200">{sidebarPulse.leadingSector}</dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-white/[0.04] pb-2">
            <dt className="shrink-0 text-slate-500">변동성</dt>
            <dd className="text-right text-slate-200">{sidebarPulse.volatility}</dd>
          </div>
          <div className="flex justify-between gap-2 pt-0.5">
            <dt className="shrink-0 text-slate-500">시장 사이클</dt>
            <dd className="text-right text-indigo-200/90">{sidebarPulse.cycleStage}</dd>
          </div>
        </dl>
        {sidebarPulse.updateTimestampLine ? (
          <p className="m-0 mt-2 text-[9px] leading-relaxed text-slate-500">{sidebarPulse.updateTimestampLine}</p>
        ) : null}
        {sidebarPulse.basisLine ? (
          <p className="m-0 mt-0.5 text-[9px] leading-relaxed text-slate-500">{sidebarPulse.basisLine}</p>
        ) : null}
        <p className="m-0 mt-3 font-mono text-[9px] leading-relaxed text-slate-600">
          VIX {Number.isFinite(Number(deskPanicData?.vix)) ? Number(deskPanicData.vix).toFixed(2) : "—"} · F&amp;G{" "}
          {Number.isFinite(Number(deskPanicData?.fearGreed)) ? Math.round(Number(deskPanicData.fearGreed)) : "—"}
        </p>
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
