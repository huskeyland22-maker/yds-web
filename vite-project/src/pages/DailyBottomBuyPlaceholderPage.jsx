/**
 * 일상 저점매수 — 플레이스홀더 (본체 미구현)
 */
export default function DailyBottomBuyPlaceholderPage() {
  return (
    <div className="yds-daily-bottom-placeholder min-w-0 w-full px-3 py-8 sm:px-4">
      <header className="mb-4">
        <p className="m-0 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
          DAILY BOTTOM BUY
        </p>
        <h1 className="m-0 mt-1 text-xl font-semibold tracking-tight text-slate-100">
          일상 저점매수
        </h1>
      </header>
      <p className="m-0 max-w-md text-sm leading-relaxed text-slate-400">
        준비 중인 화면입니다. 하단 네비게이션과 라우팅만 연결되어 있으며, 투자 로직·본문은
        이후 단계에서 구현합니다.
      </p>
    </div>
  )
}
