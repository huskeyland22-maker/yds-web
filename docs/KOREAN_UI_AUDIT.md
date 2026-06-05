# KOREAN UI Audit

> 점검일: 2026-06-03 · 스프린트: **Korean UX Naming** · 범위: UI 표시명만 (엔진 key·산식·PRI-A/B 유지)

## 요약

V1 6코어 메뉴·페이지·버튼·Radar 용어를 **한글 중심**으로 통일. 중앙 라벨 `ydsUiLabels.js` + `ydsTerminology.js` TERM_REPLACE 확장.

---

## 변경 목록

### 메인 메뉴 (`appNavItems.js` · `MobileBottomNav.jsx`)

| 이전 | 변경 |
|------|------|
| 시장분석 | 📊 시장분석 |
| Watchlist | ⭐ 관심종목 |
| 알림 | 🔔 알림 |
| AI 리포트 | 🤖 AI 리포트 |
| 성과 | 📈 성과 |
| Research | 🧪 연구실 |

모바일 단축: 📊 시장 · ⭐ 관심 · 🔔 알림 · 🤖 AI · 📈 성과 · 🧪 연구

### 페이지 제목

| 이전 | 변경 | 파일 |
|------|------|------|
| Watchlist | 관심종목 | WatchlistCenterPage, ydsWatchlistCenterEngine |
| Alert Center | 알림 | AlertCenterPage, ydsAlertCenterEngine |
| Performance Center | 성과 | PerformanceCenterPage |
| Research | 연구실 | PanicIndexValidationPage |
| Stock Radar | 종목 추천 | Phase26 label, Research, glossary |
| Sector Radar | 추천 섹터 | Phase25 label, ValidationPhaseAccordion |
| Entry Radar | 진입 신호 | Phase27 label, empty states |

### 카드·점수 Breakdown (`ydsStockRadarExplain.js` — 기존 한글 유지)

| 이전 | 변경 |
|------|------|
| Market Fit | 시장 적합도 |
| Sector Strength | 섹터 강도 |
| Technical Trend | 기술적 추세 |
| Volume | 거래량 점수 |

### 패턴·국면·신뢰도

| 이전 | 변경 |
|------|------|
| Pattern | 위험 패턴 |
| Regime | 시장 국면 |
| Confidence | 신뢰도 (ConfidenceBadge) |
| Risk Pattern | 🏦 리먼형 (시스템 위기) 등 — Hub **항상 노출** + 설명문 |

### 버튼 문구 (`UI_BTN`)

| 키 | 문구 |
|----|------|
| detail | 상세 보기 |
| whyRecommend | 왜 추천? |
| whyWatch | 왜 관찰? |
| whyAlert | 왜 알림? |
| performance | 성과 보기 |
| watchlist | 관심종목 보기 |

---

## 신규 파일

- `vite-project/src/utils/ydsUiLabels.js` — NAV, PAGE, RADAR, BTN, `applyUiTermDisplay()`

---

## 잔존 영어 (의도적 · V1.1)

| 항목 | 위치 | 사유 |
|------|------|------|
| YDS V1 | 배지·푸터 | 브랜드 |
| PRI-A / PRI-B | 조기경보·충격감지 tooltip | 내부 지표명 (glossary 연결) |
| Paper Trading | 성과·연구실 | 업계 관용어 |
| OPEN / CLOSED | Paper 포지션 | 상태 key |
| Profit Factor | 성과센터 | 금융 용어 |
| CNN / VIX / MOVE | 패턴 기여 지표 | 데이터 소스명 |
| FAQ / About | Launch footer | 고유명사 |
| Portfolio Builder 등 | Research Phase subtitle | 연구실 내부 Phase (비코어) |
| `PRECURSOR_ENGINE_PHASE*_LABEL` | 엔진 export | dev/Research 메타 (표시 최소) |
| 파일·함수명 WatchlistCenterPage 등 | 코드 | route `/watchlist` 유지 |

---

## 추가 개선 권장 (V1.1)

1. Research Phase subtitle 전면 한글 (Portfolio Builder → 포트폴리오 빌더)
2. `applyUiTermDisplay()`를 footnotes·AI notes에 일괄 적용
3. Launch footer `About` → `소개`
4. Paper Trading → 「가상 매매」 병기
5. 연구실 `Performance Dashboard` Phase30 → 「성과 대시보드」

---

## 검증

- [x] 6코어 nav emoji + 한글
- [x] Hub pattern 설명 항상 노출
- [x] glossary `stock-radar` → 종목 추천 점수
- [x] 엔진 id/key/route 미변경
- [ ] prod smoke (배포 후)

---

## 관련

- [YDS_SOFT_LAUNCH_PACKAGE.md](./YDS_SOFT_LAUNCH_PACKAGE.md)
- `vite-project/src/utils/ydsTerminology.js`
