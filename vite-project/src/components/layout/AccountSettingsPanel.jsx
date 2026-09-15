/**
 * 계정 설정 — 로그인/로그아웃 (시장 지표 입력과 분리)
 */

/**
 * @param {{
 *   open: boolean
 *   onClose: () => void
 *   user: import("firebase/auth").User | null
 *   onLogin: () => void | Promise<void>
 *   onLogout: () => void | Promise<void>
 * }} props
 */
export default function AccountSettingsPanel({ open, onClose, user, onLogin, onLogout }) {
  if (!open) return null

  return (
    <>
      <button
        type="button"
        aria-label="계정 설정 닫기"
        className="fixed inset-0 z-[9998] bg-slate-950/55 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="yds-account-settings-title"
        className="fixed left-1/2 top-1/2 z-[9999] w-[min(92vw,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/[0.1] bg-[#0c1018] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 id="yds-account-settings-title" className="m-0 text-[15px] font-semibold text-slate-50">
              계정 설정
            </h2>
            <p className="m-0 mt-1 text-[11px] leading-snug text-slate-500">
              Google 로그인으로 포트폴리오 동기화 등 계정 기능을 이용합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/[0.08] text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-100"
          >
            ×
          </button>
        </div>

        {user ? (
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-3">
            <div className="flex items-center gap-3">
              <img
                src={user.photoURL || "https://placehold.co/72x72/0f172a/e2e8f0?text=U"}
                alt=""
                className="h-10 w-10 rounded-full border border-white/15 object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-[13px] font-semibold text-slate-100">
                  {user.displayName || user.email || "로그인 유저"}
                </p>
                {user.email ? (
                  <p className="m-0 mt-0.5 truncate text-[11px] text-slate-500">{user.email}</p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void onLogout()}
              className="mt-3 w-full rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] font-medium text-rose-100 transition hover:bg-rose-500/18"
            >
              로그아웃
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-3">
            <p className="m-0 text-[12px] leading-snug text-slate-400">
              로그인하면 기기 간 포트폴리오 동기화 등을 사용할 수 있습니다.
            </p>
            <button
              type="button"
              onClick={() => void onLogin()}
              className="mt-3 w-full rounded-lg border border-sky-500/35 bg-sky-500/15 px-3 py-2.5 text-[13px] font-semibold text-sky-100 transition hover:bg-sky-500/22"
            >
              Google로 로그인
            </button>
          </div>
        )}
      </div>
    </>
  )
}
