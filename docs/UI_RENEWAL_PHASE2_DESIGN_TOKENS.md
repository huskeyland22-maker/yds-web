# UI 리뉴얼 2단계 — 디자인 토큰 설계

**기준:** `docs/UI_RENEWAL_PHASE1_INVENTORY.md`  
**작성일:** 2026-10-20  
**이번 적용:** 가산형 CSS 변수만 (`--yds-*`). 전역 배경·기존 클래스 값 미변경.

---

## 1. 현재 스타일 구조 (조사)

| 층 | 위치 | 역할 |
|----|------|------|
| Tailwind base | `index.css` `@layer base` | `html`/`body` 배경 `#0b0e14`, IBM Plex + Noto Sans KR |
| Tailwind theme | `tailwind.config.js` | `terminal.bg/panel/line`, `trading-*` font/spacing, `card` radius, dark shadows |
| 앱 셸 | `App.jsx` | `bg-[#0B0E14]`, slate 텍스트, 사이드·모바일 네비 인라인 색 |
| 도메인 CSS | `index.css` 본문 (~39k lines) | `.yds-dbb*`, `.panic-*`, `.tactical-*`, home-v5, portfolio 등 **페이지별 하드코딩 색** |
| 기존 CSS 변수 | 부분적 | `--panic-desk-*`, `--timeline-color`, `--home-v5-*`, `--hud-*`, `--korea-dash-*` 등 **도메인 로컬** |

공통 디자인 토큰 레이어는 사실상 없고, **터미널 다크 + Tailwind slate/sky + 도메인별 hex**가 혼재한다.

---

## 2. 신호·경고·차트 색 (보존 필수)

| 의미 | 현재 관례 (코드에서 확인) | 토큰 정책 |
|------|---------------------------|-----------|
| 상승 / 충족 / 양호 | `#22c55e`, `is-up`, emerald | `--yds-signal-up`이 **동일 hex를 가리키게** 두고, 기존 규칙은 당분간 하드코딩 유지 |
| 하락 / 위험 | `#ef4444`, `is-down`, rose | `--yds-signal-down` 동일 |
| 주의 / 전환 | `#facc15` / `#f97316` / amber | `--yds-signal-warn` / `--yds-signal-caution` |
| 정보·강조(현재 dark UI) | sky/cyan (`#38bdf8` 계열) | 브랜드 accent와 **분리**: 신호 cyan ≠ 브랜드 blue |
| Panic desk 섹션 | cyan / amber / green 라인 | 로컬 `--panic-desk-*` 유지, 2단계에서 재매핑 금지 |
| DBB 카드 상태 | `.yds-dbb-card--strong/primary/watch/wait` | 클래스 의미 유지 |

**금지:** 2단계에서 `html`/`body`/`app-shell-host` 배경을 오프화이트로 바꾸거나, `#22c55e`/`#ef4444`를 다른 hue로 교체하지 않음.

---

## 3. 제안 토큰 (`--yds-*` 네임스페이스)

목표 팔레트(라이트 프리미엄)는 **변수로만 정의**. 소비는 이후 셸/페이지 단계에서 opt-in.

### 색 — surface / text / brand
| 토큰 | 값 | 용도 |
|------|-----|------|
| `--yds-bg` | `#F4F6F9` | 앱 배경(오프화이트-그레이) |
| `--yds-bg-elevated` | `#FFFFFF` | 카드 |
| `--yds-bg-muted` | `#E8ECF2` | 보조 면 |
| `--yds-text` | `#0B1F3A` | 네이비 본문 |
| `--yds-text-secondary` | `#3D4F66` | 보조 문구 |
| `--yds-text-muted` | `#6B7C93` | 메타 |
| `--yds-border` | `#D5DEE9` | 얇은 경계 |
| `--yds-border-strong` | `#B8C5D6` | 강조 경계 |
| `--yds-accent` | `#1B4F9C` | 주요 블루 |
| `--yds-accent-soft` | `#E8F0FB` | 선택/칩 배경 |
| `--yds-focus-ring` | `#3B82F6` | 포커스 |

### 색 — 신호 (기존 의미 고정)
| 토큰 | 값 | 비고 |
|------|-----|------|
| `--yds-signal-up` | `#22c55e` | 현행과 동일 |
| `--yds-signal-down` | `#ef4444` | 현행과 동일 |
| `--yds-signal-warn` | `#eab308` | 주의 |
| `--yds-signal-caution` | `#f97316` | 경계 |
| `--yds-signal-info` | `#0284c7` | 정보(브랜드 accent와 구분) |

