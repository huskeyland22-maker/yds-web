import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { getKoreaSectorById } from "../../data/koreaGrowthSectorMap.js"
import { usePanicStore } from "../../store/panicStore.js"
import { getFinalScore } from "../../utils/tradingScores.js"
import {
  buildAllSectorSignalCounts,
  buildSectorSignalGroups,
  buildStockSignalRow,
  SIGNAL_STATUS_META,
} from "../../utils/koreaIndustrySignal.js"
import { rowFromApiStockSignal } from "../../utils/stockSignalEngine.js"
import { fetchStockSignalsBatch } from "../../utils/stockSignalApi.js"

const LIST_FADE = { duration: 0.28, ease: [0.22, 1, 0.36, 1] }

const AUX_CHIPS = [
  { key: "ma10", label: "10일선" },
  { key: "ma20", label: "20일선" },
  { key: "w52", label: "52주" },
]

/**
 * @param {{
 *   row: object
 *   expanded: boolean
 *   onToggle: () => void
 *   onDetail: () => void
 * }} props
 */
function SignalStockCard({ row, expanded, onToggle, onDetail }) {
  const statusId = row.statusId ?? "watch"
  const shortBadge = row.shortBadge ?? SIGNAL_STATUS_META[statusId]?.shortBadge ?? "관망"
  const showHotTemp = String(row.marketTemp ?? "").toUpperCase() === "HOT"

  return (
    <article
      className={["korea-signal-card", expanded ? "is-expanded" : ""].filter(Boolean).join(" ")}
    >
      <button type="button" className="korea-signal-card__hit" onClick={onToggle}>
        <div className="korea-signal-card__body">
          <p className="korea-signal-card__name" title={row.code}>
            {row.name}
          </p>
          {row.tip ? <p className="korea-signal-card__role">{row.tip}</p> : null}
          <div className="korea-signal-card__tags">
            <span className={`korea-signal-badge korea-signal-badge--${statusId}`}>{shortBadge}</span>
            {showHotTemp ? (
              <span className="korea-signal-card__temp">온도 {row.marketTemp}</span>
            ) : null}
          </div>
        </div>
      </button>

      <div className="korea-signal-card__expand" aria-hidden={!expanded}>
        <div className="korea-signal-card__expand-inner">
          {AUX_CHIPS.map(({ key, label }) => (
            <span key={key} className="korea-signal-metric-chip">
              {label} {row.aux?.[key] ?? "—"}
            </span>
          ))}
          <button type="button" className="korea-signal-card__strategy" onClick={onDetail}>
            상세 전략 열기
          </button>
        </div>
      </div>
    </article>
  )
}

/**
 * @param {{
 *   selectedId: string
 *   heatById?: Record<string, string>
 *   onSectorSelect: (sectorId: string) => void
 *   onStockSelect: (payload: { stock: object; sectorName: string }) => void
 * }} props
 */
