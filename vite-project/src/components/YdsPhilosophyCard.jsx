export default function YdsPhilosophyCard() {
  const stages = [
    "🔵 과열",
    "🟢 중립",
    "🟡 관심",
    "🟠 분할매수",
    "🔴 패닉매수",
  ]
  return (
    <section className="yds-philosophy-card trading-card-shell panic-v2-section" aria-label="YDS 철학">
      <p className="m-0 yds-philosophy-card__title">YDS 철학</p>
      <p className="m-0 yds-philosophy-card__stages">{stages.join(" · ")}</p>
      <p className="m-0 yds-philosophy-card__quote">공포를 피하는 것이 아니라 공포에서 기회를 찾는다.</p>
    </section>
  )
}
