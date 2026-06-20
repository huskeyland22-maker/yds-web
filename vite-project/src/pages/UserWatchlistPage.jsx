import { useMemo, useEffect } from "react"
import { Link } from "react-router-dom"
import {
  buildUserWatchlistReport,
  deltaToneClass,
  formatWatchlistDelta,
} from "../content/ydsUserWatchlistEngine.js"
import { useStockPickFavorites } from "../hooks/useStockPickFavorites.js"
import { useStockPickFavoriteAlerts } from "../hooks/useStockPickFavoriteAlerts.js"
import { useStockPickLiveData } from "../hooks/useStockPickLiveData.js"
import { useYdsMarketContext } from "../hooks/useYdsMarketContext.js"
import YdsStockPickFavoriteButton from "../components/stock-picks/YdsStockPickFavoriteButton.jsx"
import YdsV1ReleaseBadge from "../components/trust/YdsV1ReleaseBadge.jsx"
import YdsEmptyState from "../components/trust/YdsEmptyState.jsx"
import { UI_PAGE } from "../utils/ydsUiLabels.js"

function DeltaCell({ delta }) {
  return (
    <span className={`font-mono tabular-nums ${deltaToneClass(delta?.direction)}`}>
      {formatWatchlistDelta(delta)}
    </span>
  )
}

/**
 * @param {import("../content/ydsUserWatchlistEngine.js").buildWatchlistItem extends (...args: any) => infer R ? R : never} item
 */
function WatchlistItemCard({ item, onToggleFavorite }) {
  return (
    <article className="yds-user-watchlist__card" id={`watch-${item.ticker}`}>
      <header className="yds-user-watchlist__card-head">
        <div>
          <Link to={`/stock-picks/${encodeURIComponent(item.ticker)}`} className="yds-user-watchlist__name">
            {item.name}
          </Link>
          <span className="yds-user-watchlist__ticker font-mono">{item.ticker}</span>
        </div>
        <YdsStockPickFavoriteButton active onToggle={() => onToggleFavorite(item.ticker)} />
      </header>

      <div className="yds-user-watchlist__score-row">
        <div className="yds-user-watchlist__score-main">
          <span className="yds-user-watchlist__score-label">현재 점수</span>
          <strong className="yds-user-watchlist__score-val font-mono tabular-nums">
            {Math.round(item.totalScore)}
          </strong>
        </div>
        <span className={`yds-user-watchlist__position yds-user-watchlist__position--${item.positionId}`}>
          {item.positionEmoji} {item.positionLabel}
        </span>
      </div>

      <dl className="yds-user-watchlist__grades">
        <div>
          <dt>기업품질</dt>
          <dd>{item.qualityGrade}</dd>
        </div>
        <div>
          <dt>타이밍</dt>
          <dd>{item.timingGrade}</dd>
        </div>
        <div>
          <dt>시장적합</dt>
          <dd>
            {item.marketFitGrade} ({item.marketFitScore})
          </dd>
        </div>
        <div>
          <dt>진입</dt>
          <dd>{item.cardActionLabel}</dd>
        </div>
      </dl>

      <div className="yds-user-watchlist__delta-grid">
        <div>
          <span className="yds-user-watchlist__delta-key">전일 총점</span>
          <DeltaCell delta={item.deltas.total} />
        </div>
        <div>
          <span className="yds-user-watchlist__delta-key">타이밍</span>
          <DeltaCell delta={item.deltas.timing} />
        </div>
        <div>
          <span className="yds-user-watchlist__delta-key">시장적합</span>
          <DeltaCell delta={item.deltas.marketFit} />
        </div>
      </div>
    </article>
  )
}

