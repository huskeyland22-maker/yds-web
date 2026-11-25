/**
 * PRO 사이드바 IA — 최종 5대메뉴.
 * 실운영 페이지로 직결한다. 중간 허브 카드는 사용하지 않는다.
 */

/** @typedef {{ id: string, label: string, path: string, note?: string }} ShellNavLink */
/** @typedef {{
 *   id: string
 *   label: string
 *   path: string
 *   alias?: boolean
 *   emphasis?: boolean
 *   englishLabel?: string
 *   matchPaths?: string[]
 * }} ShellNavItem */

/** @typedef {{
 *   id: string
 *   label: string
 *   items: ShellNavItem[]
 * }} ShellNavSection */

/**
 * @typedef {{
 *   id: string
 *   label: string
 *   kind: 'link' | 'tree' | 'accordion'
 *   path?: string
 *   matchPaths?: string[]
 *   emphasis?: boolean
 *   englishLabel?: string
 *   statusLabel?: string
 *   sections?: ShellNavSection[]
 *   items?: ShellNavItem[]
 * }} ShellNavMain
 */

/** @type {Record<string, { id: string, path: string, title: string, subtitle: string, links: ShellNavLink[], notice?: string }>} */
export const SHELL_NAV_HUBS = {
  "market-briefing": {
    id: "market-briefing",
    path: "/market-briefing",
    title: "YDS 인사이트",
    subtitle: "YDS INSIGHT · 시장 상황과 투자 판단을 한눈에 확인합니다.",
    links: [
      { id: "market-analysis", label: "시장 위험 분석", path: "/market-analysis" },
      {
        id: "macro",
        label: "매크로·유동성",
        path: "/macro-risk",
        note: "시장 분석의 채권·유동성 구간으로 이동합니다.",
      },
      { id: "market-report", label: "시장 리포트", path: "/ai-daily-report" },
    ],
  },
  "buy-strategy": {
    id: "buy-strategy",
    path: "/buy-strategy",
    title: "매수 전략",
    subtitle: "조정 매수·ETF·개별 종목·레버리지 전략을 모았습니다.",
    links: [
      { id: "daily-buy", label: "조정 매수", path: "/daily-bottom-buy" },
      {
        id: "etf-buy",
        label: "ETF 조정 매수",
        path: "/daily-bottom-buy",
        note: "ETF 조정매매는 조정 매수 화면에서 이어서 사용합니다.",
      },
      { id: "equity-buy", label: "개별 종목 조정 매수", path: "/equity-daily-bottom-buy" },
      { id: "leverage", label: "레버리지 조정매매", path: "/leverage-adjustment" },
      { id: "journal", label: "실전 매매일지", path: "/operating-journal" },
    ],
  },
  "panic-fear-buy": {
    id: "panic-fear-buy",
    path: "/panic-fear-buy",
    title: "패닉·공포 매수",
    subtitle: "패닉지수와 공포 기반 매수 전략. AI 입력은 VIX · CNN Fear & Greed · Put/Call만 사용합니다.",
    notice:
      "HY·BBB 스프레드는 패닉 데이터와 섞지 않습니다. 신용 위험은 신용 사이클에서 별도로 다룹니다. BofA는 패닉 AI 입력에서 제외됩니다.",
    links: [
      {
        id: "panic-index",
        label: "패닉지수 · 시장 위험",
        path: "/market-analysis",
        note: "VIX · CNN Fear & Greed · Put/Call Ratio 기준",
      },
      { id: "panic-lab", label: "패닉 연구실", path: "/panic-lab" },
    ],
  },
  "strategy-validation": {
    id: "strategy-validation",
    path: "/strategy-validation",
    title: "전략 검증",
    subtitle: "백테스트와 과거 신호 성과를 검증합니다.",
    links: [
      { id: "backtest", label: "전략 백테스트", path: "/performance-validation/backtest" },
      { id: "track-record", label: "과거 신호 성과", path: "/performance-validation/track-record" },
      { id: "perf-home", label: "성과검증 홈", path: "/performance-validation" },
      { id: "perf-dashboard", label: "AI 성과 대시보드", path: "/performance-validation/dashboard" },
    ],
  },
  "ai-insight": {
    id: "ai-insight",
    path: "/ai-insight",
    title: "AI 투자 인사이트",
    subtitle: "AI 해석과 투자 리포트로 이동합니다.",
    links: [
      { id: "ai-insight-main", label: "AI 투자 인사이트", path: "/ai-daily-report" },
      { id: "ai-report", label: "AI 투자 리포트", path: "/ai-daily-report" },
    ],
  },
}

