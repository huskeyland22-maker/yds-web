import { LEVERAGE_ADJUSTMENT_UNIVERSE } from "../content/leverageAdjustmentUniverse.js"

const PLACEHOLDER = "—"
const STATUS_WAITING = "대기"
const CRITERIA_PENDING = "기준 준비 중"

const METRIC_LABELS = ["현재가", "RSI", "Stoch", "BB %B", "MA20 Gap", "조건"]

export default function LeverageAdjustmentPage() {
  return (
    <div className="yds-dbb min-w-0 w-full">
      <header className="yds-dbb__hero">
        <p className="yds-dbb__kicker">LEVERAGE</p>
        <h1 className="yds-dbb__title">레버리지 조정매매</h1>
        <p className="yds-dbb__lead">레버리지 ETF 화면입니다. 매수·매도 기준은 아직 정하지 않았습니다.</p>
      </header>

      <section className="flex flex-col gap-2" aria-label="레버리지 유니버스">
        {LEVERAGE_ADJUSTMENT_UNIVERSE.map((item) => (
          <article key={item.symbol} className="yds-dbb-card" data-symbol={item.symbol}>
            <div className="yds-dbb-card__head">
              <h2 className="yds-dbb-card__ticker">{item.symbol}</h2>
              <p className="yds-dbb-card__theme">{item.leverage}X</p>
            </div>
            <p className="yds-dbb-card__theme">{item.theme}</p>
            <dl className="yds-dbb-cand__metrics">
              {METRIC_LABELS.map((label) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{PLACEHOLDER}</dd>
                </div>
              ))}
              <div>
                <dt>상태</dt>
                <dd>{STATUS_WAITING}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>

      <section className="yds-dbb-card mt-3" aria-label="매수">
        <h2 className="yds-dbb-section__title">매수</h2>
        <p className="yds-dbb__status">{CRITERIA_PENDING}</p>
      </section>
      <section className="yds-dbb-card mt-2" aria-label="매도">
        <h2 className="yds-dbb-section__title">매도</h2>
        <p className="yds-dbb__status">{CRITERIA_PENDING}</p>
      </section>
    </div>
  )
}
