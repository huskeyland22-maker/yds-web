# YDS Soft Launch Package

> V1 정식 Soft Launch 준비 문서 · 2026-06-03

---

## 현재 상태

| 영역 | 상태 |
|------|------|
| 6코어 기능 | ✅ Launch Candidate |
| Explainability | ✅ Stock·Watchlist·Alert·Pattern·Regime |
| Journey UX | ✅ Strip + cross-page CTA |
| Empty states | ✅ YdsEmptyState 통일 |
| UI Polish | ✅ 5초 Hero Summary |
| Major 이슈 | **0** |
| Critical | **0** |
| 실시간 시세 | ❌ V1 scope out (명시 배지) |

---

## 장점

1. **5초 요약** — Hub hero: 현재 시장 · 추천 행동 · 추천 종목 Top3
2. **투명한 데이터 범위** — 전략 기반 점수, glossary 산식 링크
3. **추천 여정** — 시장분석 → Watchlist → Alert → 성과 일관 CTA
4. **Paper Trading 성과** — 추천 이력 필터 `?q=` · Watchlist 역링크
5. **PWA + Launch pages** — intro/start/faq/onboarding
6. **Research 분리** — 일반 사용자 vs 검증/백테스트

---

## 부족한 점

1. **실시간 시세 미연동** — 사용자 기대 관리 필요 (Phase 26.1)
2. **320px 실기기** — metrics 2열, hero stack (문서화됨)
3. **Supabase cycle** — 운영 미연결 시 히스토리 빈약 가능
4. **E2E 자동화** — 수동 smoke only
5. **라이트 테마** — 미지원

---

## 로드맵

### V1 (현재 — Soft Launch)

- [x] 6코어 + Journey + Explain
- [x] Major 0 · Production audit PASS
- [x] Empty state · UI polish
- [ ] Soft launch 사용자 피드백 수집 (`/feedback`)

### V1.1 (출시 후 4~8주)

| 항목 | 설명 |
|------|------|
| 320px QA | iPhone SE 실기기 |
| Supabase cycle sync | 엔진 변경 없이 데이터 풍부화 |
| Hub skeleton loader | empty → loading UX |
| Alert filtered empty | YdsEmptyState 통일 |
| `<Link>` glossary | SPA navigation polish |

### V2 (중기)

| 항목 | 설명 |
|------|------|
| 라이트/테마 | 접근성 |
| E2E Playwright | 6코어 smoke |
| 개인화 Watchlist | 계정 연동 |
| Push notification | Alert 확장 |

---

## 실시간 데이터 연동 계획 (Phase 26.1+)

> **V1 금지** — 별도 스프린트 · 엔진/산식 변경은 POC 검증 후

### Phase 26.1 — Yahoo (1차)

| 항목 | 내용 |
|------|------|
| 목적 | 종목 현재가·일봉 enrichment (표시·explain 보조) |
| 범위 | Stock Radar 카드 “참고 시세” (점수 산식 미변경) |
| API | 기존 `api/_lib/yahooQuote.js` · `yahooChartPick.js` |
| 리스크 | rate limit · 지연 |

### Phase 26.2 — KIS (국내)

| 항목 | 내용 |
|------|------|
| 목적 | KRX 종목 실시간/종가 |
| 범위 | Watchlist 국내 종목 가격 표시 |
| API | `kisClient.js` · token manager |
| 선행 | KIS 앱키 운영 env |

### Phase 26.3 — Finnhub (글로bal 보조)

| 항목 | 내용 |
|------|------|
| 목적 | 미국 종목 quote fallback |
| 범위 | Yahoo 장애 시 failover |
| 원칙 | scoring engine 입력 **미사용** (V1 약속 유지) |

### 아키텍처 원칙

```
[YDS Engine] ── strategy score (unchanged)
       │
       ▼
[Enrichment Layer] ── live quote for display only
       │
       ├── Yahoo (US default)
       ├── KIS (KR)
       └── Finnhub (fallback)
```

---

## 산출물 목록

| 문서 | 경로 |
|------|------|
| Soft Launch Review | [YDS_SOFT_LAUNCH_REVIEW_REPORT.md](./YDS_SOFT_LAUNCH_REVIEW_REPORT.md) |
| Launch Report | [YDS_V1_LAUNCH_REPORT.md](./YDS_V1_LAUNCH_REPORT.md) |
| Empty State Audit | [YDS_EMPTY_STATE_AUDIT.md](./YDS_EMPTY_STATE_AUDIT.md) |
| Production Audit | [YDS_PRODUCTION_AUDIT_REPORT.md](./YDS_PRODUCTION_AUDIT_REPORT.md) |
| Soft Launch Package | 본 문서 |

---

## 배포 권장

**권장** — LC 기준 충족, Critical 0, prod audit PASS.

Soft launch → 피드백 → V1.1 (320px + Supabase) → Phase 26.1 POC 순.
