import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatChartAxisMd } from "../../utils/chartDateFormat.js"
import {
  buildPanicEntryTimingTable,
  formatPanicSpxValidationSummary,
  formatPanicTimingPct,
  PANIC_SPX_VALIDATION_SERIES_URL,
  resolveBottomWindowDomain,
} from "../../content/ydsPanicSpxValidationSeries.js"

const CHART_HEIGHT = 320
const MARGIN = { top: 12, right: 48, left: 8, bottom: 8 }

/** @param {{ active?: boolean; payload?: object[] }} props */
function ValidationTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null
  return (
    <div className="yds-panic-spx-val__tooltip">
      <p className="yds-panic-spx-val__tooltip-date">{row.date}</p>
      <p className="yds-panic-spx-val__tooltip-row font-mono tabular-nums">
        Panic {row.panic != null ? row.panic : "—"}
      </p>
      <p className="yds-panic-spx-val__tooltip-row font-mono tabular-nums">
        SPX {row.spx != null ? Number(row.spx).toLocaleString("en-US") : "—"}
      </p>
      {row.isBottom ? (
        <p className="yds-panic-spx-val__tooltip-mark">SPX 저점</p>
      ) : null}
    </div>
  )
}

/**
 * Panic V2 × S&P500 장기 검증 차트 (시장 소스 재계산)
 */
