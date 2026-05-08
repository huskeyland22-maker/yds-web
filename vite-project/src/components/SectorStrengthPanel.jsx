function SectorRow({ item, positive }) {
  return (
    <div className="rounded-xl border border-gray-700/70 bg-[#111827]/80 p-3">
      <div className="flex items-center justify-between">
        <p className="m-0 text-sm font-semibold text-gray-100">{item.name}</p>
        <p className={`m-0 text-sm font-bold ${positive ? "text-emerald-300" : "text-rose-300"}`}>{item.score}</p>
      </div>
      <p className="m-0 mt-1 text-xs text-gray-400">{item.trend}</p>
      <p className="m-0 mt-1 text-xs text-gray-300">{item.comment}</p>
    </div>
  )
}

export default function SectorStrengthPanel({ sectors }) {
  return (
    <section className="grid gap-4 rounded-2xl border border-slate-700/70 bg-[#0b1220]/80 p-4 sm:grid-cols-2 sm:p-5">
      <div>
        <p className="m-0 text-xs font-semibold tracking-wide text-emerald-300">강세 섹터</p>
        <div className="mt-3 grid gap-2">
          {sectors.strong.map((item) => (
            <SectorRow key={item.name} item={item} positive />
          ))}
        </div>
      </div>
      <div>
        <p className="m-0 text-xs font-semibold tracking-wide text-rose-300">약세 섹터</p>
        <div className="mt-3 grid gap-2">
          {sectors.weak.map((item) => (
            <SectorRow key={item.name} item={item} positive={false} />
          ))}
        </div>
      </div>
    </section>
  )
}
