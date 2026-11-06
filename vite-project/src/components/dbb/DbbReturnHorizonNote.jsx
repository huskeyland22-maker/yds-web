export const DBB_RETURN_HORIZON_NOTE =
  "과거 매수 신호의 성과를 분석해 전략의 유효성을 검토합니다."

export default function DbbReturnHorizonNote() {
  return <p className="yds-dbb-card__hint">{DBB_RETURN_HORIZON_NOTE}</p>
}