/** @type {ShellNavMain[]} */
export const SHELL_NAV_MAIN = [
  {
    id: "market-briefing",
    label: "YDS 인사이트",
    englishLabel: "YDS INSIGHT",
    kind: "link",
    path: "/",
    emphasis: true,
    matchPaths: ["/", "/market-briefing"],
  },
  {
    id: "credit-cycle",
    label: "신용 사이클",
    kind: "link",
    path: "/credit-cycle",
    emphasis: true,
    matchPaths: ["/credit-cycle"],
  },
  {
    id: "adjustment-strategy",
    label: "조정 매수 전략",
    kind: "accordion",
    sections: [
      {
        id: "long-term-buy",
        label: "장기 조정 매수",
        items: [
          {
            id: "etf-buy",
            label: "ETF 조정 매수",
            path: "/daily-bottom-buy",
            emphasis: true,
            matchPaths: ["/daily-bottom-buy"],
          },
          {
            id: "equity-buy",
            label: "개별 종목 조정 매수",
            path: "/equity-daily-bottom-buy",
            emphasis: true,
            matchPaths: ["/equity-daily-bottom-buy"],
          },
          {
            id: "leverage",
            label: "레버리지 조정 매수",
            path: "/leverage-adjustment",
            matchPaths: ["/leverage-adjustment"],
          },
        ],
      },
      {
        id: "panic-fear-buy",
        label: "패닉·공포 매수",
        items: [
          {
            id: "panic-index",
            label: "패닉지수 분석",
            path: "/market-analysis",
            emphasis: true,
            matchPaths: ["/market-analysis", "/panic-fear-buy"],
          },
          {
            id: "fear-buy-strategy",
            label: "공포 구간 매수 전략",
            path: "/market-analysis",
            alias: true,
          },
          {
            id: "panic-lab",
            label: "패닉 연구실",
            path: "/panic-lab",
            matchPaths: ["/panic-lab"],
          },
        ],
      },
    ],
  },
  {
    id: "research",
    label: "리서치",
    kind: "tree",
    items: [
      {
        id: "strategy-validation",
        label: "전략 검증",
        path: "/strategy-validation",
        emphasis: true,
        matchPaths: [
          "/strategy-validation",
          "/performance-validation",
          "/performance-validation/backtest",
          "/performance-validation/track-record",
          "/performance-validation/dashboard",
          "/performance-validation/picks",
        ],
      },
      {
        id: "lab",
        label: "연구실",
        path: "/lab",
        matchPaths: ["/lab", "/panic-validation"],
      },
    ],
  },
  {
    id: "more",
    label: "기타 기능",
    kind: "accordion",
    items: [
      { id: "portfolio", label: "포트폴리오", path: "/portfolio" },
      { id: "stock-search", label: "종목 검색", path: "/stock-picks" },
      { id: "watchlist", label: "관심 종목", path: "/watchlist" },
      { id: "journal", label: "실전 매매일지", path: "/operating-journal" },
      { id: "performance-center", label: "성과센터", path: "/performance-center" },
      { id: "dbb-prospective", label: "DBB 전향적 검증", path: "/dbb-prospective-v12" },
      {
        id: "ai-insight",
        label: "AI 투자 인사이트",
        path: "/ai-insight",
        matchPaths: ["/ai-insight", "/ai-daily-report"],
      },
      { id: "playbook", label: "투자 원칙", path: "/investment-playbook" },
      { id: "calendar", label: "투자 캘린더", path: "/investment-calendar" },
      { id: "alerts", label: "알림", path: "/alert-center" },
      { id: "value-chain", label: "가치사슬", path: "/value-chain" },
      { id: "start", label: "시작하기", path: "/start" },
      { id: "about", label: "About", path: "/about" },
      { id: "glossary", label: "용어 설명", path: "/glossary" },
      { id: "intro", label: "YDS 소개", path: "/intro" },
      { id: "faq", label: "FAQ", path: "/faq" },
      { id: "feedback", label: "피드백", path: "/feedback" },
    ],
  },
]

