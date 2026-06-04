# Deploy Checklist

배포(`git push origin main`) 직전에 확인합니다.

## 빌드·품질

- [ ] `cd vite-project && npm run build` 성공
- [ ] `cd vite-project && npm run lint` 통과 (또는 변경 범위 eslint 무경고)
- [ ] 콘솔 에러 없음 (주요 경로 스모크)

## UI·기기

- [ ] 모바일 확인 (하단 네비, 시장분석, 사이클)
- [ ] 데스크탑 확인 (사이드바, 시장분석)
- [ ] 환경 배지: 의도한 `DEV` / `RC` / `PROD` 표시

## 데이터·기능

- [ ] 패닉지수·YDS 데이터 정상 표시
- [ ] 현재 시장 분석: YDS SCORE, 유사 사례 카드, 행동 가이드
- [ ] `/admin` 운영자 대시보드: 시스템·패닉·무결성·AI·성능 카드
- [ ] AI 리포트 정상 생성 (해당 RC에 포함된 경우)
- [ ] PWA 갱신·캐시 (해당 RC에 포함된 경우)

## Git

- [ ] `docs/release-plan.md` 완료 항목 반영
- [ ] 불필요 파일 미포함 (`__pycache__`, `.vercel`, 로그)
- [ ] 커밋 메시지가 RC 범위를 설명함

## 배포 후

- [ ] Vercel(또는 호스팅) 배포 완료 확인
- [ ] 프로덕션에서 `PROD` 배지·버전 확인
