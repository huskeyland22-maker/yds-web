/** YDS V1 Launch — 정적 콘텐츠 (엔진 미연동) */

import {
  YDS_BRAND_HERO_TITLE,
  YDS_CYCLE_TAGLINE,
  YDS_CYCLE_TAGLINE_SUB,
  YDS_STAGE_INTRO_LIST,
  YDS_STAGE_RAIL_LABELS,
} from "../content/ydsCyclePhilosophy.js"

export const FEEDBACK_EMAIL = "feedback@yds.app"

export const INTRO_SECTIONS = [
  {
    id: "what",
    title: "YDS란 무엇인가",
    body: "YDS는 공포·탐욕 지표를 YDS 총점(0–100) 하나로 읽고, 지금 어느 시장 사이클 구간인지와 그에 맞는 행동을 보여 주는 시장 사이클 투자 시스템입니다. 패닉지수 사이트가 아니라, 「지금 어디서 쌓고, 언제 실행할지」를 먼저 전달합니다.",
  },
  {
    id: "why",
    title: "왜 만들었는가",
    body: "위기 구간에서 정보는 많지만 행동은 어렵습니다. 과열과 공포를 같은 눈금으로 비교하고, 역사적 패턴과 조기경보를 함께 보여 주어 과잉 반응·방치·「패닉만 기다리기」를 줄이려는 목적입니다.",
  },
  {
    id: "philosophy",
    title: "시장 사이클 철학",
    body: `${YDS_CYCLE_TAGLINE} ${YDS_CYCLE_TAGLINE_SUB}`,
  },
  {
    id: "stages",
    title: "5단계 설명",
    body: YDS_STAGE_RAIL_LABELS,
    list: YDS_STAGE_INTRO_LIST,
  },
  {
    id: "position",
    title: "YDS 총점 설명",
    body: "YDS 총점은 0~100 척도입니다. 낮을수록 과열에 가깝고, 높을수록 공포·매집 기회에 가깝습니다. 실전 기회는 주로 🟡 준비·🟠 분할매수 구간에서 발생하며, 🔴 패닉매수(80+)는 드문 보너스 구간입니다.",
  },
]

export const START_GUIDE_STEPS = [
  {
    step: 1,
    title: "시장분석 보기",
    time: "약 1분",
    body: "첫 화면에서 현재 위치, 다음 단계, 오늘의 행동을 확인하세요. 3초 안에 방향을 잡을 수 있습니다.",
    path: "/market-analysis",
    cta: "시장분석 열기",
  },
  {
    step: 2,
    title: "종목추천 확인",
    time: "약 1분",
    body: "섹터·종목 순위를 확인한 뒤 관심종목과 실전매매 준비 상태를 관리합니다.",
    path: "/stock-picks",
    cta: "종목추천",
  },
  {
    step: 3,
    title: "AI 리포트 읽기",
    time: "약 30초",
    body: "오늘의 시장을 문장으로 요약한 일일 리포트입니다. 아침 루틴에 맞춰 읽기 좋습니다.",
    path: "/ai-daily-report",
    cta: "AI 리포트",
  },
  {
    step: 4,
    title: "알림 확인",
    time: "약 30초",
    body: "단계 변경·진입 신호·섹터 변화를 등급별 알림으로 저장합니다. 히스토리에서 놓친 신호를 복기할 수 있습니다.",
    path: "/alert-center",
    cta: "알림",
  },
]

export const FAQ_ITEMS = [
  {
    q: "왜 중립인데 주식 60%인가?",
    a: "「중립」은 패닉이 아니라는 뜻이지, 주식 비중 0%를 뜻하지 않습니다. 중립 구간은 시장을 관찰하며 종목을 찾되 추격 매수는 자제하라는 의미이며, 권장 비중은 역사적 패턴과 리스크 균형을 반영한 가이드입니다. 본인 상황에 맞게 조정하세요.",
  },
  {
    q: "조기경보란 무엇인가?",
    a: "PRI-A에 해당합니다. CNN·채권·변동성 등이 아직 충분히 반영되기 전, 위험이 올라오는 초기 신호입니다.",
  },
  {
    q: "충격감지란 무엇인가?",
    a: "PRI-B에 해당합니다. 시장이 이미 급변한 뒤 확인되는 충격 신호로, 조기경보보다 늦지만 강도가 큰 경우가 많습니다.",
  },
  {
    q: "리먼형이란 무엇인가?",
    a: "2008 금융위기에 가까운 위험 패턴 프로파일입니다. 유동성·신용 스트레스가 동시에 나타나는 유형으로 해석합니다.",
  },
  {
    q: "준비구간이란 무엇인가?",
    a: "YDS 40–59 구간입니다. 분할매수 전 매수 준비 단계로, 종목 발굴·현금 확보·소량 진입 검토를 권장합니다. 관심종목(Watchlist) 기능과는 별개의 시장 사이클 단계입니다.",
  },
  {
    q: "패닉매수란 무엇인가?",
    a: "YDS 5단계 중 가장 공포가 큰 보너스 구간(80+)입니다. 역사적으로 자주 오지 않으며, COVID급 극단도 분할매수(60–79)로 분류된 사례가 있습니다. 80+만을 기다리기보다 준비·분할매수에서 쌓고 실행하는 것이 YDS 철학입니다.",
  },
]

export const ABOUT_SECTIONS = [
  {
    title: "프로젝트 철학",
    body: `${YDS_BRAND_HERO_TITLE}. ${YDS_CYCLE_TAGLINE} YDS는 투자 조언 앱이 아니라, 시장 사이클 위치를 읽고 스스로 판단할 시간을 벌어 주는 도구입니다.`,
  },
  {
    title: "주의사항",
    body: "과거 패턴은 미래를 보장하지 않습니다. Paper Trading·백테스트는 검증용이며 실제 계좌와 다를 수 있습니다. 중요한 결정은 본인 책임 하에 추가 정보를 확인하세요.",
  },
  {
    title: "면책 조항",
    body: "본 서비스는 정보 제공 목적이며, 특정 종목·전략의 수익을 보장하지 않습니다. 투자 손실에 대한 법적 책임을 지지 않습니다. 서비스는 예고 없이 변경·중단될 수 있습니다.",
  },
]

export const LAUNCH_FOOTER_LINKS = [
  { label: "YDS 소개", path: "/intro" },
  { label: "시작하기", path: "/start" },
  { label: "FAQ", path: "/faq" },
  { label: "About", path: "/about" },
  { label: "피드백", path: "/feedback" },
  { label: "용어 설명", path: "/glossary" },
]

export const YDS_OG_DESCRIPTION =
  "준비구간에서 쌓고, 분할매수에서 실행한다. 패닉매수는 보너스다. Y'DS 시장 사이클 투자 시스템."
