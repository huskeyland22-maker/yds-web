import YdsStockPickStatusCard from "./YdsStockPickStatusCard.jsx"

/**
 * @param {{ view: ReturnType<typeof import("../../content/ydsStockPickV1View.js").resolveStockPickV1View> }} props
 */
export default function YdsStockPickV1Hub({ view }) {
  if (!view?.hasData) return null

  return (
    <div className="yds-spick-v1">
      <section className="yds-spick-v1__section" aria-labelledby="spick-today">
        <h2 id="spick-today" className="yds-spick-v1__title">
          오늘의 관심종목
        </h2>

        {view.starGroups.map((group) => (
          <div key={group.tier} className="yds-spick-v1__star-group">
            <p className="yds-spick-v1__stars-row">
              <span className="yds-spick-v1__stars-glyphs">{group.stars}</span>
              {group.label ? (
                <span className="yds-spick-v1__stars-label">{group.label}</span>
              ) : null}
            </p>
            <div className="yds-spick-v1__card-grid">
              {group.picks.map((pick) => (
                <YdsStockPickStatusCard
                  key={pick.id}
                  name={pick.name}
                  stars={pick.stars}
                  status={pick.status}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="yds-spick-v1__section" aria-labelledby="spick-sector">
        <h2 id="spick-sector" className="yds-spick-v1__title">
          섹터
        </h2>

        <div className="yds-spick-v1__sector-tabs" role="list" aria-label="섹터 목록">
          {view.sectorGroups.map((sector) => (
            <span key={sector.id} className="yds-spick-v1__sector-tab" role="listitem">
              {sector.label}
            </span>
          ))}
        </div>

        {view.sectorGroups.map((sector) => (
          <div key={sector.id} className="yds-spick-v1__sector">
            <h3 className="yds-spick-v1__sector-label">{sector.label}</h3>
            <div className="yds-spick-v1__card-grid yds-spick-v1__card-grid--sector">
              {sector.picks.map((pick) => (
                <YdsStockPickStatusCard
                  key={pick.id}
                  name={pick.name}
                  stars={pick.stars}
                  status={pick.status}
                />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