export default function KoreaIndustrySignalBoard({
  selectedId,
  heatById = {},
  onSectorSelect,
  onStockSelect,
}) {
  const [expandedCode, setExpandedCode] = useState(null)
  const [openGroups, setOpenGroups] = useState(() => new Set())
  const [liveByCode, setLiveByCode] = useState({})
  const [liveLoading, setLiveLoading] = useState(false)

  const panicData = usePanicStore((s) => s.panicData)
  const panicIndex = useMemo(
    () => (panicData ? getFinalScore(panicData) : null),
    [panicData],
  )

  const sector = useMemo(() => getKoreaSectorById(selectedId), [selectedId])
  const sectorHeat = heatById[selectedId] || sector?.heat

  const sectorCounts = useMemo(() => {
    try {
      const built = buildAllSectorSignalCounts(heatById ?? {})
      return Array.isArray(built) ? built : []
    } catch {
      return []
    }
  }, [heatById])

  const groups = useMemo(() => {
    try {
      const built = buildSectorSignalGroups(sector, sectorHeat)
      return Array.isArray(built) ? built : []
    } catch {
      return []
    }
  }, [sector, sectorHeat])

  const enrichedGroups = useMemo(() => {
    return groups.map((group) => ({
      ...group,
      rows: group.rows.map((row) => {
        const live = liveByCode[row.code]
        if (!live) return row
        return buildStockSignalRow(
          { name: row.name, code: row.code, tip: row.tip },
          {
            sectorName: sector?.name ?? "",
            sectorHeat,
            subLabel: group.label,
            live,
          },
        )
      }),
    }))
  }, [groups, liveByCode, sector?.name, sectorHeat])

  const rowCount = useMemo(
    () => enrichedGroups.reduce((n, g) => n + g.rows.length, 0),
    [enrichedGroups],
  )

  useEffect(() => {
    setExpandedCode(null)
    if (groups[0]?.id) setOpenGroups(new Set([groups[0].id]))
    else setOpenGroups(new Set())
  }, [selectedId, groups])

  useEffect(() => {
    const codes = groups.flatMap((g) => g.rows.map((r) => r.code)).filter(Boolean)
    if (!codes.length) {
      setLiveByCode({})
      return undefined
    }

    let cancelled = false
    setLiveLoading(true)

    void fetchStockSignalsBatch(codes, { panicIndex })
      .then(({ results }) => {
        if (cancelled) return
        /** @type {Record<string, object>} */
        const mapped = {}
        for (const [code, payload] of Object.entries(results ?? {})) {
          const row = rowFromApiStockSignal(payload?.stockSignal)
          if (row) mapped[code] = row
        }
        setLiveByCode(mapped)
      })
      .catch(() => {
        if (!cancelled) setLiveByCode({})
      })
      .finally(() => {
        if (!cancelled) setLiveLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedId, groups, panicIndex])

  const toggleGroup = (groupId) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  return (
    <section id="industry-signal-board" className="korea-signal-board scroll-mt-24" aria-label="산업 시그널 보드">
      <header className="korea-signal-board__head">
        <p className="korea-signal-board__eyebrow">Industry flow</p>
        <h2 className="korea-signal-board__title">핵심 종목</h2>
        <p className="korea-signal-board__sub">
          {sector?.name ?? "산업 선택"} · {rowCount}종목
          {liveLoading ? " · 실시간 계산 중" : liveByCode && Object.keys(liveByCode).length ? " · 실시간" : ""}
        </p>
      </header>

      <div className="korea-sector-chips" role="tablist" aria-label="산업 선택">
        {sectorCounts.map((item) => {
          const active = item.sectorId === selectedId
          const total = item.total ?? 0
          return (
            <button
              key={item.sectorId}
              type="button"
              role="tab"
              aria-selected={active}
              className={["korea-sector-chip", active ? "is-active" : ""].filter(Boolean).join(" ")}
              onClick={() => onSectorSelect(item.sectorId)}
            >
              {item.label}
              <span className="korea-sector-chip__count">({total})</span>
            </button>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={selectedId}
          className="korea-signal-detail"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={LIST_FADE}
        >
          {enrichedGroups.length === 0 ? (
            <p className="korea-signal-empty m-0">선택한 산업의 종목 데이터가 없습니다.</p>
          ) : (
            <div className="korea-signal-accordion">
              {enrichedGroups.map((group) => {
                const open = openGroups.has(group.id)
                return (
                  <div key={group.id} className={["korea-signal-accordion__item", open ? "is-open" : ""].join(" ")}>
                    <button
                      type="button"
                      className="korea-signal-accordion__trigger"
                      aria-expanded={open}
                      onClick={() => toggleGroup(group.id)}
                    >
                      <span>{group.label}</span>
                      <span className="korea-signal-accordion__meta">{group.rows.length}종목</span>
                    </button>
                    {open ? (
                      <div className="korea-signal-card-grid">
                        {group.rows.map((row, i) => (
                          <SignalStockCard
                            key={`${row.code}-${i}`}
                            row={row}
                            expanded={expandedCode === row.code}
                            onToggle={() =>
                              setExpandedCode((prev) => (prev === row.code ? null : row.code))
                            }
                            onDetail={() =>
                              onStockSelect({
                                stock: { name: row.name, code: row.code, tip: row.tip },
                                sectorName: row.sectorName,
                              })
                            }
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  )
}
