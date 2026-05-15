import { useCallback, useMemo, useState } from "react"
import {
  addBuy,
  addSell,
  computeTradingStats,
  deleteBuy,
  deleteSell,
  formatKrw,
  formatPct,
  loadTradingLog,
  POSITION_STATUS_TAGS,
  removePosition,
  saveTradingLog,
  TRADE_TAGS,
  upsertPosition,
} from "../utils/tradingLogStore.js"

function TagPicker({ selected, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TRADE_TAGS.map((tag) => {
        const on = selected.includes(tag)
        return (
          <button
            key={tag}
            type="button"
            onClick={() => onChange(on ? selected.filter((t) => t !== tag) : [...selected, tag])}
            className={[
              "rounded-full border px-2.5 py-1 text-[10px] font-medium transition",
              on
                ? "border-cyan-400/50 bg-cyan-500/20 text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.15)]"
                : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200",
            ].join(" ")}
          >
            {tag}
          </button>
        )
      })}
    </div>
  )
}

function PnlText({ value, className = "" }) {
  if (value == null || !Number.isFinite(value)) {
    return <span className={`text-slate-500 ${className}`}>—</span>
  }
  const up = value > 0
  const down = value < 0
  return (
    <span
      className={[
        "font-mono tabular-nums font-semibold",
        up ? "text-rose-400" : down ? "text-sky-400" : "text-slate-300",
        className,
      ].join(" ")}
    >
      {typeof value === "number" && Math.abs(value) > 1000 ? formatKrw(value) : formatPct(value)}
    </span>
  )
}

