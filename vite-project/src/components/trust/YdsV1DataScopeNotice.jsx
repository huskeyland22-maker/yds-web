/** V1 데이터 범위 안내 — 실시간 연동 없음을 명시 (엔진 미변경) */
export default function YdsV1DataScopeNotice({ compact = false }) {
  return (
    <p
      className={`yds-data-scope${compact ? " yds-data-scope--compact" : ""}`}
      role="note"
    >
      V1 종목·관심종목 점수는 <strong>전략 기반</strong>입니다. 실시간 시세·RSI·거래량 API는 연동하지
      않습니다.{" "}
      <a href="/glossary#stock-radar">산식 설명</a>
    </p>
  )
}