function DashboardList({ title, items, emptyNote }) {
  if (!items.length) {
    return (
      <div className="yds-user-watchlist__dash-block">
        <h3 className="yds-user-watchlist__h3">{title}</h3>
        <p className="yds-user-watchlist__note">{emptyNote}</p>
      </div>
    )
  }
  return (
    <div className="yds-user-watchlist__dash-block">
      <h3 className="yds-user-watchlist__h3">{title}</h3>
      <ol className="yds-user-watchlist__dash-list">
        {items.map((item) => (
          <li key={item.ticker}>
            <Link to={`/stock-picks/${encodeURIComponent(item.ticker)}`}>{item.name}</Link>
            <span className={`font-mono tabular-nums ${deltaToneClass(item.deltas.total?.direction)}`}>
              {formatWatchlistDelta(item.deltas.total)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function UserWatchlistPage() {
  const marketContext = useYdsMarketContext()
  const { stocks: liveStocks, loading } = useStockPickLiveData(marketContext)
  const { favorites, toggleFavorite, favoriteCount } = useStockPickFavorites()
  const alerts = useStockPickFavoriteAlerts(liveStocks, favorites)

  const report = useMemo(
    () => buildUserWatchlistReport(favorites, liveStocks),
    [favorites, liveStocks],
  )

  useEffect(() => {
    const hash = window.location.hash?.replace("#", "")
    if (!hash?.startsWith("watch-")) return
    const el = document.getElementById(hash)
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [report.items.length])

  return (
    <div className="yds-user-watchlist min-w-0 px-3 py-4 sm:px-4">
      <header className="yds-user-watchlist__header">
        <div>
          <YdsV1ReleaseBadge compact />
          <p className="yds-user-watchlist__kicker">Watchlist · 관심종목</p>
          <h1 className="yds-user-watchlist__title">{UI_PAGE.watchlist.title}</h1>
          <p className="yds-user-watchlist__sub">
            ★ 등록 종목 · 점수·위치 추적 · 전일 대비 변화 · 진입 신호
          </p>
        </div>
        <Link to="/stock-picks" className="yds-user-watchlist__nav-link">
          종목추천
        </Link>
      </header>

      {favoriteCount === 0 ? (
        <YdsEmptyState
          icon="⭐"
          title="관심종목 없음"
          description="종목 카드에서 ★를 눌러 등록하세요. 타이밍·시장적합·총점 변화와 1차 진입 신호를 추적합니다."
          primaryTo="/stock-picks"
          primaryLabel="종목추천"
        />
      ) : (
        <>
          {alerts.length ? (
            <section className="yds-user-watchlist__section" aria-labelledby="watch-alerts">
              <h2 id="watch-alerts" className="yds-user-watchlist__h2">
                신규 진입 알림
              </h2>
              <ul className="yds-user-watchlist__alerts">
                {alerts.map((alert) => (
                  <li key={`${alert.ticker}-${alert.type}-${alert.message}`}>
                    <Link to={`/stock-picks/${encodeURIComponent(alert.ticker)}`}>
                      <strong>{alert.name}</strong> — {alert.message}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="yds-user-watchlist__section" aria-labelledby="watch-dash">
            <h2 id="watch-dash" className="yds-user-watchlist__h2">
              대시보드 · n={report.count}
            </h2>
            <div className="yds-user-watchlist__dash-grid">
              <DashboardList
                title="오늘 변화 종목"
                items={report.dashboard.changedToday}
                emptyNote="전일 대비 변화가 없습니다."
              />
              <DashboardList
                title="점수 상승 TOP"
                items={report.dashboard.topUp}
                emptyNote="상승 종목 없음"
              />
              <DashboardList
                title="점수 하락 TOP"
                items={report.dashboard.topDown}
                emptyNote="하락 종목 없음"
              />
            </div>
          </section>

          <section className="yds-user-watchlist__section" aria-labelledby="watch-list">
            <h2 id="watch-list" className="yds-user-watchlist__h2">
              관심종목
            </h2>
            {loading && !report.items.length ? (
              <p className="yds-user-watchlist__note">시세·점수 갱신 중…</p>
            ) : null}
            {report.missingTickers.length ? (
              <p className="yds-user-watchlist__note">
                미표시: {report.missingTickers.join(", ")} (추천 유니버스 외 또는 로딩 대기)
              </p>
            ) : null}
            <div className="yds-user-watchlist__cards">
              {report.items.map((item) => (
                <WatchlistItemCard key={item.ticker} item={item} onToggleFavorite={toggleFavorite} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
