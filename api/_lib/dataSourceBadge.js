/**
 * 데이터 소스·세션 배지 (UI 표시용).
 */

/**
 * @param {{ dataSource: string; sessionBadgeKey?: string; domesticClose?: object }} opts
 */
export function resolveDataSourceBadge({ dataSource, sessionBadgeKey, domesticClose }) {
  if (dataSource === "yahoo") {
    return { dataSourceBadge: "Yahoo Finance", dataSourceBadgeKey: "yahoo" }
  }

  if (dataSource !== "kis") {
    return { dataSourceBadge: "—", dataSourceBadgeKey: "unknown" }
  }

  const dc = domesticClose || {}
  if (sessionBadgeKey === "intraday") {
    return { dataSourceBadge: "KIS 실시간", dataSourceBadgeKey: "kis_live" }
  }
  if (sessionBadgeKey === "pending" || dc.dataStale) {
    return { dataSourceBadge: "KIS 동기화 중", dataSourceBadgeKey: "kis_pending" }
  }
  if (sessionBadgeKey === "regular_close" || dc.confirmReady) {
    return { dataSourceBadge: "KRX 정규장 종가", dataSourceBadgeKey: "krx_close" }
  }
  return { dataSourceBadge: "KIS", dataSourceBadgeKey: "kis" }
}
