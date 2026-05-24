/**
 * 패닉 데스크 메인 섹션 헤더 (핵심지수 · 시장엔진 · 실전매매존)
 * @param {{ icon: string; title: string; description?: string; tone?: "cyan" | "amber" | "green" }} props
 */
export default function PanicDeskSectionHeader({
  icon,
  title,
  description = "",
  tone = "cyan",
}) {
  return (
    <header
      className={["panic-desk-section-header", `panic-desk-section-header--${tone}`].join(" ")}
    >
      <p className="m-0 panic-desk-section-header__title">
        <span className="panic-desk-section-header__icon" aria-hidden>
          {icon}
        </span>
        {title}
      </p>
      {description ? <p className="m-0 panic-desk-section-header__desc">{description}</p> : null}
    </header>
  )
}
