# YDS Empty State Audit

> 점검일: 2026-06-03 · 범위: 6코어 + Hub · **엔진/산식 변경 없음**

## 요약

공통 `YdsEmptyState` 컴포넌트 도입으로 빈 데이터·필터 무결과·로딩 시 **깨짐 없이** 안내 + CTA 제공.

| 페이지 | empty 조건 | 처리 | CTA |
|--------|-----------|------|-----|
| 시장분석 Hub | `!hub.available` | YdsEmptyState | start · faq |
| Watchlist | `!report.available` | YdsEmptyState | market-analysis · start |
| Watchlist 필터 | `filteredItems.length===0` | YdsEmptyState inline | market-analysis |
| Alert | `!report.available` | YdsEmptyState | market-analysis · watchlist |
| Alert 목록 | 필터 무결과 | 기존 muted 문구 | — |
| AI 리포트 | `!report.available` | YdsEmptyState | market-analysis |
| 성과센터 | `!report.available` | YdsEmptyState | market-analysis · reco history |
| Research | `insufficient_data` | YdsEmptyState | market-analysis |

---

## 검사 항목

### 빈 데이터
- ✅ 각 코어 `report.available === false` 시 섹션 크래시 없음
- ✅ Paper Trading 없을 때 성과센터 테이블 미렌더

### 로딩 상태
- △ Hub `!available` — “준비 중” empty (별도 spinner 없음, V1 scope)
- ✅ Cycle store 비어 있어도 validation dataset fallback으로 대부분 데이터 표시

### 오류 상태
- ✅ `SectionErrorBoundary` per route (App.jsx)
- ✅ CycleErrorBoundary on `/cycle`

### 친절한 안내
- ✅ 제목 + 설명 + 1~2 CTA 버튼 (min-height 2.25rem)
- ✅ role="status" aria-live="polite"

### 콘솔 에러
- ✅ prod build 통과
- 목표: 런타임 undefined reference 0 (CurrentMarketAnalysisPage import 수정 완료)

---

## 컴포넌트

`vite-project/src/components/trust/YdsEmptyState.jsx`

Props: `title`, `description`, `primaryTo`, `primaryLabel`, `secondaryTo`, `secondaryLabel`, `icon`, `className`

Variants:
- default — full page block
- `--inline` — Watchlist 필터 무결과
- `--research` — Research max-width

---

## 잔여 Minor

| ID | 항목 | 우선순위 |
|----|------|----------|
| ES-01 | Hub 전용 skeleton loader | V1.1 |
| ES-02 | Supabase 연결 실패 dedicated UI | V1.1 |
| ES-03 | Alert filtered empty → YdsEmptyState 통일 | 하 |

---

## 관련

- [YDS_PRODUCTION_AUDIT_REPORT.md](./YDS_PRODUCTION_AUDIT_REPORT.md)
- [YDS_SOFT_LAUNCH_PACKAGE.md](./YDS_SOFT_LAUNCH_PACKAGE.md)
