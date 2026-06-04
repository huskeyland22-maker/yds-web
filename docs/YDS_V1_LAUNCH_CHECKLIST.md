# YDS V1 Launch Checklist

출시 전 수동 확인 목록입니다. 코드 변경 후 빌드·배포와 함께 점검하세요.

## 첫 방문 (5초 흐름)

- [ ] `localStorage` 키 `yds-v1-launch-onboarded` 없을 때 `/market-analysis`에 **현재 시장 · 추천 행동 · 추천 섹터 · 추천 종목**만 표시
- [ ] 「전체 기능 보기」 후 Hub 전체·탭·CORE 링크 복원
- [ ] 「3분 시작하기」 `/start` · 「YDS 소개」 `/intro` 동작

## 콘텐츠 페이지

- [ ] `/intro` — YDS 소개 (5단계·시장 위치 포함)
- [ ] `/start` — 4단계 튜토리얼 링크
- [ ] `/faq` — 5개 FAQ
- [ ] `/about` — 철학·주의·면책
- [ ] `/feedback` — 버그/기능/의견 mailto

## 네비게이션

- [ ] 모바일 드로어 · 데스크탑 사이드바 「출시 안내」 링크
- [ ] 메인 하단 네비 6개 유지 (시장분석, Watchlist, 알림, AI 리포트, 성과, Research)

## 모바일

- [ ] iOS Safari · Android Chrome — 시장분석 첫 화면 스크롤·터치
- [ ] safe-area (노치·홈 인디케이터)
- [ ] 드로어 열기/닫기

## 데스크탑

- [ ] `lg` 브레이크포인트 사이드바 + 본문 레이아웃
- [ ] Hub 카드 그리드 가독성

## PWA

- [ ] 홈 화면 추가 후 standalone 실행
- [ ] 업데이트 토스트 (새 빌드 시)
- [ ] 오프라인 시 적절한 로딩/캐시 메시지

## 다크모드

- [ ] 기본 다크 테마 — Launch·404·Feedback 페이지 대비
- [ ] 시스템 라이트 모드 사용자 (해당 시) 가독성

## 404 · 로딩 · 오류

- [ ] 존재하지 않는 URL → `NotFoundPage` (시장분석·가이드 링크)
- [ ] 시장 데이터 미동기화 시 로딩 문구
- [ ] `SectionErrorBoundary` 폴백 UI 확인

## 신뢰·법적

- [ ] About 면책 문구 검토
- [ ] 피드백 이메일 `feedback@yds.app` (운영 시 실제 주소로 교체)

## 배포

- [ ] `npm run build` 성공
- [ ] `git push origin main` 후 프로덕션 빌드 ID 확인

---

**상태:** V1 Launch Ready (구현 완료 시 이 문서와 함께 RC 리포트 `docs/YDS_V1_RC_REPORT.md` 참고)
