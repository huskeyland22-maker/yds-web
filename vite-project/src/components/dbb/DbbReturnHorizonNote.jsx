export const DBB_RETURN_HORIZON_NOTE =
  "수익률 평가 기준: 매수 후 20·60·120거래일의 수익률을 비교하며, 60거래일을 핵심 평가 기간으로 삼습니다."

export default function DbbReturnHorizonNote() {
  return <p className="yds-dbb-card__hint">{DBB_RETURN_HORIZON_NOTE}</p>
}
