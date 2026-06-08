import { usePortfolioReview } from "../../hooks/usePortfolioReview.js"

const FIELDS = [
  { key: "mistakes", label: "실수", placeholder: "되돌아보고 싶은 판단" },
  { key: "lessons", label: "배운 점", placeholder: "다음에 적용할 원칙" },
  { key: "nextAction", label: "다음 행동", placeholder: "이번 주 실행할 한 가지" },
]

export default function YdsPortfolioReviewSection() {
  const { review, updateReview } = usePortfolioReview()

  return (
    <section className="yds-portfolio__section yds-portfolio-v2__section" aria-labelledby="pf-review">
      <h2 id="pf-review" className="yds-portfolio__section-title">
        4 · 투자 복기
      </h2>

      <div className="yds-portfolio-v3__review-grid">
        {FIELDS.map((field) => (
          <label key={field.key} className="yds-portfolio-v2__review-field">
            <span>{field.label}</span>
            <textarea
              rows={3}
              value={review[field.key]}
              onChange={(e) => updateReview({ [field.key]: e.target.value })}
              placeholder={field.placeholder}
            />
          </label>
        ))}
      </div>

      <p className="yds-portfolio-v3__review-future">
        종목별 복기(매수 이유·배운 점·다음 행동)는 각 보유 종목 카드에서 입력할 수 있습니다.
      </p>
      <p className="yds-portfolio-v2__review-note">로컬 저장</p>
    </section>
  )
}
