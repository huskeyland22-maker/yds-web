import { useMemo, useState, useEffect } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { buildRecommendationTrackRows, formatRecommendPrice } from "../trading-zone/tradingZoneRecommendationTrack.js"
import { getTradingZonePositions } from "../trading-zone/tacticalTradingZoneData.js"
import { STOCK_RADAR_UNIVERSE } from "../trading-zone/ydsPrecursorEnginePhase26.js"
import RecommendationJourneyStrip from "../components/journey/RecommendationJourneyStrip.jsx"

const FILTERS = ["전체", "진행중", "종료", "익절", "손절"]

/** @type {Map<string, string>} */
const WATCH_ID_BY_SYMBOL = new Map()
for (const s of STOCK_RADAR_UNIVERSE) {
  WATCH_ID_BY_SYMBOL.set(s.symbol, s.id)
  WATCH_ID_BY_SYMBOL.set(s.name, s.id)
  if (s.code) WATCH_ID_BY_SYMBOL.set(s.code, s.id)
}

function statusFromRow(row, positionBySymbol) {
  const ret = Number(row?.returnPct)
  const stage = positionBySymbol.get(row.symbol)?.stage
  if (stage === "takeProfit") return ret >= 0 ? "익절" : "종료"
  if (stage === "risk") return "손절"
  if (!Number.isFinite(ret)) return "진행중"
  if (ret >= 8) return "익절"
  if (ret <= -6) return "손절"
  return "진행중"
}

