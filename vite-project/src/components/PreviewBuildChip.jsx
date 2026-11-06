import { useEffect, useState } from "react"
import { BUILD_ID, VERSION_LABEL } from "../constants/build.js"
import {
  STABLE_PREVIEW_BOOKMARK_URL,
  isPreviewOpsToolsEnabled,
  isStablePreviewBookmarkHost,
  isVercelPreviewHost,
  shortCommitFromBuildId,
} from "../utils/previewDeployHost.js"
import { fetchLatestBuildMeta, readHtmlBuildId } from "../utils/pwaFreshness.js"

/**
 * Preview-only build fingerprint — compare running vs /build-version.json.
 * Hidden on Production (yds-web-kappa).
 */
export default function PreviewBuildChip() {
  const [open, setOpen] = useState(false)
  const [remoteId, setRemoteId] = useState(null)
  const [hostOk, setHostOk] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const host = window.location.hostname
    setHostOk(isVercelPreviewHost(host) || isPreviewOpsToolsEnabled())
  }, [])

  useEffect(() => {
    if (!hostOk || typeof window === "undefined") return
    let cancelled = false
    const pull = async () => {
      const meta = await fetchLatestBuildMeta().catch(() => null)
      if (!cancelled) setRemoteId(meta?.buildId != null ? String(meta.buildId) : null)
    }
    void pull()
    const id = window.setInterval(() => void pull(), 12_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [hostOk])

  if (!hostOk) return null

  const runCommit = shortCommitFromBuildId(BUILD_ID)
  const htmlCommit = shortCommitFromBuildId(readHtmlBuildId() || BUILD_ID)
  const remoteCommit = remoteId ? shortCommitFromBuildId(remoteId) : "…"
  const mismatch = Boolean(remoteId && String(remoteId) !== String(BUILD_ID))
  const onStableAlias =
    typeof window !== "undefined" && isStablePreviewBookmarkHost(window.location.hostname)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={[
          "fixed left-3 bottom-3 z-[9200] rounded-md border px-2 py-1 font-mono text-[10px] font-semibold shadow-lg",
          mismatch
            ? "border-amber-400/50 bg-amber-950/90 text-amber-100"
            : "border-sky-400/35 bg-slate-950/90 text-sky-100",
        ].join(" ")}
        title="Preview 빌드 정보"
      >
        PREV · {runCommit}
        {mismatch ? " · UPD" : ""}
      </button>
    )
  }

  return (
    <section className="fixed left-3 bottom-3 z-[9200] w-[min(92vw,280px)] rounded-lg border border-sky-500/30 bg-[#0a0d12]/96 p-2.5 text-[10px] text-slate-200 shadow-2xl">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="m-0 font-semibold text-sky-100">Preview 빌드</p>
        <button type="button" className="text-slate-400" onClick={() => setOpen(false)}>
          닫기
        </button>
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 font-mono">
        <dt className="text-slate-500">label</dt>
        <dd className="m-0 break-all">{VERSION_LABEL}</dd>
        <dt className="text-slate-500">run</dt>
        <dd className="m-0 break-all text-sky-100">{runCommit}</dd>
        <dt className="text-slate-500">html</dt>
        <dd className="m-0 break-all">{htmlCommit}</dd>
        <dt className="text-slate-500">remote</dt>
        <dd className={["m-0 break-all", mismatch ? "text-amber-200" : ""].filter(Boolean).join(" ")}>
          {remoteCommit}
        </dd>
      </dl>
      {mismatch ? (
        <p className="mt-2 m-0 text-[10px] leading-snug text-amber-100/90">
          배포 버전이 다릅니다. 잠시 후 자동 적용되거나 설정→개발자에서 강제 업데이트를 쓰세요.
        </p>
      ) : null}
      {!onStableAlias ? (
        <p className="mt-2 m-0 text-[10px] leading-snug text-slate-400">
          즐겨찾기는 고정 Preview 주소를 쓰세요:
          <br />
          <a className="text-sky-300 underline-offset-2 hover:underline" href={STABLE_PREVIEW_BOOKMARK_URL}>
            {STABLE_PREVIEW_BOOKMARK_URL}
          </a>
        </p>
      ) : (
        <p className="mt-2 m-0 text-[10px] text-slate-500">고정 Preview alias 접속 중</p>
      )}
    </section>
  )
}
