# YDS Production Audit Report

> 점검일: 2026-06-03 · 환경: prod build preview · 커밋 Final UI Polish

## 판정: **PASS (Launch Ready)**

Critical **0** · Major **0** · Production blockers 없음.

---

## 라우팅 · 404

| 경로 | 결과 | 비고 |
|------|------|------|
| `/` | ✅ | → `/market-analysis` |
| `/market-analysis` | ✅ | Hub + Summary hero |
| `/watchlist` | ✅ | hash scroll `#watchlist-{id}` |
| `/alert-center` | ✅ | |
| `/performance-center` | ✅ | |
| `/ai-daily-report` | ✅ | |
| `/lab` | ✅ | Research |
| `/recommendation-history?q=` | ✅ | 필터 |
| `/intro` `/start` `/faq` `/about` `/feedback` | ✅ | Launch pages |
| `/glossary` | ✅ | |
| `/market-dashboard` | ✅ | redirect |
| `/performance-dashboard` | ✅ | redirect |
| `/macro-risk` | ✅ | → `/cycle#bond-liquidity` |
| `/timing` | ✅ | → `/value-chain#industry-signal-board` |
| `/insights` | ✅ | → `/value-chain` |
| `*` | ✅ | NotFoundPage |

---

## Broken Link 검사

| 링크 | 결과 |
|------|------|
| `/glossary#stock-radar` | ✅ glossary entry id |
| Journey Strip 4링크 | ✅ |
| Hub → Watchlist hash | ✅ |
| Watchlist → Alert · reco `?q=` | ✅ |
| AI E섹션 → Watchlist hash | ✅ |
| YdsV1DataScopeNotice → glossary | ✅ (full `<a href>` — SPA reload, 동작 OK) |
| `/trading-log` | ✅ route exists |
| `/admin` `/debug-data` | ✅ dev drawer only |

---

## Anchor · Scroll

| 항목 | 결과 |
|------|------|
| Watchlist `#watchlist-{id}` | ✅ scrollIntoView |
| `/cycle#bond-liquidity` | ✅ macro-risk redirect |
| `/value-chain#industry-signal-board` | ✅ timing redirect |
| Recommendation history `?q=` highlight | ✅ |

---

## CTA · 주요 버튼

| CTA | 페이지 | 결과 |
|-----|--------|------|
| 시장분석 | 모든 코어 header | ✅ |
| Watchlist Top3 링크 | Summary hero | ✅ |
| Journey Strip | 6코어 | ✅ |
| Empty state primary | 5코어 | ✅ |
| Watchlist 카드 알림/추천기록 | min-height 2.25rem | ✅ |

---

## 플랫폼

| 항목 | 결과 |
|------|------|
| prod build | ✅ |
| chunk warning | △ non-blocking |
| PWA precache | ✅ |
| 다크모드 | ✅ default |
| 모바일 320px | △ hero stack, readable min font |

---

## 콘솔 · 런타임

| 이슈 | 상태 |
|------|------|
| CurrentMarketAnalysisPage undefined | ✅ fixed `8a20fe1` |
| Route render smoke (4코어) | ✅ preview verified |

---

## Minor (Non-blocking)

| ID | 항목 |
|----|------|
| PA-01 | `<a href>` vs `<Link>` glossary (scope notice) |
| PA-02 | E2E automated click tests 없음 |
| PA-03 | 320px 실기기 미검 |

---

## 관련

- [YDS_V1_LAUNCH_REPORT.md](./YDS_V1_LAUNCH_REPORT.md)
- [YDS_SOFT_LAUNCH_PACKAGE.md](./YDS_SOFT_LAUNCH_PACKAGE.md)
