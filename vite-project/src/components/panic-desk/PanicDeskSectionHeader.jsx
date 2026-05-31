/**
 * 패닉 데스크 메인 섹션 헤더 (핵심지수 · 패닉지수 히스토리 · 실전매매존)
 * @param {{ icon: string; title: string; description?: string; tone?: "cyan" | "amber" | "green" | "sky"; compact?: boolean; tier?: "main" | "compact" }} props
 */
export default function PanicDeskSectionHeader({
  icon,
  title,
  description = "",
  tone = "cyan",
  compact = false,
  tier = compact ? "compact" : "main",
}) {
  const tierClass =
    tier === "main" ? "panic-desk-section-header--main" : "panic-desk-section-header--compact"

  return (
    <header
      className={[
        "panic-desk-section-header",
        `panic-desk-section-header--${tone}`,
        tierClass,
      ].join(" ")}
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
