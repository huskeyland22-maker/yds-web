/**
 * 코리아 밸류체인 Hero — Y'ds Market Cycle Lab
 */
export default function KoreaValueChainHero() {
  return (
    <section className="relative mb-6 overflow-hidden rounded-2xl border border-white/[0.07] bg-[rgba(12,14,18,0.92)] px-4 py-5 md:px-6 md:py-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
        aria-hidden
      />
      <div className="relative z-[1] flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="m-0 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Y&apos;ds Market Cycle Lab
          </p>
          <h1 className="m-0 mt-2 text-xl font-semibold tracking-tight text-slate-50 md:text-2xl">
            코리아 밸류체인
          </h1>
          <p className="m-0 mt-1.5 text-[12px] text-slate-400 md:text-[13px]">
            AI · 산업 재편 · 순환매 추적
          </p>
          <p className="m-0 mt-3 max-w-lg text-[11px] leading-relaxed text-slate-500">
            국내 산업 재편·순환매·메가트렌드 수혜 축을 압축 맵으로 먼저 보고, 상세 밸류체인은 필요할 때
            펼쳐 탐색합니다.
          </p>
        </div>
        <aside className="flex shrink-0 flex-col gap-1.5 lg:items-end">
          <StatusBadge label="KOREA VALUE MAP" />
          <StatusBadge label="Macro Rotation Monitor" />
          <StatusBadge label="Y'ds Market Cycle Lab" accent />
        </aside>
      </div>
    </section>
  )
}

/** @param {{ label: string; accent?: boolean }} props */
function StatusBadge({ label, accent = false }) {
  return (
    <span
      className={[
        "inline-block rounded-md border px-2.5 py-1 font-mono text-[9px] font-medium uppercase tracking-[0.14em]",
        accent
          ? "border-indigo-500/25 bg-indigo-500/10 text-indigo-200/90"
          : "border-white/[0.08] bg-white/[0.03] text-slate-500",
      ].join(" ")}
    >
      {label}
    </span>
  )
}
