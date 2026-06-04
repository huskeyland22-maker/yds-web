import { YDS_V1_RC_LABEL, YDS_V1_VERSION } from "../../utils/ydsTerminology.js"

/**
 * @param {{ compact?: boolean }} props
 */
export default function YdsV1ReleaseBadge({ compact = false }) {
  return (
    <span className={`yds-v1-rc-badge${compact ? " yds-v1-rc-badge--compact" : ""}`} title="YDS V1 Release Candidate">
      {YDS_V1_VERSION}
      {!compact ? <span className="yds-v1-rc-badge__rc">{YDS_V1_RC_LABEL}</span> : null}
    </span>
  )
}
