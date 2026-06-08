import { usePortfolioReview } from "../../hooks/usePortfolioReview.js"

const FIELDS = [
  { key: "overheating", label: "과열권 대응", placeholder: "과열 구간에서 취한 행동" },
  { key: "panic", label: "패닉 대응", placeholder: "패닉 구간에서 취한 행동" },
  { key: "mistakes", label: "실수", placeholder: "되돌아보고 싶은 판단" },
  { key: "lessons", label: "배운 점", placeholder: "다음에 적용할 원칙" },
]

export default function YdsPortfolioReviewSection() {
  const { review, updateReview } = usePortfolioReview()

  return (
    <section className="yds-portfolio__section yds-portfolio-v2__section" aria-labelledby="pf-review">
      <h2 id="pf-review" className="yds-portfolio__section-title">
        4 · 투자 복기
      </h2>

      <div className="yds-portfolio-v2__review-grid">
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

      <p className="yds-portfolio-v2__review-note">로컬 저장 · 포트폴리오와 함께 관리</p>
    </section>
  )
}
