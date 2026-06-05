# YDS Mobile UX Optimization

> 기준 뷰포트: 320 · 375 · 390 · 430px · 정보 밀도 유지 · 전체 확대 금지

## 이번 적용 (코드)

| 항목 | 내용 |
|------|------|
| Summary V2 | 2×2 → 4열 metrics (390px+) · 컴팩트 리스트 |
| Journey strip | `min-height: 2rem` 터치 타겟 |
| Why 버튼 | 430px 이하 min 1.75rem |
| 본문 | `max(0.68rem, 11px)` 하한 (430px) |
| 종목명 | ellipsis · grid 레이아웃 |

---

## 개선 리스트 · 우선순위

### 상 (V1 출시 전)

| # | 이슈 | 320px | 조치 |
|---|------|-------|------|
| M1 | Hub Stock 카드 3장 → 스크롤 과다 | ✅ | Summary 컴팩트 + 상세 접기 |
| M2 | CORE 링크 6개 줄바꿈 | ⚠️ | 375px에서 2행 — strip으로 대체 |
| M3 | Why 패널 viewport 밖 | ⚠️ | 기존 430px CSS 유지 |
| M4 | Watchlist 카드 높이 | ⚠️ | explain 접기 검토 (다음) |
| M5 | Alert 히스토리 길이 | ⚠️ | 30일 필터 기본값 |

### 중

| # | 이슈 | 조치 |
|---|------|------|
| M6 | 0.58rem kicker 가독성 | Summary key → 11px floor |
| M7 | Stock pick breakdown 2열 좁음 | 320px 1열 fallback (선택) |
| M8 | perf-center 헤더 링크 2개 | flex-wrap |
| M9 | Research 아코디언 중첩 스크롤 | 카테고리 default collapsed |
| M10 | PWA safe-area bottom nav | 기존 env(safe-area) 유지 |

### 하

| # | 이슈 |
|---|------|
| M11 | Journey strip 가로 스크롤 snap |
| M12 | Watchlist hash scroll + highlight ring |
| M13 | Alert grade chip 320px 2행 |
| M14 | Glossary dl padding |
| M15 | Lab Phase accordion title truncate |

---

## 뷰포트별 체크리스트

|  | 320 | 375 | 390 | 430 |
|--|-----|-----|-----|-----|
| Summary 한 화면 | △ | ○ | ○ | ○ |
| metrics 4열 | ✕ | △ | ○ | ○ |
| Journey tap | ○ | ○ | ○ | ○ |
| Watchlist card | △ | ○ | ○ | ○ |

○ 양호 · △ 주의 · ✕ 개선 필요

---

## 원칙

1. **글자만** 키우지 않고 line-height·contrast·touch target
2. **밀도 유지** — Summary V2는 리스트 not full card
3. **상세는 접기** — 5초 뷰와 분리
