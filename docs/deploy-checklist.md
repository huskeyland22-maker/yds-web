# Deploy Checklist

배포(`git push origin main`) 직전에 확인합니다.

**역할:** 이 문서는 **현재 배포 게이트**(이번 push에 넣을 공개 표면)입니다.  
기능 완료·이력·RC 후보 누적은 `docs/release-plan.md`에 둡니다. 두 문서를 동일 층위로 쓰지 않습니다.

**현재 `/market-analysis` 제품 범위:** Panic Index 중심 (점수·FEAR SCALE·History·Drivers·패닉 매수 기록).  
홈 핵심 경로: `/daily-bottom-buy`(DBB).

---

## 현재 RC 필수 — 빌드·품질

- [ ] `cd vite-project && npm run build` 성공
- [ ] **변경 범위** eslint 무경고 (이번 RC에서 수정·추가한 파일 기준)
- [ ] 콘솔 에러 없음 (아래 주요 경로 스모크)

> 전체 `npm run lint` 실패가 **기존 부채**인 경우, 이번 RC 변경과 무관하면 배포를 자동 차단하지 않습니다. 신규/변경 파일 회귀만 게이트로 봅니다. 전체 lint 무결은 별도 품질 RC에서 다룹니다.

---

## 현재 RC 필수 — UI·기기

- [ ] 모바일 확인 (하단 네비, `/daily-bottom-buy`, `/market-analysis` Panic)
- [ ] 데스크탑 확인 (사이드바, `/daily-bottom-buy`, `/market-analysis` Panic)
- [ ] 환경 배지: 의도한 `DEV` / `RC` / `PROD` 표시

> 예전 항목의 「사이클」은 `/cycle` → `/market-analysis` 리다이렉트 이후 **Panic History·시장분석 경로**로 해석합니다. 별도 사이클 전용 UI 스모크는 현재 게이트에 넣지 않습니다.

---

## 현재 RC 필수 — 데이터·기능

- [ ] `/daily-bottom-buy`(DBB): 후보·가격(또는 안내된 빈 상태) 정상 표시
- [ ] `/market-analysis`: Panic Index 점수·Drivers·History 정상 표시
- [ ] `/admin` 운영자 대시보드: 기본 로드·시스템·패닉·무결성·AI·성능 카드 영역 표시  
  (사이클 히스토리 공백·패닉 값 `—`은 **데이터 부재일 수 있음**. 페이지 크래시·콘솔 치명 오류와 구분)

---

## 조건부 — 해당 RC에 포함된 경우만

- [ ] AI 리포트 정상 생성 (해당 RC에 포함된 경우)
- [ ] PWA 갱신·캐시 (해당 RC에 포함된 경우)

---

## 레거시 / 복원 RC 전용 — 시장분석 구 UI

아래는 **현재 `/market-analysis` 공개 표면에서 제외**된 항목입니다.  
YDS SCORE·유사사례·행동 가이드를 **시장분석 경로에 다시 노출하거나 구조를 되돌리는 RC**에서만 필수 게이트로 씁니다. 삭제하지 않고 보존합니다.

- [ ] 현재 시장 분석: YDS SCORE, 유사 사례 카드, 행동 가이드
- [ ] (참고) 구 표현 「패닉지수·YDS 데이터」— 현재 게이트에서는 위 Panic Index·DBB 항목으로 대체. 종목/성과 등 다른 경로의 YDS·행동 가이드는 해당 기능 RC에서 점검

---

## Git · RC 범위

- [ ] `docs/release-plan.md`에 이번 RC 완료·미완료 반영 (이력·후보 기록)
- [ ] 이번 배포 커밋 범위가 RC 후보와 일치하는지 확인 (의도하지 않은 dirty·미추적 파일 미포함)
- [ ] 불필요 파일 미포함 (`__pycache__`, `.vercel`, 로그)
- [ ] 커밋 메시지가 RC 범위를 설명함

---

## 배포 후

- [ ] Vercel(또는 호스팅) 배포 완료 확인
- [ ] 프로덕션에서 `PROD` 배지·버전 확인
