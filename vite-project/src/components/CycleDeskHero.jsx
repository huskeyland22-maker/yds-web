/**
 * /cycle 기관형 헤더 — 단계 · 흐름 · 오늘의 시그널.
 */

const STAGE_RING = {
  greed: "from-amber-400/25 via-rose-500/15 to-transparent",
  fear: "from-sky-400/20 via-indigo-500/20 to-transparent",
  neutral: "from-slate-400/15 via-indigo-400/12 to-transparent",
}

const STAGE_LABEL = {
  greed: "text-amber-100/95",
  fear: "text-sky-200/95",
  neutral: "text-slate-100",
}

const GRID_BG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cg fill='none' stroke='%23ffffff' stroke-opacity='0.04'%3E%3Cpath d='M0 40h80M40 0v80'/%3E%3C/g%3E%3C/svg%3E\")"

export default function CycleDeskHero({ context, asOfDateLabel, updatedLine }) {
  if (!context) return null
  const { stageLabel, stageStyle, flowBullets, keySignal, tierHints } = context
  const ring = STAGE_RING[stageStyle] ?? STAGE_RING.neutral
  const labelCls = STAGE_LABEL[stageStyle] ?? STAGE_LABEL.neutral

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/[0.09] shadow-[0_0_0_1px_rgba(99,102,241,0.06),0_28px_80px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.65]"
        style={{
          backgroundImage: GRID_BG,
          backgroundSize: "80px 80px",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-[20%] top-0 h-[min(100%,420px)] w-[min(100%,420px)] rounded-full opacity-50 blur-3xl"
        style={{
          background: `radial-gradient(circle, rgba(99,102,241,0.16), transparent 62%)`,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "linear-gradient(165deg, rgba(12,14,22,0.97) 0%, rgba(8,10,16,0.98) 40%, rgba(6,8,14,0.99) 100%)",
        }}
        aria-hidden
      />

      <div className="relative z-[1] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
          <p className="m-0 font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Macro strategy desk
          </p>
          <p className="m-0 font-mono text-[9px] text-slate-600">
            As of {asOfDateLabel} · {updatedLine}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
          {/* 좌: 시장 단계 */}
          <div className="lg:col-span-3">
            <p className="m-0 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">현재 시장 단계</p>
            <div className="relative mt-3">
              <div
                className={`absolute -inset-1 rounded-2xl bg-gradient-to-br opacity-80 blur-md ${ring}`}
                aria-hidden
              />
              <div className="relative rounded-xl border border-white/[0.08] bg-black/35 px-4 py-5">
                <p className={`m-0 text-center font-display text-[1.75rem] font-semibold leading-none tracking-tight sm:text-[2rem] ${labelCls}`}>
                  {stageLabel}
                </p>
                <div className="mt-4 space-y-2 border-t border-white/[0.06] pt-3 text-[10px] leading-snug text-slate-500">
                  <p className="m-0">
                    <span className="font-mono text-[9px] text-slate-600">T</span> {tierHints.tactical}
                  </p>
                  <p className="m-0">
                    <span className="font-mono text-[9px] text-slate-600">S</span> {tierHints.strategic}
                  </p>
                  <p className="m-0">
                    <span className="font-mono text-[9px] text-slate-600">M</span> {tierHints.macro}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 중: 핵심 흐름 */}
          <div className="lg:col-span-5">
            <p className="m-0 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">핵심 시장 흐름</p>
            <ul className="m-0 mt-3 list-none space-y-2.5 p-0">
              {flowBullets.map((line) => (
                <li
                  key={line}
                  className="relative border-l-2 border-indigo-500/35 pl-3 text-[12px] leading-[1.55] text-slate-200/95 sm:text-[13px]"
                >
                  {line}
                </li>
              ))}
            </ul>
          </div>

          {/* 우: Today's key signal */}
          <div className="lg:col-span-4">
            <p className="m-0 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-indigo-300/75">
              Today&apos;s key signal
            </p>
            <div className="mt-3 rounded-xl border border-indigo-500/25 bg-gradient-to-b from-indigo-950/40 to-black/40 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_28px_rgba(79,70,229,0.08)]">
              <dl className="m-0 space-y-2.5 font-mono text-[11px]">
                <div className="flex justify-between gap-3 border-b border-white/[0.06] pb-2">
                  <dt className="text-slate-500">Risk appetite</dt>
                  <dd
                    className={
                      keySignal.riskAppetite === "ON"
                        ? "font-semibold text-emerald-300/95"
                        : keySignal.riskAppetite === "OFF"
                          ? "font-semibold text-rose-300/90"
                          : "text-amber-200/90"
                    }
                  >
                    {keySignal.riskAppetite}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-white/[0.06] pb-2">
                  <dt className="text-slate-500">Leading sector</dt>
                  <dd className="text-right font-semibold text-slate-100">{keySignal.leadingSector}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-white/[0.06] pb-2">
                  <dt className="text-slate-500">Volatility</dt>
                  <dd className="text-slate-200">{keySignal.volatility}</dd>
                </div>
                <div className="flex justify-between gap-3 pt-0.5">
                  <dt className="text-slate-500">Foreign flow</dt>
                  <dd className="text-slate-200">{keySignal.foreignFlow}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
