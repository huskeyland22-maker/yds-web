/**
 * 재사용 가능한 반원형 위치 게이지.
 * 점수·구간은 호출측 모델에서 결정한다 (엔진 합산 없음).
 *
 * @param {{
 *   model: {
 *     axis?: string
 *     ready: boolean
 *     loading?: boolean
 *     emptyLabel?: string | null
 *     emptyHint?: string | null
 *     score: number | null
 *     scoreDisplay: string
 *     unit?: string
 *     deg: number | null
 *     stageLabel?: string | null
 *     stageColor?: string | null
 *     stageBlurb?: string | null
 *     asOf?: string | null
 *     bands?: Array<{ id: string, min: number, max: number, label: string, color: string }>
 *     footnotes?: string[]
 *   }
 *   title: string
 *   kicker?: string
 *   size?: "hero" | "panel"
 *   className?: string
 * }} props
 */
export default function YdsPositionGauge({
  model,
  title,
  kicker = "",
  size = "hero",
  className = "",
}) {
  const ready = Boolean(model?.ready) && model?.deg != null && model?.score != null
  const deg = ready ? model.deg : 0
  const bands = Array.isArray(model?.bands) ? model.bands : []
  const arcStops = buildBandArcGradient(bands)

  return (
    <div
      className={["yds-pos-gauge", `yds-pos-gauge--${size}`, className].filter(Boolean).join(" ")}
      data-axis={model?.axis || ""}
      data-ready={ready ? "true" : "false"}
      data-loading={model?.loading ? "true" : "false"}
      aria-label={
        ready
          ? `${title} ${model.scoreDisplay}${model.unit || ""} · ${model.stageLabel || ""}`
          : `${title} · ${model?.emptyLabel || "데이터 연결 대기"}`
      }
    >
      <header className="yds-pos-gauge__head">
        {kicker ? <p className="yds-pos-gauge__kicker">{kicker}</p> : null}
        <h3 className="yds-pos-gauge__title">{title}</h3>
        <p className="yds-pos-gauge__asof">
          {model?.asOf ? `기준일 ${model.asOf}` : "기준일 —"}
        </p>
      </header>

      <div
        className={["yds-pos-gauge__dial", ready ? "" : "is-empty"].filter(Boolean).join(" ")}
        style={{ "--yds-pos-deg": `${deg}deg`, "--yds-pos-arc": arcStops }}
      >
        <div className="yds-pos-gauge__arc" aria-hidden />
        {ready ? (
          <svg className="yds-pos-gauge__needle" viewBox="0 0 220 110" aria-hidden>
            <line
              x1="110"
              y1="26"
              x2="110"
              y2="4"
              stroke="#e8eef8"
              strokeWidth="2.75"
              strokeLinecap="round"
              transform={`rotate(${deg - 90} 110 110)`}
            />
            <circle cx="110" cy="110" r="4.5" fill="#8b7cf6" />
          </svg>
        ) : null}

        <div className="yds-pos-gauge__readout">
          {ready ? (
            <>
              <p className="yds-pos-gauge__score">
                <span className="yds-pos-gauge__score-num">{model.scoreDisplay}</span>
                <span className="yds-pos-gauge__score-unit">{model.unit || ""}</span>
              </p>
              <p
                className="yds-pos-gauge__stage"
                style={model.stageColor ? { color: model.stageColor } : undefined}
              >
                {model.stageLabel}
              </p>
            </>
          ) : (
            <>
              <p className="yds-pos-gauge__score yds-pos-gauge__score--empty">
                <span className="yds-pos-gauge__score-num">—</span>
              </p>
              <p className="yds-pos-gauge__stage yds-pos-gauge__stage--empty">
                {model?.loading ? "불러오는 중…" : model?.emptyLabel || "데이터 연결 대기"}
              </p>
            </>
          )}
        </div>
      </div>

      <p className="yds-pos-gauge__blurb">
        {ready
          ? model.stageBlurb
          : model?.emptyHint || "실제 관측이 연결되면 위치와 국면을 표시합니다."}
      </p>

      {bands.length ? (
        <ol className="yds-pos-gauge__legend" aria-label="구간">
          {bands.map((band) => (
            <li key={band.id}>
              <span className="yds-pos-gauge__swatch" style={{ background: band.color }} />
              <span>
                {band.label}
                <em>
                  {band.min}–{band.max}
                </em>
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {Array.isArray(model?.footnotes) && model.footnotes.length ? (
        <p className="yds-pos-gauge__foot">{model.footnotes.join(" · ")}</p>
      ) : null}
    </div>
  )
}

/**
 * Full 180° band palette from engine score bands (thresholds unchanged).
 * @param {Array<{ min: number, max: number, color: string }>} bands
 */
function buildBandArcGradient(bands) {
  if (!bands.length) {
    return "conic-gradient(from 270deg at 50% 100%, #243656 0deg, #243656 180deg)"
  }
  const stops = []
  for (const band of bands) {
    const start = (Math.max(0, band.min) / 100) * 180
    const end = (Math.min(100, band.max) / 100) * 180
    stops.push(`${band.color} ${start}deg`, `${band.color} ${end}deg`)
  }
  return `conic-gradient(from 270deg at 50% 100%, ${stops.join(", ")})`
}
