/** Mirrors public/value-map.html curation & section inference (local fixed map). */

export const MAX_TOP_ITEMS = 5
export const MAX_HIDDEN_ITEMS = 4

export const PRIORITY_HIDDEN_BY_SECTOR = {
  "on-device-ai-robotics": ["에스피지", "고영", "뉴로메카", "에스비비테크"],
  "hbm-ai-semiconductor": ["HPSP", "테크윙", "피에스케이홀딩스", "에스티아이"],
  "power-grid-hvdc": ["제룡전기", "가온전선", "LS전선아시아", "누리플렉스"],
  defense: ["아이쓰리시스템", "제노코", "켄코아에어로스페이스", "퍼스텍"],
}

export const EXCLUDE_SMALLCAP = {
  루미르: true,
  에이테크솔루션: true,
  피에스텍: true,
}

export function curatedBySector(sector) {
  const top = (sector.top || []).slice(0, MAX_TOP_ITEMS)
  const hiddenSource = (sector.hidden || []).filter((item) => item && !EXCLUDE_SMALLCAP[item.name])
  const hidden = []
  const used = {}
  const priorityNames = PRIORITY_HIDDEN_BY_SECTOR[sector.id] || []
  for (const name of priorityNames) {
    if (hidden.length >= MAX_HIDDEN_ITEMS) break
    const found = hiddenSource.find((item) => item.name === name)
    if (found && !used[found.name]) {
      hidden.push(found)
      used[found.name] = true
    }
  }
  for (const item of hiddenSource) {
    if (hidden.length >= MAX_HIDDEN_ITEMS) break
    if (used[item.name]) continue
    hidden.push(item)
    used[item.name] = true
  }
  return { top, hidden, all: top.concat(hidden) }
}

export function inferSectionLabel(item, sector, index) {
  const tip = (item?.tip || "").toLowerCase()
  const name = (item?.name || "").toLowerCase()
  const text = `${tip} ${name}`

  const downstreamKeywords = ["플랫폼", "서비스", "유통", "완제품", "완성", "브랜드", "통합", "mro", "c4i", "생태계", "가전"]
  const upstreamKeywords = ["소재", "부품", "장비", "테스트", "기판", "센서", "피팅", "밸브", "전해질", "음극", "양극", "모듈"]
  const midstreamKeywords = ["제조", "생산", "주기기", "시스템", "엔진", "패키징", "설계", "파운드리", "셀", "cdmo", "파이프라인"]

  const hasKeyword = (list) => list.some((kw) => text.includes(kw))

  if (hasKeyword(upstreamKeywords)) return "부품단"
  if (hasKeyword(midstreamKeywords)) return "생산단"
  if (hasKeyword(downstreamKeywords)) return "수요단"

  if (Array.isArray(sector.sections) && sector.sections.length === 3) {
    if (index <= 2) return sector.sections[0]
    if (index <= 5) return sector.sections[1]
    return sector.sections[2]
  }

  return "생산단"
}