/** @deprecated 호환 — 기존 그룹 형태가 필요하면 MAIN에서 유도 */
export const SHELL_NAV_GROUPS = SHELL_NAV_MAIN.filter((entry) => entry.kind === "tree" || entry.kind === "link").map(
  (entry) => ({
    id: entry.id,
    kicker: entry.label,
    items:
      entry.kind === "link"
        ? [
            {
              id: entry.id,
              label: entry.label,
              path: entry.path,
              emphasis: entry.emphasis,
              matchPaths: entry.matchPaths,
            },
          ]
        : entry.items ?? [],
  }),
)

/** @deprecated 호환 — 기타 기능 항목 */
export const SHELL_NAV_MORE = SHELL_NAV_MAIN.find((entry) => entry.id === "more")?.items ?? []

export const SHELL_NAV_FOOTER = [
  { id: "intro", label: "YDS 소개", path: "/intro" },
  { id: "faq", label: "FAQ", path: "/faq" },
  { id: "feedback", label: "피드백", path: "/feedback" },
]

/**
 * @param {ShellNavItem | ShellNavMain} item
 * @param {{ pathname: string, hash?: string }} location
 */
function pathMatchesLocation(path, pathname) {
  if (!path) return false
  if (path === "/") return pathname === "/"
  return pathname === path || pathname.startsWith(`${path}/`)
}

export function shellNavItemIsActive(item, location) {
  if (!item || item.alias) return false
  const pathname = String(location?.pathname ?? "")

  // YDS 인사이트(/)와 패닉지수 분석(/market-analysis)은 경로를 분리한다.
  if (pathMatchesLocation(item.path, pathname)) return true

  if (!Array.isArray(item.matchPaths) || !item.matchPaths.length) {
    return false
  }

  return item.matchPaths.some((path) => pathMatchesLocation(path, pathname))
}

/** @param {ShellNavMain} main */
export function shellNavMainCollectPaths(main) {
  /** @type {string[]} */
  const paths = []
  if (main.path) paths.push(main.path)
  if (Array.isArray(main.matchPaths)) paths.push(...main.matchPaths)
  for (const item of main.items ?? []) {
    if (item.path) paths.push(item.path)
    if (Array.isArray(item.matchPaths)) paths.push(...item.matchPaths)
  }
  for (const section of main.sections ?? []) {
    for (const item of section.items ?? []) {
      if (item.path) paths.push(item.path)
      if (Array.isArray(item.matchPaths)) paths.push(...item.matchPaths)
    }
  }
  return [...new Set(paths.filter(Boolean))]
}

/** @param {ShellNavMain} main @param {{ pathname: string }} location */
export function shellNavMainContainsPath(main, location) {
  const pathname = String(location?.pathname ?? "")
  return shellNavMainCollectPaths(main).some((path) => pathMatchesLocation(path, pathname))
}

/** @param {string} hubId */
export function getShellNavHub(hubId) {
  return SHELL_NAV_HUBS[hubId] ?? null
}

/** @param {string} pathname */
export function getShellNavHubByPath(pathname) {
  const path = String(pathname ?? "")
  return Object.values(SHELL_NAV_HUBS).find((hub) => hub.path === path) ?? null
}
