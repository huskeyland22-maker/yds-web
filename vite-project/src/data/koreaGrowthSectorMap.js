/**
 * 코리아 밸류체인 v2 — 8대 메인 섹터 · 원형 맵
 * @typedef {{ name: string; code: string; tip?: string }} KoreaStockRef
 * @typedef {{ sectorId: string; label: string }} SectorLinkRef
 * @typedef {{ id: string; label: string; stocks: KoreaStockRef[] }} KoreaSubChain
 * @typedef {{
 *   id: string
 *   icon: string
 *   name: string
 *   themes: string[]
 *   heat: "VERY HOT" | "HOT" | "WARM" | "COOL"
 *   marketTemperature: string
 *   interestLevel: string
 *   currentStage: string
 *   cyclePosition: string
 *   cyclePct: number
 *   beneficiaryReason: string
 *   stocks: KoreaStockRef[]
 *   subChains: KoreaSubChain[]
 *   relatedLinks: SectorLinkRef[]
 *   nodes: string[]
 *   cyclePhase: "initial" | "growth" | "overheat" | "slowdown" | "accumulation"
 * }} KoreaSectorCard
 * @typedef {{ id: string; label: string; sectorId: string; angleDeg: number }} RadialMapNode
 */

export const CYCLE_PHASES = [
  { id: "initial", label: "초기" },
  { id: "growth", label: "성장" },
  { id: "overheat", label: "과열" },
  { id: "slowdown", label: "둔화" },
  { id: "accumulation", label: "재축적" },
]

/** @type {Record<string, string>} */
export const SECTOR_ANCHOR_BY_ID = {
  "ai-semiconductor": "ai-semiconductor",
  "power-infra": "power-infra",
  "nuclear-energy": "nuclear-energy",
  "robot-automation": "robot-automation",
  "defense-space": "defense-space",
  shipbuilding: "shipbuilding",
  "bio-healthcare": "bio-healthcare",
  "battery-materials": "battery-materials",
}

/** @type {Record<string, number>} */
export const SECTOR_STAGGER_MS_BY_ID = {
  "ai-semiconductor": 0,
  "power-infra": 50,
  "nuclear-energy": 100,
  "robot-automation": 150,
  "defense-space": 200,
  shipbuilding: 250,
  "bio-healthcare": 300,
  "battery-materials": 350,
}

/** 8섹터 원형 배치 (0° = 상단, 시계방향) @type {RadialMapNode[]} */
export const KOREA_RADIAL_MAP_NODES = [
  { id: "n0", sectorId: "ai-semiconductor", label: "AI / 반도체", angleDeg: 0 },
  { id: "n1", sectorId: "power-infra", label: "전력 인프라", angleDeg: 45 },
  { id: "n2", sectorId: "nuclear-energy", label: "원전 / 에너지", angleDeg: 90 },
  { id: "n3", sectorId: "robot-automation", label: "로봇 / 자동화", angleDeg: 135 },
  { id: "n4", sectorId: "defense-space", label: "방산 / 우주", angleDeg: 180 },
  { id: "n5", sectorId: "shipbuilding", label: "조선", angleDeg: 225 },
  { id: "n6", sectorId: "bio-healthcare", label: "바이오 / 헬스케어", angleDeg: 270 },
  { id: "n7", sectorId: "battery-materials", label: "2차전지 / 소재", angleDeg: 315 },
]

