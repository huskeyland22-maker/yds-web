# Release Candidate

**목표 버전:** v3.0 Release Candidate

릴리즈 규칙:

| 버전 | 용도 |
|------|------|
| **v3.0.0** | 대규모 기능 추가 |
| **v3.0.1** | 버그 수정 |
| **v3.1.0** | 신규 페이지 추가 |

환경 배지: `DEV` (로컬) · `RC` (`VITE_APP_RELEASE_CHANNEL=rc`) · `PROD` (프로덕션 빌드)

---

## UI

- [x] 시장분석 정보 계층 개선 (YDS SCORE 스포트라이트, 시장 요약 카드)
- [x] 유사사례 카드화
- [x] 행동가이드 강조 개선 (현재 단계 scale·glow)
- [ ] 모바일 가독성 개선

## 기능

- [x] 운영자 대시보드 `/admin` (Admin Layer)
- [x] 시장 상태 중심 메인 (V6/V7) — 상태·전략·패닉 보조·종목추천 연동
- [x] 종목추천 V5/V6 — 타이밍 인사이트, 시장상태 TOP 한도, 관심종목 알림
- [x] 전환 신호 `[signal-audit]` 콘솔 검증 로그
- [x] 시장 상태 이벤트 타임라인 (날짜·상태·점수·진입/안정화/회복)
- [x] 유동성 환경 V2 — 10Y/Real/HY OAS/MOVE 가중 점수
- [ ] AI 리포트 개선
- [ ] 패닉지수 데이터 검증
- [ ] 연구실 기능 정리

## 버그

- [ ] PWA 캐시 문제
- [ ] Hydration mismatch
- [ ] 모바일 새로고침 이슈

---

## 배포 조건

- 주요 기능 완료
- 모바일 확인
- 데스크탑 확인
- 콘솔 에러 없음
- `npm run build` 성공

---

## 배포 원칙

- 작은 UI 수정마다 **즉시 배포하지 않음**
- Release Candidate 항목이 **5~10개 이상** 누적되면 배포
- 배포 전 `docs/deploy-checklist.md` 전 항목 확인
- RC 검증: `VITE_APP_RELEASE_CHANNEL=rc npm run build` 후 preview·스테이징 확인

---

## RC 로컬 실행 예시

```bash
cd vite-project
# 개발 (배지 DEV)
npm run dev

# RC 빌드 미리보기 (배지 RC)
set VITE_APP_RELEASE_CHANNEL=rc
npm run build
npm run preview
```
