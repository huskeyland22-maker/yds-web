/**
 * 코리아 밸류체인 — AI 병목·산업 재편·순환매·원자재·성장섹터 맵
 * @typedef {{ name: string; code?: string; ticker?: string; tip?: string }} MapStockRef
 * @typedef {{
 *   id: string
 *   icon: string
 *   name: string
 *   themes: string[]
 *   heat: "VERY HOT" | "HOT" | "WARM" | "COOL"
 *   currentStage: string
 *   cyclePosition: string
 *   cyclePct: number
 *   beneficiaryReason: string
 *   korea: MapStockRef[]
 *   us: MapStockRef[]
 * }} GrowthSectorCard
 */

/** @type {GrowthSectorCard[]} */
export const KOREA_GROWTH_SECTOR_MAP = [
  {
    id: "ai-infra",
    icon: "🖥️",
    name: "AI 인프라",
    themes: ["AI 병목", "산업 재편"],
    heat: "VERY HOT",
    currentStage: "CAPEX 확대 · 수주 가속",
    cyclePosition: "상승 중기",
    cyclePct: 72,
    beneficiaryReason:
      "GPU·가속기 수요와 데이터센터 증설이 맞물리며 전력·냉각·네트워크 투자가 동반 확대되는 구간입니다. 한국은 장비·부품·시공 체인으로 간접 수혜가 큽니다.",
    korea: [
      { name: "삼성전자", code: "005930", tip: "메모리·파운드리" },
      { name: "SK스퀘어", code: "402340", tip: "AI 투자 포트폴리오" },
      { name: "LG CNS", code: "064400", tip: "DC·클라우드 SI" },
    ],
    us: [
      { name: "NVIDIA", ticker: "NVDA", tip: "AI 가속기" },
      { name: "Broadcom", ticker: "AVGO", tip: "네트워크·커스텀칩" },
      { name: "Super Micro", ticker: "SMCI", tip: "AI 서버" },
    ],
  },
  {
    id: "semiconductor",
    icon: "🔬",
    name: "반도체",
    themes: ["AI 병목", "성장섹터"],
    heat: "VERY HOT",
    currentStage: "HBM·첨단패키징 집중",
    cyclePosition: "상승 중기",
    cyclePct: 78,
    beneficiaryReason:
      "AI 메모리(HBM)와 CoWoS 등 첨단 패키징이 병목이며, 장비·소재 국산화율 상승이 순환매를 견인합니다. 메모리 업황 회복 시 베타가 확대됩니다.",
    korea: [
      { name: "SK하이닉스", code: "000660", tip: "HBM 1위" },
      { name: "삼성전자", code: "005930", tip: "파운드리·메모리" },
      { name: "한미반도체", code: "042700", tip: "TC본더" },
    ],
    us: [
      { name: "AMD", ticker: "AMD", tip: "GPU·CPU" },
      { name: "Applied Materials", ticker: "AMAT", tip: "장비" },
      { name: "ASML", ticker: "ASML", tip: "EUV" },
    ],
  },
  {
    id: "power",
    icon: "⚡",
    name: "전력",
    themes: ["산업 재편", "원자재"],
    heat: "HOT",
    currentStage: "송배전 투자 확대",
    cyclePosition: "상승 초기",
    cyclePct: 58,
    beneficiaryReason:
      "AI·전기화 수요로 기저전력·재생·송전망 투자가 늘며, 전력 SOFC·ESS·스마트그리드 관련주가 정책·CAPEX 사이클에 연동됩니다.",
    korea: [
      { name: "한전기술", code: "052690", tip: "송전·설계" },
      { name: "HD현대일렉트릭", code: "267260", tip: "전력기기" },
      { name: "LS ELECTRIC", code: "010120", tip: "배전·자동화" },
    ],
    us: [
      { name: "NextEra Energy", ticker: "NEE", tip: "재생·유틸" },
      { name: "Quanta Services", ticker: "PWR", tip: "그리드 시공" },
      { name: "Eaton", ticker: "ETN", tip: "전력기기" },
    ],
  },
  {
    id: "transformer",
    icon: "🔌",
    name: "변압기",
    themes: ["AI 병목", "순환매"],
    heat: "HOT",
    currentStage: "수주잔고·가동률 상승",
    cyclePosition: "상승 중기",
    cyclePct: 65,
    beneficiaryReason:
      "데이터센터·재생에너지 연계 변압기·개폐기 수요가 구조적으로 늘고, 해외 수출·현지화 정책으로 한국 전력기기 업체 마진이 개선되는 국면입니다.",
    korea: [
      { name: "HD현대일렉트릭", code: "267260", tip: "초고압 변압기" },
      { name: "일진전기", code: "103590", tip: "전선·변압기" },
      { name: "효성중공업", code: "298040", tip: "변압기·케이블" },
    ],
    us: [
      { name: "Hubbell", ticker: "HUBB", tip: "전력기기" },
      { name: "Eaton", ticker: "ETN", tip: "배전·변압" },
      { name: "Vertiv", ticker: "VRT", tip: "DC 전력" },
    ],
  },
  {
    id: "nuclear",
    icon: "⚛️",
    name: "원전",
    themes: ["산업 재편", "성장섹터"],
    heat: "HOT",
    currentStage: "신규·연장 수주 논의",
    cyclePosition: "상승 초기",
    cyclePct: 52,
    beneficiaryReason:
      "탄소중립 한계로 기저전력 재평가가 진행되며, 원전 수출·부품·정비 체인이 장기 CAPEX 사이클에 편승합니다. SMR 테마는 중장기 옵션입니다.",
    korea: [
      { name: "두산에너빌리티", code: "034020", tip: "원전 주기기" },
      { name: "한전기술", code: "052690", tip: "설계·EPC" },
      { name: "우리기술", code: "032820", tip: "제어·계측" },
    ],
    us: [
      { name: "Constellation Energy", ticker: "CEG", tip: "원전 운영" },
      { name: "GE Vernova", ticker: "GEV", tip: "터빈·그리드" },
      { name: "Cameco", ticker: "CCJ", tip: "우라늄" },
    ],
  },
  {
    id: "copper",
    icon: "🟤",
    name: "구리",
    themes: ["원자재", "순환매"],
    heat: "WARM",
    currentStage: "가격 고점권 · 변동성",
    cyclePosition: "중기 · 과열 경계",
    cyclePct: 48,
    beneficiaryReason:
      "전기화·그리드·AI 인프라가 구리 수요를 끌어올리나, 중국 경기·재고 사이클에 민감합니다. 광산·제련·전선 체인 순환매가 반복됩니다.",
    korea: [
      { name: "LS", code: "006260", tip: "전선·동" },
      { name: "고려아연", code: "010130", tip: "비철·제련" },
      { name: "영풍", code: "000670", tip: "광업·비철" },
    ],
    us: [
      { name: "Freeport-McMoRan", ticker: "FCX", tip: "구리 광산" },
      { name: "Southern Copper", ticker: "SCCO", tip: "제련" },
      { name: "Teck Resources", ticker: "TECK", tip: "광산·석탄" },
    ],
  },
  {
    id: "robot",
    icon: "🤖",
    name: "로봇",
    themes: ["성장섹터", "산업 재편"],
    heat: "WARM",
    currentStage: "자동화·휴머노이드 기대",
    cyclePosition: "상승 초기",
    cyclePct: 44,
    beneficiaryReason:
      "제조·물류 자동화와 AI 로봇 기대가 맞물리나, 실적 전환은 단계적입니다. 감속기·서보·비전·SI 국내 체인이 테마 순환의 수혜층입니다.",
    korea: [
      { name: "레인보우로보틱스", code: "277810", tip: "협동로봇" },
      { name: "두산로보틱스", code: "454910", tip: "협동·산업" },
      { name: "하이젠", code: "250060", tip: "로봇 SW" },
    ],
    us: [
      { name: "Intuitive Surgical", ticker: "ISRG", tip: "의료 로봇" },
      { name: "Rockwell Automation", ticker: "ROK", tip: "산업 자동화" },
      { name: "Teradyne", ticker: "TER", tip: "협동로봇 지분" },
    ],
  },
  {
    id: "defense",
    icon: "🛡️",
    name: "방산",
    themes: ["성장섹터", "순환매"],
    heat: "VERY HOT",
    currentStage: "수출·수주 모멘텀",
    cyclePosition: "상승 후기",
    cyclePct: 82,
    beneficiaryReason:
      "지정학 리스크와 폴란드·중동 등 수출 수주가 실적 가시성을 높입니다. 방산은 정책·예산 사이클이 길어 조정 시에도 상대 강세가 나오기 쉽습니다.",
    korea: [
      { name: "한화에어로스페이스", code: "012450", tip: "방산·항공" },
      { name: "현대로템", code: "064350", tip: "전차·차량" },
      { name: "LIG넥스원", code: "079550", tip: "유도무기" },
    ],
    us: [
      { name: "Lockheed Martin", ticker: "LMT", tip: "방산" },
      { name: "RTX", ticker: "RTX", tip: "미사일·항공" },
      { name: "General Dynamics", ticker: "GD", tip: "지상·함정" },
    ],
  },
  {
    id: "datacenter",
    icon: "🏢",
    name: "데이터센터",
    themes: ["AI 병목", "성장섹터"],
    heat: "VERY HOT",
    currentStage: "증설·전력·냉각 동반",
    cyclePosition: "상승 중기",
    cyclePct: 75,
    beneficiaryReason:
      "AI 학습·추론 워크로드로 하이퍼스케일 CAPEX가 지속되며, 전력·냉각·부동산·시공·네트워크 밸류체인이 동시에 수혜를 받는 구조입니다.",
    korea: [
      { name: "SK텔레콤", code: "017670", tip: "AI DC·클라우드" },
      { name: "KT", code: "030200", tip: "IDC·네트워크" },
      { name: "LG CNS", code: "064400", tip: "DC 구축" },
    ],
    us: [
      { name: "Equinix", ticker: "EQIX", tip: "코로케이션" },
      { name: "Digital Realty", ticker: "DLR", tip: "리츠·DC" },
      { name: "Vertiv", ticker: "VRT", tip: "전력·냉각" },
    ],
  },
]

/** @type {{ id: string; label: string; desc: string }[]} */
export const GROWTH_MAP_THEMES = [
  { id: "bottleneck", label: "AI 병목", desc: "HBM·전력·냉각·DC 병목 수혜" },
  { id: "restructure", label: "산업 재편", desc: "에너지·그리드·원전 재편" },
  { id: "rotation", label: "순환매", desc: "섹터·테마 간 자금 로테이션" },
  { id: "commodity", label: "원자재", desc: "구리·에너지 원자재 사이클" },
  { id: "growth", label: "성장섹터", desc: "구조 성장 테마 맵" },
]
