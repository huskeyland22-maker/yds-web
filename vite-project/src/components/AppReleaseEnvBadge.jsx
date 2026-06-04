import { resolveAppReleaseChannel, releaseChannelTone } from "../utils/appReleaseChannel.js"

export default function AppReleaseEnvBadge({ className = "" }) {
  const channel = resolveAppReleaseChannel()
  const tone = releaseChannelTone(channel)

  return (
    <span
      className={["app-release-env-badge", `app-release-env-badge--${tone}`, className]
        .filter(Boolean)
        .join(" ")}
      title={
        channel === "DEV"
          ? "로컬 개발 모드"
          : channel === "RC"
            ? "Release Candidate — 검증 후 배포"
            : "Production"
      }
    >
      {channel}
    </span>
  )
}
