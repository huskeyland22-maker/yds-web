import { Sparkles } from "lucide-react"

/** 보조 기능 — 시장 데이터 위에 떠 있는 최소 pill FAB */
export default function MobileAiFab({ onOpen, hidden }) {
  if (hidden) return null

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="지표 붙여넣기"
      className="fixed z-[8100] flex touch-target-comfort items-center gap-1.5 rounded-full border border-white/[0.1] bg-[#0c1018]/90 px-3 py-2 text-[11px] font-medium text-slate-300 shadow-[0_4px_16px_rgba(0,0,0,0.35)] backdrop-blur-sm transition active:scale-[0.98] lg:hidden"
      style={{
        bottom: "calc(3.25rem + env(safe-area-inset-bottom))",
        right: "max(0.65rem, env(safe-area-inset-right))",
      }}
    >
      <Sparkles size={14} className="text-slate-400" strokeWidth={2} />
      <span>지표 입력</span>
    </button>
  )
}
