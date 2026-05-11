export default function StrategySummaryCard({ shortStrategy, midStrategy }) {
  return (
    <section className="grid gap-3 rounded-2xl border border-slate-700/70 bg-[#0f172a]/85 p-4 sm:grid-cols-2 sm:p-5">
      <article className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
        <p className="m-0 text-xs font-semibold tracking-wide text-emerald-300">단기 전략</p>
        <p className="m-0 mt-2 text-sm font-semibold text-gray-100">{shortStrategy}</p>
      </article>
      <article className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-3">
        <p className="m-0 text-xs font-semibold tracking-wide text-sky-300">중기 전략</p>
        <p className="m-0 mt-2 text-sm font-semibold text-gray-100">{midStrategy}</p>
      </article>
    </section>
  )
}