/** @type {KoreaSectorCard[]} */
export const KOREA_GROWTH_SECTOR_MAP = [
  {
    id: "ai-semiconductor",
    icon: "🔬",
    name: "AI / 반도체",
    themes: ["메가트렌드", "순환매"],
    heat: "VERY HOT",
    marketTemperature: "고온",
    interestLevel: "매우 높음",
    currentStage: "HBM·DC CAPEX 동반 확대",
    cyclePosition: "상승 중기",
    cyclePhase: "growth",
    cyclePct: 78,
    nodes: ["GPU", "HBM", "파운드리", "장비", "DC"],
    beneficiaryReason:
      "AI 수요가 메모리·파운드리·인프라를 동시에 끌어올립니다. 국내 HBM·장비·SI 체인이 메가트렌드 핵심 수혜축입니다.",
    stocks: [
      { name: "SK하이닉스", code: "000660", tip: "HBM·메모리" },
      { name: "삼성전자", code: "005930", tip: "파운드리·메모리" },
      { name: "LG CNS", code: "064400", tip: "DC·클라우드" },
    ],
    subChains: [
      {
        id: "ai-dc",
        label: "AI 인프라 · DC",
        stocks: [
          { name: "LG CNS", code: "064400", tip: "DC·클라우드" },
          { name: "삼성SDS", code: "018260", tip: "IT·DC SI" },
          { name: "SK텔레콤", code: "017670", tip: "AI DC" },
        ],
      },
      {
        id: "hbm",
        label: "HBM · 메모리",
        stocks: [
          { name: "SK하이닉스", code: "000660", tip: "HBM" },
          { name: "삼성전자", code: "005930", tip: "메모리" },
        ],
      },
      {
        id: "semi-equip",
        label: "장비 · 소재",
        stocks: [
          { name: "한미반도체", code: "042700", tip: "TC본더" },
          { name: "리노공업", code: "058470", tip: "테스트 소켓" },
        ],
      },
    ],
    relatedLinks: [
      { sectorId: "power-infra", label: "전력 인프라" },
      { sectorId: "robot-automation", label: "로봇/자동화" },
    ],
  },
  {
    id: "power-infra",
    icon: "⚡",
    name: "전력 인프라",
    themes: ["산업 재편", "메가트렌드"],
    heat: "HOT",
    marketTemperature: "온난",
    interestLevel: "높음",
    currentStage: "그리드·AI 전력 수요 확대",
    cyclePosition: "상승 초기~중기",
    cyclePhase: "growth",
    cyclePct: 68,
    nodes: ["변압기", "송배전", "ESS", "전선", "구리"],
    beneficiaryReason:
      "AI·재생에너지·송전망 투자가 변압기·송배전·ESS·전선·구리 체인 전반의 수주를 견인합니다. 구리/전선은 전력 인프라 하위 축으로 통합 추적합니다.",
    stocks: [
      { name: "HD현대일렉트릭", code: "267260", tip: "초고압·변압기" },
      { name: "LS ELECTRIC", code: "010120", tip: "배전·스마트그리드" },
    ],
    subChains: [
      {
        id: "transformer",
        label: "변압기",
        stocks: [
          { name: "HD현대일렉트릭", code: "267260", tip: "초고압·변압기" },
          { name: "효성중공업", code: "298040", tip: "변압기" },
          { name: "일진전기", code: "103590", tip: "변압기·전선" },
        ],
      },
      {
        id: "grid",
        label: "송배전",
        stocks: [
          { name: "LS ELECTRIC", code: "010120", tip: "배전" },
          { name: "한전기술", code: "052690", tip: "송전·설계" },
        ],
      },
      {
        id: "ess",
        label: "ESS",
        stocks: [
          { name: "삼성SDI", code: "006400", tip: "ESS·배터리" },
          { name: "LG에너지솔루션", code: "373220", tip: "ESS" },
        ],
      },
      {
        id: "wire",
        label: "전선",
        stocks: [
          { name: "LS", code: "006260", tip: "전선·동" },
          { name: "대한전선", code: "001440", tip: "초고압 전선" },
          { name: "일진전기", code: "103590", tip: "전선" },
        ],
      },
      {
        id: "copper",
        label: "구리",
        stocks: [
          { name: "고려아연", code: "010130", tip: "비철·제련" },
          { name: "영풍", code: "000670", tip: "광업·비철" },
        ],
      },
    ],
    relatedLinks: [
      { sectorId: "ai-semiconductor", label: "AI/반도체" },
      { sectorId: "nuclear-energy", label: "원전/에너지" },
    ],
  },
  {
    id: "nuclear-energy",
    icon: "⚛️",
    name: "원전 / 에너지",
    themes: ["산업 재편", "메가트렌드"],
    heat: "HOT",
    marketTemperature: "온난",
    interestLevel: "높음",
    currentStage: "기저전력·SMR 논의",
    cyclePosition: "상승 초기",
    cyclePhase: "initial",
    cyclePct: 54,
    nodes: ["SMR", "기자재", "EPC", "수출"],
    beneficiaryReason:
      "탄소중립 한계 속 기저전력·원전 수출 재평가가 장기 테마입니다. 정책·안전 이슈에 따른 순환매 변동성은 유의합니다.",
    stocks: [
      { name: "두산에너빌리티", code: "034020", tip: "원전 주기기" },
      { name: "한전기술", code: "052690", tip: "EPC" },
    ],
    subChains: [
      {
        id: "smr",
        label: "SMR",
        stocks: [{ name: "두산에너빌리티", code: "034020", tip: "SMR·주기기" }],
      },
      {
        id: "nuclear-parts",
        label: "기자재",
        stocks: [
          { name: "우리기술", code: "032820", tip: "제어·계측" },
          { name: "비에이치아이", code: "083650", tip: "기자재" },
        ],
      },
      {
        id: "nuclear-export",
        label: "수출 · EPC",
        stocks: [{ name: "한전기술", code: "052690", tip: "설계·EPC" }],
      },
    ],
    relatedLinks: [{ sectorId: "power-infra", label: "전력 인프라" }],
  },
  {
    id: "robot-automation",
    icon: "🤖",
    name: "로봇 / 자동화",
    themes: ["메가트렌드", "순환매"],
    heat: "WARM",
    marketTemperature: "중립",
    interestLevel: "보통",
    currentStage: "자동화·협동로봇 기대",
    cyclePosition: "상승 초기",
    cyclePhase: "initial",
    cyclePct: 48,
    nodes: ["감속기", "협동로봇", "AI 로봇", "비전"],
    beneficiaryReason:
      "제조·물류 자동화와 AI 로봇 기대가 맞물리나 국내 실적 전환은 단계적입니다. 감속기·서보·비전·SI가 수혜층입니다.",
    stocks: [
      { name: "레인보우로보틱스", code: "277810", tip: "협동로봇" },
      { name: "두산로보틱스", code: "454910", tip: "산업·협동" },
    ],
    subChains: [
      {
        id: "reducer",
        label: "감속기",
        stocks: [{ name: "SBB테크", code: "060540", tip: "감속기" }],
      },
      {
        id: "cobot",
        label: "협동로봇",
        stocks: [
          { name: "레인보우로보틱스", code: "277810", tip: "협동로봇" },
          { name: "두산로보틱스", code: "454910", tip: "협동·산업" },
        ],
      },
      {
        id: "ai-robot",
        label: "AI 로봇",
        stocks: [{ name: "하이젠", code: "250060", tip: "로봇 SW" }],
      },
    ],
    relatedLinks: [{ sectorId: "ai-semiconductor", label: "AI/반도체" }],
  },
  {
    id: "defense-space",
    icon: "🛡️",
    name: "방산 / 우주",
    themes: ["메가트렌드", "순환매"],
    heat: "VERY HOT",
    marketTemperature: "고온",
    interestLevel: "매우 높음",
    currentStage: "수출·수주 모멘텀",
    cyclePosition: "상승 후기",
    cyclePhase: "overheat",
    cyclePct: 82,
    nodes: ["미사일", "항공", "우주", "위성"],
    beneficiaryReason:
      "지정학·수출 수주가 방산·우주 실적 가시성을 높입니다. 예산 사이클이 길어 조정 국면에서도 상대 강세가 나오기 쉵니다.",
    stocks: [
      { name: "한화에어로스페이스", code: "012450", tip: "방산·항공" },
      { name: "LIG넥스원", code: "079550", tip: "유도무기" },
    ],
    subChains: [
      {
        id: "defense",
        label: "방산",
        stocks: [
          { name: "한화에어로스페이스", code: "012450", tip: "방산" },
          { name: "LIG넥스원", code: "079550", tip: "미사일" },
          { name: "현대로템", code: "064350", tip: "차량·방산" },
        ],
      },
      {
        id: "space",
        label: "우주",
        stocks: [
          { name: "한국항공우주", code: "047810", tip: "항공·우주" },
          { name: "한화시스템", code: "272210", tip: "위성·방산전자" },
        ],
      },
    ],
    relatedLinks: [{ sectorId: "shipbuilding", label: "조선" }],
  },
  {
    id: "shipbuilding",
    icon: "🚢",
    name: "조선",
    themes: ["산업 재편", "메가트렌드"],
    heat: "HOT",
    marketTemperature: "온난",
    interestLevel: "높음",
    currentStage: "LNG·친환경선 수주",
    cyclePosition: "상승 중기",
    cyclePhase: "growth",
    cyclePct: 70,
    nodes: ["LNG선", "컨테이너", "해양플랜트", "친환경"],
    beneficiaryReason:
      "LNG·컨테이너선 수주 호황과 방산·해양 플랜트 연계가 실적 모멘텀을 만듭니다. 원자재·인력 사이클 변동은 유의합니다.",
    stocks: [
      { name: "HD한국조선해양", code: "009540", tip: "조선 지주" },
      { name: "한화오션", code: "042660", tip: "LNG선" },
    ],
    subChains: [
      {
        id: "lng",
        label: "LNG선",
        stocks: [
          { name: "한화오션", code: "042660", tip: "LNG선" },
          { name: "HD현대중공업", code: "329180", tip: "조선" },
        ],
      },
      {
        id: "green-ship",
        label: "친환경 · 해양",
        stocks: [{ name: "삼성중공업", code: "010140", tip: "조선·해양" }],
      },
    ],
    relatedLinks: [{ sectorId: "defense-space", label: "방산/우주" }],
  },
  {
    id: "bio-healthcare",
    icon: "🧬",
    name: "바이오 / 헬스케어",
    themes: ["메가트렌드", "순환매"],
    heat: "WARM",
    marketTemperature: "중립",
    interestLevel: "보통",
    currentStage: "바이오시밀러·CDMO",
    cyclePosition: "중기",
    cyclePhase: "growth",
    cyclePct: 52,
    nodes: ["바이오의약", "CDMO", "디지털헬스", "의료기기"],
    beneficiaryReason:
      "고령화·혁신신약·CDMO 수요가 구조 성장을 뒷받침합니다. 임상·규제 이슈에 따른 개별 종목 변동성이 큽니다.",
    stocks: [
      { name: "삼성바이오로직스", code: "207940", tip: "CDMO" },
      { name: "셀트리온", code: "068270", tip: "바이오시밀러" },
    ],
    subChains: [
      {
        id: "cdmo",
        label: "CDMO",
        stocks: [
          { name: "삼성바이오로직스", code: "207940", tip: "CDMO" },
          { name: "SK바이오팜", code: "326030", tip: "의약" },
        ],
      },
      {
        id: "bio-pharma",
        label: "바이오의약",
        stocks: [
          { name: "셀트리온", code: "068270", tip: "시밀러" },
          { name: "유한양행", code: "000100", tip: "제약" },
        ],
      },
    ],
    relatedLinks: [],
  },
  {
    id: "battery-materials",
    icon: "🔋",
    name: "2차전지 / 소재",
    themes: ["순환매", "산업 재편"],
    heat: "WARM",
    marketTemperature: "중립",
    interestLevel: "보통",
    currentStage: "소재·밸류에이션 재조정",
    cyclePosition: "둔화·재축적",
    cyclePhase: "slowdown",
    cyclePct: 42,
    nodes: ["양극재", "음극재", "LFP", "전고체"],
    beneficiaryReason:
      "전기화 장기 수요는 유효하나 공급 과잉·가격 경쟁으로 사이클 조정 국면입니다. 소재·장비 간 순환매가 뚜렷합니다.",
    stocks: [
      { name: "LG에너지솔루션", code: "373220", tip: "배터리" },
      { name: "포스코퓨처엠", code: "003670", tip: "양극재" },
    ],
    subChains: [
      {
        id: "cathode",
        label: "양극재",
        stocks: [
          { name: "포스코퓨처엠", code: "003670", tip: "양극재" },
          { name: "에코프로비엠", code: "247540", tip: "양극재" },
        ],
      },
      {
        id: "cell",
        label: "셀 · 모듈",
        stocks: [
          { name: "LG에너지솔루션", code: "373220", tip: "셀" },
          { name: "삼성SDI", code: "006400", tip: "배터리" },
        ],
      },
    ],
    relatedLinks: [{ sectorId: "power-infra", label: "전력 인프라" }],
  },
]

