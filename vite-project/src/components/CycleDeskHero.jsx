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
    <section className="relative overflow-hidden rounded-card-lg border border-white/[0.08] shadow-trading-card">
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

      <div className="relative z-[1] px-3 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5">
          <p className="m-0 text-trading-2xs font-semibold tracking-[0.12em] text-slate-500">매크로 전략 데스크</p>
          <p className="m-0 font-mono text-trading-2xs text-slate-600">
            기준일 {asOfDateLabel} · {updatedLine}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
          {/* 좌: 시장 단계 */}
          <div className="lg:col-span-3">
            <p className="m-0 text-trading-2xs font-medium uppercase tracking-[0.14em] text-slate-500">현재 시장 단계</p>
            <div className="relative mt-2">
              <div
                className={`absolute -inset-0.5 rounded-card-lg bg-gradient-to-br opacity-70 blur-md ${ring}`}
                aria-hidden
              />
              <div className="relative rounded-card border border-white/[0.08] bg-black/40 px-3 py-3.5 sm:px-4 sm:py-4">
                <p className={`m-0 text-center font-display text-trading-xl font-semibold leading-none tracking-tight sm:text-trading-2xl ${labelCls}`}>
                  {stageLabel}
                </p>
                <div className="mt-3 space-y-1 border-t border-white/[0.06] pt-2.5 text-trading-xs leading-snug text-slate-500">
                  <p className="m-0">
                    <span className="text-trading-2xs font-semibold text-slate-600">단기</span> {tierHints.tactical}
                  </p>
                  <p className="m-0">
                    <span className="text-trading-2xs font-semibold text-slate-600">중기</span> {tierHints.strategic}
                  </p>
                  <p className="m-0">
                    <span className="text-trading-2xs font-semibold text-slate-600">장기</span> {tierHints.macro}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 중: 핵심 흐름 */}
          <div className="lg:col-span-5">
            <p className="m-0 text-trading-2xs font-medium uppercase tracking-[0.14em] text-slate-500">핵심 시장 흐름</p>
            <ul className="m-0 mt-2 list-none space-y-1.5 p-0">
              {flowBullets.map((line) => (
                <li
                  key={line}
                  className="relative border-l-2 border-indigo-500/35 pl-2.5 text-trading-sm leading-snug text-slate-200/95 sm:text-trading-base"
                >
                  {line}
                </li>
              ))}
            </ul>
          </div>

          {/* 우: Today's key signal */}
          <div className="lg:col-span-4">
            <p className="m-0 text-trading-2xs font-semibold tracking-[0.1em] text-indigo-300/85">오늘의 핵심 시그널</p>
            <div className="mt-2 rounded-card border border-indigo-500/20 bg-gradient-to-b from-indigo-950/35 to-black/45 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <dl className="m-0 space-y-2 text-trading-xs leading-snug sm:text-trading-sm">
                <div className="flex justify-between gap-3 border-b border-white/[0.06] pb-2">
                  <dt className="shrink-0 text-slate-500">위험 선호</dt>
                  <dd
                    className={
                      keySignal.riskAppetiteTone === "on"
                        ? "text-right font-semibold text-emerald-300/95"
                        : keySignal.riskAppetiteTone === "off"
                          ? "text-right font-semibold text-rose-300/90"
                          : "text-right text-amber-200/90"
                    }
                  >
                    {keySignal.riskAppetite}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-white/[0.06] pb-2">
                  <dt className="shrink-0 text-slate-500">주도 섹터</dt>
                  <dd className="max-w-[11rem] text-right font-semibold text-slate-100">{keySignal.leadingSector}</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-white/[0.06] pb-2">
                  <dt className="shrink-0 text-slate-500">변동성</dt>
                  <dd className="text-right text-slate-200">{keySignal.volatility}</dd>
                </div>
                <div className="flex justify-between gap-3 pt-0.5">
                  <dt className="shrink-0 text-slate-500">수급·흐름</dt>
                  <dd className="max-w-[11rem] text-right text-slate-200">{keySignal.foreignFlow}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