### 색 — 현재 다크 셸 참조(호환)
| 토큰 | 값 | 비고 |
|------|-----|------|
| `--yds-legacy-terminal-bg` | `#0B0E14` | `terminal.bg`와 동일 |
| `--yds-legacy-terminal-panel` | `#0F1319` | `terminal.panel` |
| `--yds-legacy-terminal-line` | `rgba(255,255,255,0.06)` | |

### 타이포·간격·라디우스·그림자
| 토큰 | 값 |
|------|-----|
| `--yds-font-sans` | IBM Plex Sans, Noto Sans KR, system |
| `--yds-font-mono` | IBM Plex Mono, ui-monospace |
| `--yds-text-xs` … `--yds-text-xl` | 0.6875rem ~ 1.25rem (trading-* 정렬) |
| `--yds-space-1` … `--yds-space-6` | 0.25–1.5rem |
| `--yds-radius-sm/md/card` | 6px / 10px / 14px |
| `--yds-shadow-card` | `0 1px 2px rgba(11,31,58,0.06), 0 4px 12px rgba(11,31,58,0.04)` |
| `--yds-shadow-focus` | `0 0 0 3px color-mix(in srgb, var(--yds-accent) 28%, transparent)` |

---

## 4. 충돌·위험

| 위험 | 설명 | 완화 |
|------|------|------|
| 전역 `html`/`body` 색 변경 | 모든 P-* 즉시 깨짐 | **2단계 미적용** |
| Tailwind `slate-*` / `bg-[#0B0E14]` | App 셸·다수 컴포넌트 | 셸 단계에서 클래스→토큰 치환을 페이지별 롤아웃 |
| `.yds-dbb` / `.panic-*` 하드코딩 | 신호 색과 카드 톤 | 도메인 CSS는 3단계+에서 스코프(`--equity-dash`처럼) 단위로만 |
| 기존 `--panic-*` / `--home-v5-*` | 이름 충돌 | `--yds-` prefix만 사용 |
| dirty 파일 | `vite.config.js`, `panicStore.js` 등 | **수정 범위 제외** |
| 차트 라이브러리 | lightweight-charts / recharts 인라인 색 | 토큰 미연결 유지 until 차트 단계 |

---

## 5. 변경 대상·영향 페이지

### 이번 단위 (적용)
| 파일 | 내용 | 시각 영향 |
|------|------|-----------|
| `vite-project/src/styles/yds-design-tokens.css` | `:root` 토큰 정의 (신규) | **없음** (미소비) |
| `vite-project/src/index.css` | `@import` 1줄 | **없음** |
| `docs/UI_RENEWAL_PHASE2_DESIGN_TOKENS.md` | 본 문서 | — |

### 이후 단계 (미적용)
| 순서 | 대상 | 영향 ID |
|------|------|---------|
| 3 | App shell / sidebar / MobileBottomNav | 전 P-* chrome |
| 4 | P-DBB-ETF / EQ / LEV | N-CORE |
| 5 | P-PANIC | 패닉 desk |
| 6+ | 종목·포트·성과·연구 | 인벤토리 순서 |

---

## 6. 시각 회귀 검증 방법

1. **빌드:** `cd vite-project && npm run build` — CSS import 오류 없음.  
2. **자동화(기능):** DBB/equity 관련 기존 테스트 (CSS 무관, 회귀 없음 확인).  
3. **수동 스모크(토큰 미소비이므로 기대=동일):**  
   - `/daily-bottom-buy`, `/equity-daily-bottom-buy`, `/market-analysis`  
   - 신호 색(초록/빨강)·패닉 점수 카드·후보 카드 레이아웃  
4. **토큰 존재 확인(선택):** DevTools `:root`에 `--yds-bg`, `--yds-signal-up` 존재.  
5. **금지:** 스크린샷 diff를 “통과”시키기 위해 신호 hex 변경.

---

## 7. 다음 승인 게이트

- 셸(라이트 배경) 적용 시 **별도 승인** 후 `app-shell-host`만 opt-in 클래스(예: `yds-theme-premium`)로 전환하는 방안 권장.  
- 커밋·푸시·배포는 사용자 승인 전 금지.