export const KOREA_MAP_THEMES = [
  { id: "restructure", label: "산업 재편", desc: "에너지·그리드·조선 등 국내 산업 구조 변화" },
  { id: "rotation", label: "순환매", desc: "섹터·테마 간 국내 자금 로테이션" },
  { id: "megatrend", label: "메가트렌드", desc: "AI·방산·자동화 등 구조 성장 수혜" },
]

/** 좌측 레이더 표시 라벨 @type {{ sectorId: string; label: string; shortLabel: string }[]} */
export const KOREA_RADAR_ITEMS = [
  { sectorId: "ai-semiconductor", label: "AI / 반도체", shortLabel: "AI" },
  { sectorId: "power-infra", label: "전력 인프라", shortLabel: "전력" },
  { sectorId: "nuclear-energy", label: "원전 / 에너지", shortLabel: "원전" },
  { sectorId: "robot-automation", label: "로봇 / 자동화", shortLabel: "로봇" },
  { sectorId: "defense-space", label: "방산 / 우주", shortLabel: "방산" },
  { sectorId: "shipbuilding", label: "조선", shortLabel: "조선" },
  { sectorId: "bio-healthcare", label: "바이오 / 헬스케어", shortLabel: "바이오" },
  { sectorId: "battery-materials", label: "2차전지 / 소재", shortLabel: "2차전지" },
]

/** @param {string} sectorId */
export function getKoreaSectorById(sectorId) {
  return KOREA_GROWTH_SECTOR_MAP.find((s) => s.id === sectorId) ?? null
}

