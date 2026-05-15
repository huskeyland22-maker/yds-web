/** 일봉 차트 로딩 스켈레톤 */
export default function ChartSkeleton({ className = "" }) {
  return (
    <div
      className={`animate-pulse overflow-hidden rounded-xl border border-white/[0.08] bg-[#080b12] ${className}`}
      style={{ minHeight: 420 }}
      aria-hidden
    >
      <div className="border-b border-white/[0.06] px-4 py-4">
        <div className="h-4 w-24 rounded bg-white/10" />
        <div className="mt-3 h-8 w-40 rounded bg-white/10" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="h-10 rounded bg-white/[0.06]" />
          <div className="h-10 rounded bg-white/[0.06]" />
        </div>
      </div>
      <div className="flex h-[360px] items-end gap-1 px-4 pb-6 pt-4">
        {Array.from({ length: 24 }, (_, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-white/[0.07]"
            style={{ height: `${28 + (i % 5) * 12}%` }}
          />
        ))}
      </div>
    </div>
  )
}