function SectionCard({ label, title, children, accent = "indigo" }) {
  const border =
    accent === "cyan"
      ? "border-cyan-500/25"
      : accent === "emerald"
        ? "border-emerald-500/25"
        : accent === "amber"
          ? "border-amber-500/25"
          : "border-indigo-500/25"
  const glow =
    accent === "cyan"
      ? "shadow-[0_0_24px_rgba(34,211,238,0.06)]"
      : accent === "emerald"
        ? "shadow-[0_0_24px_rgba(52,211,153,0.06)]"
        : accent === "amber"
          ? "shadow-[0_0_24px_rgba(251,191,36,0.06)]"
          : "shadow-[0_0_24px_rgba(99,102,241,0.08)]"

  return (
    <section
      className={`rounded-2xl border bg-[#0b1220]/90 px-4 py-4 sm:px-5 sm:py-5 ${border} ${glow}`}
    >
      <p className="m-0 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      {title ? <h2 className="m-0 mt-1 text-base font-semibold text-slate-50 sm:text-lg">{title}</h2> : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function StatTile({ label, value, sub, tone = "neutral" }) {
  const toneClass =
    tone === "up"
      ? "text-rose-400"
      : tone === "down"
        ? "text-sky-400"
        : tone === "accent"
          ? "text-cyan-300"
          : "text-slate-50"
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-3">
      <p className="m-0 text-[9px] font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`m-0 mt-1 font-mono text-lg font-semibold tabular-nums ${toneClass}`}>{value}</p>
      {sub ? <p className="m-0 mt-1 text-[10px] text-slate-500">{sub}</p> : null}
    </div>
  )
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"

export default function TradingLogPage() {
  const [log, setLog] = useState(() => loadTradingLog())
  const [tab, setTab] = useState("overview")

  const persist = useCallback((next) => {
    setLog(next)
    saveTradingLog(next)
  }, [])

  const stats = useMemo(() => computeTradingStats(log), [log])

  const [buyForm, setBuyForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    symbol: "",
    name: "",
    price: "",
    weightPct: "",
    memo: "",
    tags: [],
  })
  const [sellForm, setSellForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    symbol: "",
    name: "",
    buyPrice: "",
    sellPrice: "",
    returnPct: "",
    weightPct: "",
    reason: "",
    reviewMemo: "",
    tags: [],
  })
  const [posForm, setPosForm] = useState({
    symbol: "",
    name: "",
    avgPrice: "",
    currentPrice: "",
    quantity: "",
    weightPct: "",
    reason: "",
    statusTags: ["보유중"],
  })

  const submitBuy = (e) => {
    e.preventDefault()
    persist(
      addBuy(log, {
        ...buyForm,
        price: Number(buyForm.price),
        weightPct: Number(buyForm.weightPct),
      }),
    )
    setBuyForm((f) => ({ ...f, symbol: "", name: "", price: "", weightPct: "", memo: "", tags: [] }))
  }

  const submitSell = (e) => {
    e.preventDefault()
    persist(
      addSell(log, {
        ...sellForm,
        buyPrice: sellForm.buyPrice ? Number(sellForm.buyPrice) : null,
        sellPrice: sellForm.sellPrice ? Number(sellForm.sellPrice) : null,
        returnPct: sellForm.returnPct ? Number(sellForm.returnPct) : null,
        weightPct: sellForm.weightPct ? Number(sellForm.weightPct) : null,
      }),
    )
    setSellForm((f) => ({
      ...f,
      symbol: "",
      name: "",
      buyPrice: "",
      sellPrice: "",
      returnPct: "",
      weightPct: "",
      reason: "",
      reviewMemo: "",
      tags: [],
    }))
  }

  const submitPosition = (e) => {
    e.preventDefault()
    persist(
      upsertPosition(log, {
        ...posForm,
        avgPrice: Number(posForm.avgPrice),
        currentPrice: posForm.currentPrice ? Number(posForm.currentPrice) : null,
        quantity: Number(posForm.quantity),
        weightPct: Number(posForm.weightPct),
      }),
    )
    setPosForm({
      symbol: "",
      name: "",
      avgPrice: "",
      currentPrice: "",
      quantity: "",
      weightPct: "",
      reason: "",
      statusTags: ["보유중"],
    })
  }

  const tabs = [
    { id: "overview", label: "데스크" },
    { id: "positions", label: "포지션" },
    { id: "buys", label: "매수" },
    { id: "sells", label: "매도" },
    { id: "stats", label: "통계" },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-[#0c1222] via-[#0b0f18] to-[#12102a] px-4 py-5 sm:px-6">
        <p className="m-0 font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-violet-300/80">
          Trading desk · log
        </p>
        <h1 className="m-0 mt-2 font-display text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">
          트레이딩 로그
        </h1>
        <p className="m-0 mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          실전 매매 기록 · 복기 · 성과 분석. 로컬 저장(브라우저)되며 기기 간 동기화는 되지 않습니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={[
                "min-h-[40px] rounded-lg border px-3 py-2 text-xs font-medium transition",
                tab === t.id
                  ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                  : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="총 평가금액" value={formatKrw(stats.totalEquity)} tone="accent" />
        <StatTile
          label="실현 손익"
          value={formatKrw(stats.realizedPnl)}
          tone={stats.realizedPnl > 0 ? "up" : stats.realizedPnl < 0 ? "down" : "neutral"}
        />
        <StatTile
          label="평가 손익"
          value={formatKrw(stats.unrealizedPnl)}
          tone={stats.unrealizedPnl > 0 ? "up" : stats.unrealizedPnl < 0 ? "down" : "neutral"}
        />
        <StatTile
          label="승률"
          value={stats.winRate != null ? formatPct(stats.winRate, 1) : "—"}
          sub={stats.closedCount ? `${stats.closedCount}건 청산` : "청산 기록 없음"}
        />
        <StatTile
          label="월간 수익률"
          value={stats.monthReturnPct != null ? formatPct(stats.monthReturnPct) : "—"}
          sub="당월 매도 가중"
          tone={stats.monthReturnPct > 0 ? "up" : stats.monthReturnPct < 0 ? "down" : "neutral"}
        />
      </section>

      {(tab === "overview" || tab === "positions") && (
        <SectionCard label="02 · positions" title="현재 포지션" accent="cyan">
          {stats.positions.length === 0 ? (
            <p className="m-0 text-sm text-slate-500">등록된 포지션이 없습니다. 아래에서 추가하세요.</p>
          ) : (
            <div className="space-y-3">
              {stats.positions.map((p) => (
                <article
                  key={p.id}
                  className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-3 sm:px-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="m-0 text-sm font-semibold text-slate-100">
                        {p.name}{" "}
                        <span className="font-mono text-[11px] font-normal text-slate-500">{p.symbol}</span>
                      </p>
                      <p className="m-0 mt-1 text-[11px] text-slate-500">{p.reason || "—"}</p>
                    </div>
                    <PnlText value={p.pnlPct} />
                  </div>
                  <dl className="m-0 mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                    <div>
                      <dt className="text-slate-500">평균단가</dt>
                      <dd className="m-0 font-mono text-slate-200">{p.avgPrice?.toLocaleString() ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">현재가</dt>
                      <dd className="m-0 font-mono text-slate-200">{p.currentPrice?.toLocaleString() ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">비중</dt>
                      <dd className="m-0 font-mono text-slate-200">{p.weightPct != null ? `${p.weightPct}%` : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">평가</dt>
                      <dd className="m-0 font-mono text-slate-200">{formatKrw(p.marketValue)}</dd>
                    </div>
                  </dl>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {(p.statusTags || []).map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] text-indigo-200"
                      >
                        {t}
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={() => persist(removePosition(log, p.id))}
                      className="ml-auto text-[10px] text-slate-600 underline-offset-2 hover:text-rose-400 hover:underline"
                    >
                      삭제
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {tab === "positions" || tab === "overview" ? (
            <form onSubmit={submitPosition} className="mt-5 space-y-3 border-t border-white/[0.06] pt-5">
              <p className="m-0 text-xs font-semibold text-cyan-200/90">포지션 추가</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className={inputClass}
                  placeholder="종목코드 005930"
                  value={posForm.symbol}
                  onChange={(e) => setPosForm((f) => ({ ...f, symbol: e.target.value }))}
                  required
                />
                <input
                  className={inputClass}
                  placeholder="종목명"
                  value={posForm.name}
                  onChange={(e) => setPosForm((f) => ({ ...f, name: e.target.value }))}
                />
                <input
                  className={inputClass}
                  placeholder="평균단가"
                  type="number"
                  value={posForm.avgPrice}
                  onChange={(e) => setPosForm((f) => ({ ...f, avgPrice: e.target.value }))}
                  required
                />
                <input
                  className={inputClass}
                  placeholder="현재가"
                  type="number"
                  value={posForm.currentPrice}
                  onChange={(e) => setPosForm((f) => ({ ...f, currentPrice: e.target.value }))}
                />
                <input
                  className={inputClass}
                  placeholder="수량"
                  type="number"
                  value={posForm.quantity}
                  onChange={(e) => setPosForm((f) => ({ ...f, quantity: e.target.value }))}
                />
                <input
                  className={inputClass}
                  placeholder="비중 %"
                  type="number"
                  value={posForm.weightPct}
                  onChange={(e) => setPosForm((f) => ({ ...f, weightPct: e.target.value }))}
                />
              </div>
              <textarea
                className={`${inputClass} min-h-[72px] resize-y`}
                placeholder="보유 이유"
                value={posForm.reason}
                onChange={(e) => setPosForm((f) => ({ ...f, reason: e.target.value }))}
              />
              <div className="flex flex-wrap gap-1.5">
                {POSITION_STATUS_TAGS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      setPosForm((f) => ({
                        ...f,
                        statusTags: f.statusTags.includes(t)
                          ? f.statusTags.filter((x) => x !== t)
                          : [...f.statusTags, t],
                      }))
                    }
                    className={[
                      "rounded-full border px-2 py-0.5 text-[10px]",
                      posForm.statusTags.includes(t)
                        ? "border-violet-400/40 bg-violet-500/15 text-violet-100"
                        : "border-white/10 text-slate-500",
                    ].join(" ")}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                className="rounded-lg border border-cyan-500/30 bg-cyan-500/15 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/25"
              >
                포지션 저장
              </button>
            </form>
          ) : null}
        </SectionCard>
      )}

      {(tab === "overview" || tab === "buys") && (
        <SectionCard label="03 · buy log" title="매수 로그" accent="emerald">
          {log.buys.length === 0 ? (
            <p className="m-0 text-sm text-slate-500">매수 기록이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left text-[11px]">
                <thead>
                  <tr className="border-b border-white/10 text-slate-500">
                    <th className="py-2 pr-3 font-medium">날짜</th>
                    <th className="py-2 pr-3 font-medium">종목</th>
                    <th className="py-2 pr-3 font-medium">매수가</th>
                    <th className="py-2 pr-3 font-medium">비중</th>
                    <th className="py-2 pr-3 font-medium">태그</th>
                    <th className="py-2 font-medium">근거</th>
                    <th className="py-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {log.buys.map((b) => (
                    <tr key={b.id} className="border-b border-white/[0.04] text-slate-200">
                      <td className="py-2.5 pr-3 font-mono tabular-nums">{b.date}</td>
                      <td className="py-2.5 pr-3">
                        <span className="font-medium">{b.name}</span>
                        <span className="ml-1 text-slate-500">{b.symbol}</span>
                      </td>
                      <td className="py-2.5 pr-3 font-mono">{b.price?.toLocaleString() ?? "—"}</td>
                      <td className="py-2.5 pr-3 font-mono">{b.weightPct != null ? `${b.weightPct}%` : "—"}</td>
                      <td className="py-2.5 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {(b.tags || []).map((t) => (
                            <span key={t} className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-200">
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 max-w-[200px] truncate text-slate-400" title={b.memo}>
                        {b.memo || "—"}
                      </td>
                      <td className="py-2.5">
                        <button
                          type="button"
                          className="text-slate-600 hover:text-rose-400"
                          onClick={() => persist(deleteBuy(log, b.id))}
                          aria-label="삭제"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <form onSubmit={submitBuy} className="mt-5 space-y-3 border-t border-white/[0.06] pt-5">
            <p className="m-0 text-xs font-semibold text-emerald-200/90">매수 기록 추가</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="date"
                className={inputClass}
                value={buyForm.date}
                onChange={(e) => setBuyForm((f) => ({ ...f, date: e.target.value }))}
              />
              <input
                className={inputClass}
                placeholder="종목코드"
                value={buyForm.symbol}
                onChange={(e) => setBuyForm((f) => ({ ...f, symbol: e.target.value }))}
                required
              />
              <input
                className={inputClass}
                placeholder="종목명"
                value={buyForm.name}
                onChange={(e) => setBuyForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                className={inputClass}
                placeholder="매수가"
                type="number"
                value={buyForm.price}
                onChange={(e) => setBuyForm((f) => ({ ...f, price: e.target.value }))}
                required
              />
              <input
                className={inputClass}
                placeholder="비중 %"
                type="number"
                value={buyForm.weightPct}
                onChange={(e) => setBuyForm((f) => ({ ...f, weightPct: e.target.value }))}
              />
            </div>
            <TagPicker
              selected={buyForm.tags}
              onChange={(tags) => setBuyForm((f) => ({ ...f, tags }))}
            />
            <textarea
              className={`${inputClass} min-h-[72px]`}
              placeholder="근거 메모"
              value={buyForm.memo}
              onChange={(e) => setBuyForm((f) => ({ ...f, memo: e.target.value }))}
            />
            <button
              type="submit"
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-100"
            >
              매수 로그 저장
            </button>
          </form>
        </SectionCard>
      )}

      {(tab === "overview" || tab === "sells") && (
        <SectionCard label="04 · sell log" title="매도 로그" accent="amber">
          {log.sells.length === 0 ? (
            <p className="m-0 text-sm text-slate-500">매도 기록이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {log.sells.map((s) => (
                <article key={s.id} className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="m-0 text-sm font-semibold text-slate-100">
                      {s.name}{" "}
                      <span className="font-mono text-[11px] text-slate-500">{s.symbol}</span>
                      <span className="ml-2 font-mono text-[10px] text-slate-600">{s.date}</span>
                    </p>
                    <PnlText value={s.returnPct} />
                  </div>
                  <p className="m-0 mt-1 text-[11px] text-amber-200/80">매도 이유: {s.reason || "—"}</p>
                  <p className="m-0 mt-1 text-[11px] text-slate-500">복기: {s.reviewMemo || "—"}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(s.tags || []).map((t) => (
                      <span key={t} className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-200">
                        {t}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="mt-2 text-[10px] text-slate-600 hover:text-rose-400"
                    onClick={() => persist(deleteSell(log, s.id))}
                  >
                    삭제
                  </button>
                </article>
              ))}
            </div>
          )}

          <form onSubmit={submitSell} className="mt-5 space-y-3 border-t border-white/[0.06] pt-5">
            <p className="m-0 text-xs font-semibold text-amber-200/90">매도 기록 추가</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="date"
                className={inputClass}
                value={sellForm.date}
                onChange={(e) => setSellForm((f) => ({ ...f, date: e.target.value }))}
              />
              <input
                className={inputClass}
                placeholder="종목코드"
                value={sellForm.symbol}
                onChange={(e) => setSellForm((f) => ({ ...f, symbol: e.target.value }))}
                required
              />
              <input
                className={inputClass}
                placeholder="종목명"
                value={sellForm.name}
                onChange={(e) => setSellForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                className={inputClass}
                placeholder="매수가 (선택)"
                type="number"
                value={sellForm.buyPrice}
                onChange={(e) => setSellForm((f) => ({ ...f, buyPrice: e.target.value }))}
              />
              <input
                className={inputClass}
                placeholder="매도가"
                type="number"
                value={sellForm.sellPrice}
                onChange={(e) => setSellForm((f) => ({ ...f, sellPrice: e.target.value }))}
              />
              <input
                className={inputClass}
                placeholder="수익률 % (자동계산 가능)"
                type="number"
                step="0.01"
                value={sellForm.returnPct}
                onChange={(e) => setSellForm((f) => ({ ...f, returnPct: e.target.value }))}
              />
              <input
                className={inputClass}
                placeholder="비중 %"
                type="number"
                value={sellForm.weightPct}
                onChange={(e) => setSellForm((f) => ({ ...f, weightPct: e.target.value }))}
              />
            </div>
            <TagPicker selected={sellForm.tags} onChange={(tags) => setSellForm((f) => ({ ...f, tags }))} />
            <input
              className={inputClass}
              placeholder="매도 이유"
              value={sellForm.reason}
              onChange={(e) => setSellForm((f) => ({ ...f, reason: e.target.value }))}
            />
            <textarea
              className={`${inputClass} min-h-[72px]`}
              placeholder="복기 메모"
              value={sellForm.reviewMemo}
              onChange={(e) => setSellForm((f) => ({ ...f, reviewMemo: e.target.value }))}
            />
            <button
              type="submit"
              className="rounded-lg border border-amber-500/30 bg-amber-500/15 px-4 py-2 text-sm font-medium text-amber-100"
            >
              매도 로그 저장
            </button>
          </form>
        </SectionCard>
      )}

      {(tab === "overview" || tab === "stats") && (
        <SectionCard label="05 · analytics" title="통계 · 태그 분석" accent="indigo">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats.tagStats.map((row) => (
              <div key={row.tag} className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-3">
                <p className="m-0 text-xs font-semibold text-indigo-200">{row.tag}</p>
                <p className="m-0 mt-2 text-[10px] text-slate-500">
                  거래 {row.count}건 · 승률 {row.winRate != null ? formatPct(row.winRate, 1) : "—"}
                </p>
                <p className="m-0 mt-1 font-mono text-sm text-slate-200">
                  평균 {row.avgReturnPct != null ? formatPct(row.avgReturnPct) : "—"}
                </p>
              </div>
            ))}
          </div>

          {stats.bestSell ? (
            <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-3">
              <p className="m-0 text-[10px] uppercase tracking-wider text-rose-300/80">최고 수익 종목</p>
              <p className="m-0 mt-1 text-sm font-semibold text-slate-100">
                {stats.bestSell.name}{" "}
                <PnlText value={stats.bestSell.returnPct} className="ml-2 inline text-sm" />
              </p>
            </div>
          ) : null}

          <div className="mt-4 rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-3">
            <p className="m-0 text-[10px] uppercase tracking-wider text-sky-300/80">실수 패턴 분석</p>
            <ul className="m-0 mt-2 list-inside list-disc space-y-1 text-sm text-slate-300">
              {stats.mistakePatterns.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </SectionCard>
      )}
    </div>
  )
}
