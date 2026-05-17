/**
 * 코리아 밸류체인 Hero — Y'ds Market Cycle Lab
 */
export default function KoreaValueChainHero() {
  return (
    <section className="relative mb-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-[rgba(12,14,18,0.92)] px-4 py-3 md:px-5 md:py-3.5">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
        aria-hidden
      />
      <div className="relative z-[1] flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="m-0 font-mono text-[8px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Y&apos;ds Market Cycle Lab
          </p>
          <h1 className="m-0 mt-1 text-lg font-semibold tracking-tight text-slate-50 md:text-xl">
            코리아 밸류체인
          </h1>
          <p className="m-0 mt-0.5 text-[11px] text-slate-400 md:text-[12px]">
            AI · 산업 재편 · 순환매 추적
          </p>
        </div>
        <aside className="flex shrink-0 flex-wrap gap-1 lg:max-w-[14rem] lg:justify-end">
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
        "inline-block rounded-md border px-2 py-0.5 font-mono text-[8px] font-medium uppercase tracking-[0.12em]",
        accent
          ? "border-indigo-500/25 bg-indigo-500/10 text-indigo-200/90"
          : "border-white/[0.08] bg-white/[0.03] text-slate-500",
      ].join(" ")}
    >
      {label}
    </span>
  )
}
