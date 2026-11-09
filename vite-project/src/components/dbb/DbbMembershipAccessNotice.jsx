/**
 * Audience CTA only (login vs PRO upgrade). Does not change analysis data visibility.
 * @param {{
 *   cta: { kind: "login" | "upgrade", title: string, body: string } | null | undefined
 * }} props
 */
export default function DbbMembershipAccessNotice({ cta }) {
  if (!cta) return null
  return (
    <aside className="yds-dbb-card yds-dbb-access-notice mb-3" role="status" data-cta-kind={cta.kind}>
      <h2 className="yds-dbb-section__title">{cta.title}</h2>
      <p className="yds-dbb__meta mt-1.5">{cta.body}</p>
    </aside>
  )
}