export function inferSubsectorLabel(item, sector, sectionLabel) {
  const tip = (item?.tip || "").toLowerCase()
  const text = `${tip} ${(item?.name || "").toLowerCase()}`
  const sectorId = sector?.id || ""

  if (sectorId === "hbm-ai-semiconductor") {
    if (text.includes("hbm") || text.includes("메모리")) return "메모리/HBM"
    if (text.includes("테스트") || text.includes("패키") || text.includes("소켓")) return "후공정·테스트"
    return "장비·소재"
  }
  if (sectorId === "solid-state-battery") {
    if (text.includes("셀") || text.includes("배터리")) return "셀·팩"
    if (text.includes("양극") || text.includes("음극") || text.includes("소재")) return "소재"
    return "장비·리사이클"
  }
  if (sectorId === "defense") {
    if (text.includes("전차") || text.includes("지상")) return "지상체계"
    if (text.includes("유도") || text.includes("레이다") || text.includes("c4i")) return "유도무기·전자전"
    return "항공·엔진"
  }
  if (sectorId === "nuclear-smr") {
    if (text.includes("smr")) return "SMR"
    if (text.includes("정비") || text.includes("밸브") || text.includes("계측")) return "기자재·정비"
    return "대형원전"
  }
  if (sectorId === "power-grid-hvdc") {
    if (text.includes("변압기") || text.includes("전력기기") || text.includes("배전")) return "변압기·전력기기"
    if (text.includes("hvdc") || text.includes("송전") || text.includes("그리드") || text.includes("자동화")) return "송전·HVDC"
    return "케이블·전력망"
  }
  if (sectorId === "biosimilar-cdmo") {
    if (text.includes("cdmo") || text.includes("cmo")) return "CDMO·CMO"
    if (text.includes("시밀러") || text.includes("유통")) return "상업화·유통"
    return "플랫폼·신약"
  }
  if (sectorId === "on-device-ai-robotics") {
    if (text.includes("감속기") || text.includes("센서") || text.includes("부품")) return "핵심구동부"
    if (text.includes("협동로봇") || text.includes("휴머노이드")) return "완성로봇"
    return "SI·응용"
  }
  if (sectorId === "aerospace") {
    if (text.includes("발사") || text.includes("엔진")) return "발사체·추진"
    if (text.includes("위성") || text.includes("안테나") || text.includes("탑재")) return "위성·탑재체"
    return "지상국·서비스"
  }
  if (sectorId === "shipbuilding-offshore") {
    if (text.includes("엔진") || text.includes("기자재") || text.includes("보냉")) return "엔진·기자재"
    if (text.includes("서비스") || text.includes("mro")) return "MRO·서비스"
    return "완성조선"
  }
  if (sectorId === "entertainment-kculture") {
    if (text.includes("플랫폼") || text.includes("팬덤") || text.includes("md")) return "팬플랫폼·MD"
    if (text.includes("제작") || text.includes("미디어") || text.includes("유통")) return "제작·유통"
    return "IP·아티스트"
  }
  if (sectorId === "autonomous-automotive") {
    if (text.includes("센서") || text.includes("칩") || text.includes("레이더")) return "센서·칩"
    if (text.includes("부품") || text.includes("모듈") || text.includes("mlcc")) return "전장부품"
    return "SDV·플랫폼"
  }
  if (sectorId === "ai-datacenter-infra") {
    if (text.includes("hbm") || text.includes("서버") || text.includes("스토리지")) return "서버·수요"
    if (text.includes("전력") || text.includes("배전") || text.includes("냉각") || text.includes("hvac")) return "전력·냉각"
    return "운영·부품"
  }
  if (sectorId === "power-semiconductor-electronics") {
    if (text.includes("ic") || text.includes("설계") || text.includes("반도체 생산")) return "칩 설계·생산"
    if (text.includes("장비") || text.includes("공정")) return "공정·장비"
    return "소재·부품"
  }

  return sectionLabel === "수요단" ? "서비스·수요" : sectionLabel === "부품단" ? "소재·부품" : "제조·통합"
}

const STAGE_ORDER = ["수요단", "생산단", "부품단"]

export function buildSectorTree(sector) {
  const allItems = curatedBySector(sector).all
  const tree = {}
  allItems.forEach((item, idx) => {
    const stage = inferSectionLabel(item, sector, idx)
    const subsector = inferSubsectorLabel(item, sector, stage)
    if (!tree[stage]) tree[stage] = {}
    if (!tree[stage][subsector]) tree[stage][subsector] = []
    tree[stage][subsector].push(item)
  })
  const stages = STAGE_ORDER.filter((s) => tree[s])
  return { tree, stages }
}

export function heatSortRank(heat) {
  const heatRank = { "VERY HOT": 0, HOT: 1, WARM: 2 }
  return Object.prototype.hasOwnProperty.call(heatRank, heat) ? heatRank[heat] : 99
}
