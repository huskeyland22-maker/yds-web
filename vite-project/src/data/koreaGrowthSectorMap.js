/**
 * 코리아 밸류체인 v1 — 국내 산업 전용 (글로벌은 globalMegatrendMap.js 예정)
 * @typedef {{ name: string; code: string; tip?: string }} KoreaStockRef
 * @typedef {{ sectorId: string; label: string }} SectorLinkRef
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
 *   relatedLinks: SectorLinkRef[]
 *   nodes: string[]
 *   cyclePhase: "initial" | "growth" | "overheat" | "slowdown" | "accumulation"
 * }} KoreaSectorCard
 * @typedef {{ id: string; label: string; shortLabel?: string; sectorId: string; row: "top" | "bottom"; col: number }} CompressedMapNode
 */

/** @type {{ id: string; label: string }[]} */
export const CYCLE_PHASES = [
  { id: "initial", label: "초기" },
  { id: "growth", label: "성장" },
  { id: "overheat", label: "과열" },
  { id: "slowdown", label: "둔화" },
  { id: "accumulation", label: "재축적" },
]

/**
 * 압축 산업맵 레이아웃 (기본 노출)
 * @type {CompressedMapNode[]}
 */
export const KOREA_COMPRESSED_MAP_NODES = [
  { id: "ai-infra", label: "AI 인프라", sectorId: "ai-infra", row: "top", col: 0 },
  { id: "semiconductor", label: "반도체", sectorId: "semiconductor", row: "top", col: 1 },
  { id: "power", label: "전력", shortLabel: "전력", sectorId: "power-grid", row: "top", col: 2 },
  { id: "nuclear", label: "원전", sectorId: "nuclear", row: "top", col: 3 },
  { id: "copper", label: "구리", sectorId: "copper-wire", row: "bottom", col: 0 },
  { id: "wire", label: "전선", sectorId: "copper-wire", row: "bottom", col: 1 },
  { id: "robot", label: "로봇", sectorId: "robot-automation", row: "bottom", col: 2 },
  { id: "defense", label: "방산", sectorId: "defense", row: "bottom", col: 3 },
]

