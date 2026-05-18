import { useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { getKoreaSectorById } from "../../data/koreaGrowthSectorMap.js"
import {
  buildAllSectorSignalCounts,
  buildSectorSignalRows,
  SIGNAL_STATUS_META,
} from "../../utils/koreaIndustrySignal.js"

const LIST_FADE = { duration: 0.28, ease: [0.22, 1, 0.36, 1] }

const COUNT_KEYS = [
  { key: "overheat", label: "과열" },
  { key: "pullback", label: "누림" },
  { key: "trend", label: "추세" },
  { key: "watch", label: "관망" },
]

const EMPTY_COUNTS = { overheat: 0, pullback: 0, trend: 0, watch: 0 }

export default function KoreaIndustrySignalBoard({ selectedId, heatById = {}, onStockSelect }) {
  const sector = useMemo(() => getKoreaSectorById(selectedId), [selectedId])
  const sectorHeat = heatById[selectedId] || sector?.heat
  const rows = useMemo(() => {
    try {
      const built = buildSectorSignalRows(sector, sectorHeat)
      return Array.isArray(built) ? built : []
    } catch {
      return []
    }
  }, [sector, sectorHeat])
  const sectorCounts = useMemo(() => {
    try {
      const built = buildAllSectorSignalCounts(heatById ?? {})
      return Array.isArray(built) ? built : []
    } catch {
      return []
    }
  }, [heatById])
  const activeCounts = useMemo(() => {
    const found = sectorCounts.find((c) => c.sectorId === selectedId)
    return found?.counts ?? { overheat: 0, pullback: 0, trend: 0, watch: 0 }
  }, [sectorCounts, selectedId])

  return (
    <section id="industry-signal-board" className="korea-signal-board scroll-mt-24" aria-label="산업 시그널 보드">
      <header className="korea-signal-board__head">
        <p className="korea-signal-board__eyebrow">Industry signal desk</p>
        <h2 className="korea-signal-board__title">산업 시그널 보드</h2>
        <p className="korea-signal-board__sub">산업 흐름 기반 종목 탐색</p>
      </header>
      <div className="korea-signal-flow">
        <span className="korea-signal-flow__label">선택 산업</span>
        <span className="korea-signal-flow__arrow" aria-hidden>↓</span>
        <span className="korea-signal-flow__pill">{sector?.name ?? "—"}</span>
        <span className="korea-signal-flow__arrow" aria-hidden>↓</span>
        <span className="korea-signal-flow__label korea-signal-flow__label--muted">자동 필터 · 종목 {rows.length}개</span>
      </div>
      <div className="korea-signal-active-counts">
        {COUNT_KEYS.map(({ key, label }) =>
          activeCounts[key] > 0 ? (
            <span key={key} className={`korea-signal-count-chip korea-signal-count-chip--${key}`}>
              {label} {activeCounts[key]}
            </span>
          ) : null,
        )}
      </div>
      <div className="korea-signal-sector-summary">
        <p className="korea-signal-sector-summary__title">산업별 시그널 요약</p>
        <ul className="korea-signal-sector-summary__list m-0 list-none p-0">
          {(sectorCounts ?? []).map((item) => {
            const active = item.sectorId === selectedId
            const parts = COUNT_KEYS.filter(({ key }) => Number((item.counts ?? EMPTY_COUNTS)[key]) > 0).map(
              ({ key, label }) => `${label} ${(item.counts ?? EMPTY_COUNTS)[key]}`,
            )
            return (
              <li
                key={item.sectorId}
                className={["korea-signal-sector-summary__item", active ? "is-active" : ""]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="korea-signal-sector-summary__name">{item.fullLabel}</span>
                <span className="korea-signal-sector-summary__counts">
                  {parts.length ? parts.join(" · ") : "—"}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedId}
          className="korea-signal-card-grid"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={LIST_FADE}
        >
          {rows.length === 0 ? (
            <p className="m-0 text-sm text-slate-500">선택한 산업의 종목 데이터가 없습니다.</p>
          ) : (
            rows.map((row, i) => (
              <motion.article
                key={`${row.code}-${i}`}
                className="korea-signal-card"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: i * 0.03 }}
              >
                <button
                  type="button"
                  className="korea-signal-card__hit"
                  onClick={() =>
                    onStockSelect({
                      stock: { name: row.name, code: row.code, tip: row.tip },
                      sectorName: row.sectorName,
                    })
                  }
                >
                  <div className="korea-signal-card__body">
                    <div className="korea-signal-card__main">
                      <p className="korea-signal-card__name">{row.name}</p>
                      <p className="korea-signal-card__code">{row.code}</p>
                      {row.tip ? <p className="korea-signal-card__role">{row.tip}</p> : null}
                      <div className="korea-signal-card__meta">
                        <div className="korea-signal-card__meta-row">
                          <span className="korea-signal-card__meta-label">현재 상태</span>
                          <span className="korea-signal-card__meta-value">{row.status}</span>
                        </div>
                        <div className="korea-signal-card__meta-row">
                          <span className="korea-signal-card__meta-label">시장 온도</span>
                          <span className={`korea-signal-temp korea-signal-temp--${String(row.marketTemp ?? "COOL").toLowerCase()}`}>
                            {row.marketTemp ?? "COOL"}
                          </span>
                        </div>
                      </div>
                      <div className="korea-signal-card__aux">
                        <span>거래량 {row.aux?.volume}</span>
                        <span>10일선 {row.aux?.ma10}</span>
                        <span>20일선 {row.aux?.ma20}</span>
                        <span>52주 {row.aux?.w52}</span>
                      </div>
                    </div>
                    <span
                      className={`korea-signal-badge korea-signal-badge--${row.statusId}`}
                      title={(SIGNAL_STATUS_META[row.statusId ?? "watch"] ?? SIGNAL_STATUS_META.watch).badge}
                    >
                      {row.badge}
                    </span>
                  </div>
                </button>
              </motion.article>
            ))
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  )
}
