/**
 * @param {{
 *   debug: ReturnType<import("../../content/ydsStockPickPipelineDebug.js").computeStockPickPipelineDebug> & {
 *     displayUs?: number
 *     displayKr?: number
 *     favoritesOnly?: boolean
 *   }
 *   loading?: boolean
 * }} props
 */
export default function YdsStockPickDebugBox({ debug, loading = false }) {
  if (loading && debug.priceSuccessTotal === 0 && debug.scored === 0) {
    return (
      <div className="yds-spick-debug" role="status" aria-label="종목추천 파이프라인 디버그">
        <p className="yds-spick-debug__title">Pipeline Debug</p>
        <p className="yds-spick-debug__row">로딩 중…</p>
      </div>
    )
  }

  return (
    <div
      className={[
        "yds-spick-debug",
        debug.filtered === 0 ? "yds-spick-debug--alert" : "",
      ].join(" ")}
      role="status"
      aria-label="종목추천 파이프라인 디버그"
    >
      <p className="yds-spick-debug__title">Pipeline Debug</p>
      <dl className="yds-spick-debug__grid">
        <div>
          <dt>Raw US</dt>
          <dd className="font-mono tabular-nums">{debug.rawUs}</dd>
        </div>
        <div>
          <dt>Raw KR</dt>
          <dd className="font-mono tabular-nums">{debug.rawKr}</dd>
        </div>
        <div>
          <dt>Price US</dt>
          <dd className="font-mono tabular-nums">{debug.usPriceSuccess}</dd>
        </div>
        <div>
          <dt>Price KR</dt>
          <dd className="font-mono tabular-nums">{debug.krPriceSuccess}</dd>
        </div>
        <div>
          <dt>Scored</dt>
          <dd className="font-mono tabular-nums">{debug.scored}</dd>
        </div>
        <div>
          <dt>Filtered</dt>
          <dd className="font-mono tabular-nums">{debug.filtered}</dd>
        </div>
        {debug.displayUs != null ? (
          <div>
            <dt>Display US</dt>
            <dd className="font-mono tabular-nums">{debug.displayUs}</dd>
          </div>
        ) : null}
        {debug.displayKr != null ? (
          <div>
            <dt>Display KR</dt>
            <dd className="font-mono tabular-nums">{debug.displayKr}</dd>
          </div>
        ) : null}
        <div>
          <dt>KR Batch</dt>
          <dd className="font-mono tabular-nums">{debug.krBatchMode ? "on" : "off"}</dd>
        </div>
        <div>
          <dt>Fetch Err</dt>
          <dd className="font-mono tabular-nums">{debug.fetchErrors}</dd>
        </div>
        <div>
          <dt>Fallback</dt>
          <dd className="font-mono tabular-nums">{debug.fallbackAfterScore}</dd>
        </div>
      </dl>
      {debug.favoritesOnly ? (
        <p className="yds-spick-debug__note">관심종목 필터 활성</p>
      ) : null}
      {debug.filtered === 0 ? (
        <p className="yds-spick-debug__warn">
          Filtered=0 → Price Success 단계 또는 live 필터에서 제외됨
        </p>
      ) : null}
    </div>
  )
}