/** @type {KoreaSectorCard[]} */
export const KOREA_GROWTH_SECTOR_MAP = [
  {
    id: "ai-infra",
    icon: "🖥️",
    name: "AI 인프라",
    themes: ["메가트렌드", "산업 재편"],
    heat: "VERY HOT",
    marketTemperature: "고온",
    interestLevel: "매우 높음",
    currentStage: "DC·네트워크 CAPEX 확대",
    cyclePosition: "상승 중기",
    cyclePhase: "growth",
    cyclePct: 74,
    nodes: ["GPU", "데이터센터", "전력", "냉각", "네트워크"],
    beneficiaryReason:
      "국내 SI·전력·냉각·통신 인프라 업체가 AI 데이터센터 증설 수주에 연동됩니다. 반도체·전력 체인과 동반 상승하는 메가트렌드 축입니다.",
    stocks: [
      { name: "LG CNS", code: "064400", tip: "DC·클라우드 구축" },
      { name: "삼성SDS", code: "018260", tip: "IT·DC SI" },
      { name: "SK텔레콤", code: "017670", tip: "AI DC·네트워크" },
      { name: "KT", code: "030200", tip: "IDC·망 인프라" },
    ],
    relatedLinks: [
      { sectorId: "semiconductor", label: "반도체" },
      { sectorId: "power-grid", label: "전력/변압기" },
    ],
  },
  {
    id: "semiconductor",
    icon: "🔬",
    name: "반도체",
    themes: ["메가트렌드", "순환매"],
    heat: "VERY HOT",
    marketTemperature: "고온",
    interestLevel: "매우 높음",
    currentStage: "HBM·첨단패키징 집중",
    cyclePosition: "상승 중기",
    cyclePhase: "growth",
    cyclePct: 80,
    nodes: ["HBM", "파운드리", "장비", "소재"],
    beneficiaryReason:
      "AI 메모리와 OSAT 병목이 국내 장비·소재·파운드리 밸류체인에 집중됩니다. 메모리 업황·수출 규제 이슈에 따른 순환매 변동성은 유의합니다.",
    stocks: [
      { name: "SK하이닉스", code: "000660", tip: "HBM·메모리" },
      { name: "삼성전자", code: "005930", tip: "파운드리·메모리" },
      { name: "한미반도체", code: "042700", tip: "TC본더" },
      { name: "리노공업", code: "058470", tip: "테스트 소켓" },
    ],
    relatedLinks: [
      { sectorId: "ai-infra", label: "AI 인프라" },
      { sectorId: "robot-automation", label: "로봇/자동화" },
    ],
  },
  {
    id: "power-grid",
    icon: "⚡",
    name: "전력 / 변압기",
    themes: ["산업 재편", "메가트렌드"],
    heat: "HOT",
    marketTemperature: "온난",
    interestLevel: "높음",
    currentStage: "송배전·변압기 수주 확대",
    cyclePosition: "상승 초기~중기",
    cyclePhase: "growth",
    cyclePct: 66,
    nodes: ["초고압", "송배전", "ESS", "변압기"],
    beneficiaryReason:
      "AI 전력 수요와 재생·송전망 투자가 맞물리며 변압기·개폐기·전선 수주잔고가 개선되는 국면입니다. 정책·해외 수출 모멘텀이 실적 가시성을 좌우합니다.",
    stocks: [
      { name: "HD현대일렉트릭", code: "267260", tip: "초고압·변압기" },
      { name: "일진전기", code: "103590", tip: "전선·변압기" },
      { name: "효성중공업", code: "298040", tip: "변압기·케이블" },
      { name: "LS ELECTRIC", code: "010120", tip: "배전·스마트그리드" },
      { name: "한전기술", code: "052690", tip: "송전·설계" },
    ],
    relatedLinks: [
      { sectorId: "ai-infra", label: "AI 인프라" },
      { sectorId: "copper-wire", label: "구리/전선" },
      { sectorId: "nuclear", label: "원전" },
    ],
  },
  {
    id: "nuclear",
    icon: "⚛️",
    name: "원전",
    themes: ["산업 재편", "메가트렌드"],
    heat: "HOT",
    marketTemperature: "온난",
    interestLevel: "높음",
    currentStage: "기저전력·수출 논의",
    cyclePosition: "상승 초기",
    cyclePhase: "initial",
    cyclePct: 54,
    nodes: ["SMR", "기자재", "수출"],
    beneficiaryReason:
      "탄소중립 한계 속 기저전력 재평가와 원전 수출·정비 CAPEX가 장기 테마로 부각됩니다. 정책·안전 이슈에 따른 순환매 특성이 큽니다.",
    stocks: [
      { name: "두산에너빌리티", code: "034020", tip: "원전 주기기" },
      { name: "한전기술", code: "052690", tip: "설계·EPC" },
      { name: "우리기술", code: "032820", tip: "제어·계측" },
      { name: "비에이치아이", code: "083650", tip: "원전 기자재" },
    ],
    relatedLinks: [
      { sectorId: "power-grid", label: "전력/변압기" },
    ],
  },
  {
    id: "copper-wire",
    icon: "🟤",
    name: "구리 / 전선",
    themes: ["순환매", "산업 재편"],
    heat: "WARM",
    marketTemperature: "중립",
    interestLevel: "보통",
    currentStage: "구리 가격·재고 변동",
    cyclePosition: "중기 · 과열 경계",
    cyclePhase: "overheat",
    cyclePct: 50,
    nodes: ["구리", "전선", "광산"],
    beneficiaryReason:
      "전기화·그리드·AI 인프라가 동·전선 수요를 끌어올리나 LME·중국 경기에 민감합니다. 광업·제련·전선 체인 순환매가 반복되는 원자재 축입니다.",
    stocks: [
      { name: "LS", code: "006260", tip: "전선·동" },
      { name: "대한전선", code: "001440", tip: "초고압 전선" },
      { name: "고려아연", code: "010130", tip: "비철·제련" },
      { name: "영풍", code: "000670", tip: "광업·비철" },
    ],
    relatedLinks: [
      { sectorId: "power-grid", label: "전력/변압기" },
    ],
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
    cyclePct: 46,
    nodes: ["감속기", "협동로봇", "AI 로봇"],
    beneficiaryReason:
      "제조·물류 자동화와 AI 로봇 기대가 맞물리나 국내 실적 전환은 단계적입니다. 감속기·서보·비전·SI 체인이 테마 순환의 수혜층입니다.",
    stocks: [
      { name: "레인보우로보틱스", code: "277810", tip: "협동로봇" },
      { name: "두산로보틱스", code: "454910", tip: "협동·산업" },
      { name: "하이젠", code: "250060", tip: "로봇 SW" },
      { name: "삼성전자", code: "005930", tip: "스마트팩토리 연계" },
    ],
    relatedLinks: [
      { sectorId: "semiconductor", label: "반도체" },
    ],
  },
  {
    id: "defense",
    icon: "🛡️",
    name: "방산",
    themes: ["메가트렌드", "순환매"],
    heat: "VERY HOT",
    marketTemperature: "고온",
    interestLevel: "매우 높음",
    currentStage: "수출·수주 모멘텀",
    cyclePosition: "상승 후기",
    cyclePhase: "overheat",
    cyclePct: 84,
    nodes: ["미사일", "조선", "우주"],
    beneficiaryReason:
      "지정학·NATO·중동 수출 수주가 국내 방산 실적 가시성을 높입니다. 예산·정책 사이클이 길어 조정 국면에서도 상대 강세가 나오기 쉬운 독립 축입니다.",
    stocks: [
      { name: "한화에어로스페이스", code: "012450", tip: "방산·항공" },
      { name: "현대로템", code: "064350", tip: "전차·차량" },
      { name: "LIG넥스원", code: "079550", tip: "유도무기" },
      { name: "한국항공우주", code: "047810", tip: "항공·방산" },
    ],
    relatedLinks: [],
  },
]

/** @type {{ id: string; label: string; desc: string }[]} */
export const KOREA_MAP_THEMES = [
  { id: "restructure", label: "산업 재편", desc: "에너지·그리드·원전 등 국내 산업 구조 변화" },
  { id: "rotation", label: "순환매", desc: "섹터·테마 간 국내 자금 로테이션" },
  { id: "megatrend", label: "메가트렌드", desc: "AI·방산·자동화 등 구조 성장 수혜" },
]

