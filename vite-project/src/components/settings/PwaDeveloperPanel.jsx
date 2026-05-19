import { useCallback, useEffect, useState } from "react"
import { BUILD_ID, VERSION_LABEL } from "../../constants/build.js"
import {
  fetchLatestBuildMeta,
  forcePwaCacheClear,
  forcePwaUpdate,
  formatCacheBytes,
  getLastBuildSyncAt,
  getLocalBuildId,
  getServiceWorkerDebugInfo,
  readHtmlBuildId,
} from "../../utils/pwaFreshness.js"

function formatSyncAt(ms) {
  if (!ms) return "(없음)"
  try {
    return new Date(ms).toLocaleString("ko-KR", { hour12: false })
  } catch {
    return String(ms)
  }
}

function swVersionLabel(swInfo) {
  if (!swInfo) return "…"
  const url = swInfo.active || swInfo.controlling || swInfo.waiting || swInfo.installing
  if (!url) return "미등록"
  try {
    const u = new URL(url, window.location.origin)
    return u.pathname.split("/").pop() || url
  } catch {
    return url.slice(-24)
  }
}

/**
 * 설정(모바일 드로어) > 개발자 — PWA·빌드 진단.
 */
export default function PwaDeveloperPanel() {
  const [open, setOpen] = useState(false)
  const [swInfo, setSwInfo] = useState(null)
  const [remoteBuildId, setRemoteBuildId] = useState(null)
  const [busy, setBusy] = useState(null)
  const [lastSyncAt, setLastSyncAt] = useState(() => getLastBuildSyncAt())

  const refresh = useCallback(async () => {
    const [info, meta] = await Promise.all([getServiceWorkerDebugInfo(), fetchLatestBuildMeta().catch(() => null)])
    setSwInfo(info)
    setRemoteBuildId(meta?.buildId != null ? String(meta.buildId) : null)
    setLastSyncAt(getLastBuildSyncAt())
  }, [])

  useEffect(() => {
    if (!open) return
    void refresh()
    const onSync = () => setLastSyncAt(getLastBuildSyncAt())
    window.addEventListener("yds:build-version-synced", onSync)
    const id = window.setInterval(() => void refresh(), 8000)
    return () => {
      window.removeEventListener("yds:build-version-synced", onSync)
      window.clearInterval(id)
    }
  }, [open, refresh])

  const onClearCache = async () => {
    if (busy) return
    setBusy("clear")
    try {
      await forcePwaCacheClear()
      window.location.reload()
    } finally {
      setBusy(null)
    }
  }

  const onForceUpdate = async () => {
    if (busy) return
    setBusy("update")
    try {
      await forcePwaUpdate()
    } finally {
      setBusy(null)
    }
  }

  const localBuild = getLocalBuildId() || BUILD_ID
  const htmlBuild = readHtmlBuildId() || "(none)"

  return (
    <div className="mt-2 border-t border-white/[0.06] pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[12px] font-medium text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
      >
        <span>개발자</span>
        <span className="text-[10px] text-slate-600">{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <div className="mx-1 mb-1 rounded-md border border-white/[0.06] bg-black/25 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-slate-400">
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
            <dt>build</dt>
            <dd className="m-0 break-all text-slate-200">{VERSION_LABEL}</dd>
            <dt>bundle id</dt>
            <dd className="m-0 break-all text-amber-100/90">{BUILD_ID}</dd>
            <dt>local id</dt>
            <dd className="m-0 break-all">{localBuild}</dd>
            <dt>html id</dt>
            <dd className="m-0 break-all">{htmlBuild}</dd>
            <dt>remote id</dt>
            <dd className="m-0 break-all">{remoteBuildId ?? "…"}</dd>
            <dt>sw</dt>
            <dd className="m-0 break-all">{swVersionLabel(swInfo)}</dd>
            <dt>cache</dt>
            <dd className="m-0">{swInfo ? formatCacheBytes(swInfo.cacheBytes) : "…"}</dd>
            <dt>last sync</dt>
            <dd className="m-0">{formatSyncAt(lastSyncAt)}</dd>
          </dl>
          <div className="mt-2 flex flex-col gap-1.5">
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void onClearCache()}
              className="rounded border border-white/15 px-2 py-1.5 text-[11px] text-slate-300 disabled:opacity-50"
            >
              {busy === "clear" ? "캐시 삭제 중…" : "캐시 비우기"}
            </button>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void onForceUpdate()}
              className="rounded border border-sky-500/30 bg-sky-500/10 px-2 py-1.5 text-[11px] text-sky-200 disabled:opacity-50"
            >
              {busy === "update" ? "갱신 중…" : "강제 업데이트"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