export default function YdsPanicSpxValidationChart() {
  const [series, setSeries] = useState(
    /** @type {import("../../content/ydsPanicSpxValidationSeries.js").PanicSpxValidationSeries | null} */ (
      null
    ),
  )
  const [loadError, setLoadError] = useState(/** @type {string | null} */ (null))
  const [domain, setDomain] = useState(/** @type {[string, string] | null} */ (null))
  const [activeBottom, setActiveBottom] = useState(/** @type {string | null} */ (null))

  useEffect(() => {
    let cancelled = false
    fetch(PANIC_SPX_VALIDATION_SERIES_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json) => {
        if (cancelled) return
        setSeries(json)
        setLoadError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err?.message ?? "load failed")
        setSeries(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const chartData = useMemo(() => {
    if (!series?.rows?.length) return []
    const bottomSet = new Set((series.bottoms ?? []).map((b) => b.d0))
    return series.rows.map((r) => ({
      ...r,
      axisLabel: formatChartAxisMd(r.date),
      isBottom: bottomSet.has(r.date),
    }))
  }, [series])

  const filteredData = useMemo(() => {
    if (!domain) return chartData
    const [lo, hi] = domain
    return chartData.filter((r) => r.date >= lo && r.date <= hi)
  }, [chartData, domain])

  const summary = useMemo(() => formatPanicSpxValidationSummary(series), [series])
  const timingTable = useMemo(() => buildPanicEntryTimingTable(series), [series])

  const bottomMarkers = useMemo(() => {
    if (!series?.bottoms?.length) return []
    return series.bottoms
      .map((b) => {
        const row = chartData.find((r) => r.date === b.d0)
        if (!row) return null
        return { ...b, chartSpx: row.spx, chartPanic: row.panic }
      })
      .filter(Boolean)
  }, [series, chartData])

  const tierMarkers = useMemo(() => {
    if (!series?.bottoms?.length || !activeBottom) return []
    const b = series.bottoms.find((x) => x.d0 === activeBottom)
    if (!b) return []
    /** @type {{ key: string; date: string; panic: number; label: string }[]} */
    const marks = []
    if (b.first50) marks.push({ key: "50", date: b.first50.date, panic: b.first50.panic, label: "50" })
    if (b.first60) marks.push({ key: "60", date: b.first60.date, panic: b.first60.panic, label: "60" })
    if (b.first70) marks.push({ key: "70", date: b.first70.date, panic: b.first70.panic, label: "70" })
    return marks
  }, [series, activeBottom])

  const focusBottom = useCallback(
    (d0) => {
      if (!series) return
      if (activeBottom === d0) {
        setActiveBottom(null)
        setDomain(null)
        return
      }
      const win = resolveBottomWindowDomain(series, d0, 20, 5)
      setActiveBottom(d0)
      setDomain(win)
    },
    [series, activeBottom],
  )

  const resetZoom = useCallback(() => {
    setActiveBottom(null)
    setDomain(null)
  }, [])

  if (loadError) {
    return (
      <div className="yds-panic-spx-val yds-panic-spx-val--empty" role="status">
        <p className="yds-panic-spx-val__empty">장기 검증 시계열을 불러오지 못했습니다.</p>
      </div>
    )
  }

  if (!series || chartData.length < 2) {
    return (
      <div className="yds-panic-spx-val yds-panic-spx-val--empty" role="status">
        <p className="yds-panic-spx-val__empty">장기 검증 시계열 준비중…</p>
      </div>
    )
  }

  return (
    <div className="yds-panic-spx-val">
      <div className="yds-panic-spx-val__toolbar">
        <p className="yds-panic-spx-val__hint">
          저점 칩을 누르면 D−20~D+5 구간 · 전체는 Reset
        </p>
        <button type="button" className="yds-panic-spx-val__reset" onClick={resetZoom}>
          Reset
        </button>
      </div>

      <div className="yds-panic-spx-val__chips" role="list" aria-label="SPX 주요 저점">
        {(series.bottoms ?? []).map((b) => (
          <button
            key={b.d0}
            type="button"
            role="listitem"
            className={[
              "yds-panic-spx-val__chip",
              activeBottom === b.d0 ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => focusBottom(b.d0)}
          >
            {b.d0.slice(2)}
          </button>
        ))}
      </div>

      <div className="yds-panic-spx-val__plot">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <ComposedChart data={filteredData} margin={MARGIN}>
            <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => formatChartAxisMd(String(v))}
              minTickGap={28}
              tick={{ fill: "#64748b", fontSize: 10 }}
              axisLine={{ stroke: "rgba(148,163,184,0.25)" }}
              tickLine={false}
            />
            <YAxis
              yAxisId="panic"
              domain={[0, 100]}
              ticks={[0, 20, 40, 50, 60, 70, 80, 100]}
              width={36}
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              label={{
                value: "Panic",
                angle: -90,
                position: "insideLeft",
                offset: 4,
                style: { fill: "#64748b", fontSize: 10 },
              }}
            />
            <YAxis
              yAxisId="spx"
              orientation="right"
              domain={["auto", "auto"]}
              width={44}
              tick={{ fill: "#64748b", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) =>
                Number(v) >= 1000 ? `${Math.round(Number(v) / 100) / 10}k` : String(v)
              }
              label={{
                value: "SPX",
                angle: 90,
                position: "insideRight",
                offset: 4,
                style: { fill: "#64748b", fontSize: 10 },
              }}
            />
            <Tooltip content={<ValidationTooltip />} />
            <Legend
              verticalAlign="top"
              height={22}
              wrapperStyle={{ fontSize: 11, color: "#94a3b8" }}
            />

            <ReferenceLine
              yAxisId="panic"
              y={50}
              stroke="#eab308"
              strokeDasharray="4 4"
              strokeOpacity={0.85}
              label={{ value: "50", position: "insideTopLeft", fill: "#eab308", fontSize: 10 }}
            />
            <ReferenceLine
              yAxisId="panic"
              y={60}
              stroke="#f97316"
              strokeDasharray="4 4"
              strokeOpacity={0.85}
              label={{ value: "60", position: "insideTopLeft", fill: "#f97316", fontSize: 10 }}
            />
            <ReferenceLine
              yAxisId="panic"
              y={70}
              stroke="#ef4444"
              strokeDasharray="4 4"
              strokeOpacity={0.9}
              label={{ value: "70", position: "insideTopLeft", fill: "#ef4444", fontSize: 10 }}
            />

            <Line
              yAxisId="spx"
              type="monotone"
              dataKey="spx"
              name="S&P500"
              stroke="#64748b"
              strokeWidth={1.35}
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
            <Line
              yAxisId="panic"
              type="monotone"
              dataKey="panic"
              name="Panic Index"
              stroke="#38bdf8"
              strokeWidth={1.75}
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />

            {bottomMarkers.map((b) => (
              <ReferenceDot
                key={`bottom-${b.d0}`}
                yAxisId="spx"
                x={b.d0}
                y={b.chartSpx}
                r={activeBottom === b.d0 ? 5 : 3.5}
                fill="#f8fafc"
                stroke="#e2e8f0"
                strokeWidth={1.5}
                ifOverflow="hidden"
                label={
                  activeBottom === b.d0
                    ? {
                        value: "SPX 저점",
                        position: "top",
                        fill: "#cbd5e1",
                        fontSize: 9,
                      }
                    : undefined
                }
              />
            ))}

            {tierMarkers.map((m) => (
              <ReferenceDot
                key={`tier-${m.key}-${m.date}`}
                yAxisId="panic"
                x={m.date}
                y={m.panic}
                r={4}
                fill={m.key === "70" ? "#ef4444" : m.key === "60" ? "#f97316" : "#eab308"}
                stroke="#0b0e14"
                strokeWidth={1}
                ifOverflow="hidden"
                label={{
                  value: m.label,
                  position: "bottom",
                  fill: "#94a3b8",
                  fontSize: 9,
                }}
              />
            ))}

            {!domain ? (
              <Brush
                dataKey="date"
                height={22}
                stroke="rgba(148,163,184,0.35)"
                fill="rgba(15,23,42,0.6)"
                tickFormatter={(v) => formatChartAxisMd(String(v))}
                travellerWidth={8}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {summary ? (
        <aside className="yds-panic-spx-val__summary" aria-label="검증 요약">
          <p className="yds-panic-spx-val__summary-head">{summary.headline}</p>
          <ul className="yds-panic-spx-val__summary-list">
            {summary.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="yds-panic-spx-val__summary-note">{summary.note}</p>
          <p className="yds-panic-spx-val__quality">
            시장 소스 재계산 V2 기준 · YDS History DB 저장값과 별도
            {summary.missingPanicDates.length
              ? ` · 공백: ${summary.missingPanicDates.join(", ")}`
              : ""}
          </p>
        </aside>
      ) : null}

      {timingTable ? (
        <section className="yds-panic-spx-val__timing" aria-label="저점별 매수 타이밍 검증표">
          <h4 className="yds-panic-spx-val__timing-title">저점별 매수 타이밍 검증표</h4>
          <p className="yds-panic-spx-val__timing-sub">D−20 ~ D0 · 각 threshold 최초 도달</p>
          <div className="yds-panic-spx-val__timing-scroll">
            <table className="yds-panic-spx-val__timing-table">
              <thead>
                <tr>
                  <th scope="col">저점</th>
                  <th scope="col" className="is-num">
                    SPX 하락
                  </th>
                  <th scope="col">50 최초</th>
                  <th scope="col" className="is-num">
                    50→저점
                  </th>
                  <th scope="col">60 최초</th>
                  <th scope="col" className="is-num">
                    60→저점
                  </th>
                  <th scope="col">70 최초</th>
                  <th scope="col" className="is-num">
                    70→저점
                  </th>
                </tr>
              </thead>
              <tbody>
                {timingTable.rows.map((r) => (
                  <tr key={r.d0}>
                    <th scope="row" className="font-mono tabular-nums">
                      {r.d0}
                    </th>
                    <td className="is-num font-mono tabular-nums">{r.ddLabel}</td>
                    <td className="font-mono tabular-nums">{r.t50Label}</td>
                    <td className="is-num font-mono tabular-nums">{r.t50ToBottomLabel}</td>
                    <td className="font-mono tabular-nums">{r.t60Label}</td>
                    <td className="is-num font-mono tabular-nums">{r.t60ToBottomLabel}</td>
                    <td className="font-mono tabular-nums">{r.t70Label}</td>
                    <td className="is-num font-mono tabular-nums">{r.t70ToBottomLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="yds-panic-spx-val__timing-agg">
            <li>
              Panic 50 → 저점 평균 추가하락:{" "}
              <span className="font-mono tabular-nums">
                {timingTable.aggregates.avgDropAfter50 == null
                  ? "—"
                  : formatPanicTimingPct(timingTable.aggregates.avgDropAfter50)}
              </span>
            </li>
            <li>
              Panic 60 → 저점 평균 추가하락:{" "}
              <span className="font-mono tabular-nums">
                {timingTable.aggregates.avgDropAfter60 == null
                  ? "—"
                  : formatPanicTimingPct(timingTable.aggregates.avgDropAfter60)}
              </span>
            </li>
            <li>
              Panic 70 → 저점 평균 추가하락:{" "}
              <span className="font-mono tabular-nums">
                {timingTable.aggregates.avgDropAfter70 == null
                  ? "—"
                  : formatPanicTimingPct(timingTable.aggregates.avgDropAfter70)}
              </span>
            </li>
            <li>
              D0 도달률: ≥50 {timingTable.aggregates.reach50} · ≥60{" "}
              {timingTable.aggregates.reach60} · ≥70 {timingTable.aggregates.reach70}
            </li>
          </ul>
          <p className="yds-panic-spx-val__timing-disclaimer">{timingTable.disclaimer}</p>
        </section>
      ) : null}
    </div>
  )
}