function pct(v) {
  if (!Number.isFinite(v)) return "—"
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`
}

function rowMatchesQuery(row, q) {
  if (!q) return true
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return (
    String(row.symbol).toLowerCase().includes(needle) ||
    String(row.id).toLowerCase().includes(needle)
  )
}

export default function RecommendationHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filter, setFilter] = useState("전체")
  const query = searchParams.get("q") ?? ""

  const basePositions = useMemo(() => getTradingZonePositions(), [])
  const rows = useMemo(() => buildRecommendationTrackRows(basePositions, [], {}), [basePositions])
  const positionBySymbol = useMemo(
    () => new Map(basePositions.map((p) => [String(p.symbol), p])),
    [basePositions],
  )

  const rowsWithStatus = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        status: statusFromRow(row, positionBySymbol),
        watchId: WATCH_ID_BY_SYMBOL.get(row.symbol) ?? null,
      })),
    [rows, positionBySymbol],
  )

  const filtered = useMemo(() => {
    let list = rowsWithStatus
    if (filter === "종료") list = list.filter((r) => r.status === "익절" || r.status === "손절")
    else if (filter !== "전체") list = list.filter((r) => r.status === filter)
    if (query) list = list.filter((r) => rowMatchesQuery(r, query))
    return list
  }, [rowsWithStatus, filter, query])

  useEffect(() => {
    if (!query) return
    const first = filtered[0]
    if (!first) return
    const el = document.getElementById(`reco-row-${first.id}`)
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [query, filtered])

  const summary = useMemo(() => {
    const withRet = rowsWithStatus.filter((r) => Number.isFinite(r.returnPct))
    const wins = withRet.filter((r) => Number(r.returnPct) > 0).length
    const avg = withRet.length
      ? withRet.reduce((sum, r) => sum + Number(r.returnPct), 0) / withRet.length
      : null
    const sorted = [...withRet].sort((a, b) => Number(b.returnPct) - Number(a.returnPct))
    return {
      total: rowsWithStatus.length,
      winRate: withRet.length ? (wins / withRet.length) * 100 : null,
      avgReturn: avg,
      best: sorted[0] ?? null,
      worst: sorted[sorted.length - 1] ?? null,
    }
  }, [rowsWithStatus])

  return (
    <div className="reco-history-page min-w-0 px-3 py-4 sm:px-4">
      <header className="reco-history-page__head">
        <h1 className="reco-history-page__title">추천 이력</h1>
        <p className="reco-history-page__sub">YDS 추천 결과를 성공/실패 모두 투명하게 공개합니다.</p>
        <Link to="/market-analysis" className="reco-history-page__link">
          시장분석
        </Link>
      </header>

      <RecommendationJourneyStrip step="performance" />

      <section className="reco-history-search" aria-label="종목 검색">
        <label htmlFor="reco-q" className="reco-history-search__label">
          종목 필터
        </label>
        <input
          id="reco-q"
          type="search"
          className="reco-history-search__input"
          placeholder="종목명·심볼 (예: AVGO, 실리콘투)"
          value={query}
          onChange={(e) => {
            const v = e.target.value
            if (v) setSearchParams({ q: v })
            else setSearchParams({})
          }}
        />
        {query ? (
          <button type="button" className="reco-history-search__clear" onClick={() => setSearchParams({})}>
            필터 해제
          </button>
        ) : null}
      </section>

      <section className="reco-history-summary" aria-label="성과 요약">
        <p className="m-0 reco-history-summary__item">
          <span>전체 추천</span>
          <strong className="font-mono tabular-nums">{summary.total}</strong>
        </p>
        <p className="m-0 reco-history-summary__item">
          <span>승률</span>
          <strong className="font-mono tabular-nums">
            {summary.winRate != null ? `${summary.winRate.toFixed(1)}%` : "—"}
          </strong>
        </p>
        <p className="m-0 reco-history-summary__item">
          <span>평균 수익률</span>
          <strong className="font-mono tabular-nums">{pct(summary.avgReturn)}</strong>
        </p>
        <p className="m-0 reco-history-summary__item reco-history-summary__item--full">
          <span>최고/최악 종목</span>
          <strong>
            {summary.best ? `${summary.best.symbol} ${pct(summary.best.returnPct)}` : "—"} /{" "}
            {summary.worst ? `${summary.worst.symbol} ${pct(summary.worst.returnPct)}` : "—"}
          </strong>
        </p>
      </section>

      <section className="reco-history-filter" aria-label="추천 이력 필터">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={["reco-history-filter__chip", filter === f ? "reco-history-filter__chip--active" : ""].join(" ")}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </section>

      <section className="reco-history-table-wrap" aria-label="추천 이력 테이블">
        <div className="reco-history-table" role="table">
          <p className="m-0 reco-history-table__head" role="row">
            <span>추천일</span>
            <span>종목명</span>
            <span>추천가</span>
            <span>현재가</span>
            <span>수익률</span>
            <span>상태</span>
          </p>
          {filtered.length ? (
            filtered.map((row) => (
              <p
                key={row.id}
                id={`reco-row-${row.id}`}
                className={[
                  "m-0 reco-history-table__row",
                  query && rowMatchesQuery(row, query) ? "reco-history-table__row--hit" : "",
                ].join(" ")}
                role="row"
              >
                <span className="font-mono tabular-nums">{row.recommendedAt}</span>
                <span>
                  {row.symbol}
                  {row.watchId ? (
                    <Link to={`/watchlist#watchlist-${row.watchId}`} className="reco-history-table__watch-link">
                      관심종목
                    </Link>
                  ) : null}
                </span>
                <span className="font-mono tabular-nums">{formatRecommendPrice(row.recommendedPrice, row.market)}</span>
                <span className="font-mono tabular-nums">{formatRecommendPrice(row.currentPrice, row.market)}</span>
                <span
                  className={[
                    "font-mono tabular-nums",
                    row.returnPct > 0 ? "reco-history-table__up" : row.returnPct < 0 ? "reco-history-table__down" : "",
                  ].join(" ")}
                >
                  {pct(row.returnPct)}
                </span>
                <span>{row.status}</span>
              </p>
            ))
          ) : (
            <p className="reco-history-table__empty">조건에 맞는 추천 이력이 없습니다.</p>
          )}
        </div>
      </section>
    </div>
  )
}
