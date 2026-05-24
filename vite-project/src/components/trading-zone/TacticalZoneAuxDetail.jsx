/**
 * 보조지표 클릭 시 펼침 상세
 */

/**
 * @param {{
 *   detail: {
 *     title: string
 *     headline: string
 *     lines: { text: string }[]
 *   } | null
 * }} props
 */
export default function TacticalZoneAuxDetail({ detail }) {
  if (!detail) return null

  return (
    <div className="tactical-zone-aux-detail" role="region" aria-label={`${detail.title} 상세`}>
      <p className="m-0 tactical-zone-aux-detail__headline">{detail.headline}</p>
      <ul className="m-0 list-none p-0 tactical-zone-aux-detail__lines">
        {detail.lines.map((line) => (
          <li key={line.text} className="tactical-zone-aux-detail__line">
            {line.text}
          </li>
        ))}
      </ul>
    </div>
  )
}
