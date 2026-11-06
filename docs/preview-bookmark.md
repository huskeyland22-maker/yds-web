# Preview 즐겨찾기 가이드

개발 중 YDS를 즐겨찾기로 열 때 **고정 Preview 주소**를 사용하세요.

## 권장 주소 (고정 branch alias)

https://yds-web-git-integration-yds-windows-mac-so-sung-yangs-projects.vercel.app/

- Git 브랜치 `integration/yds-windows-mac` 최신 배포를 가리킵니다.
- push 후 Vercel Preview 배포가 끝나면 이 URL이 자동으로 새 빌드를 제공합니다.

## 쓰지 말아야 할 주소

| 주소 | 이유 |
|------|------|
| `https://yds-web-kappa.vercel.app/` | **Production** — Preview 변경이 반영되지 않음 |
| `https://yds-web-<해시>-….vercel.app/` | 특정 배포 전용 URL — 이후 push에 갱신되지 않음 |
| `?v=옛커밋` 이 붙은 북마크 | 혼동만 키움 (서버는 무시하지만 사람이 헷갈림) |

## 버전 확인

Preview에서는 화면 왼쪽 아래 **PREV · (커밋)** 칩이 표시됩니다.

- 칩을 누르면 실행 중 빌드 / HTML / remote(`build-version.json`)를 비교합니다.
- 메뉴 → **개발자 · 빌드**에서 강제 업데이트·캐시 진단이 가능합니다.
- `?pwa-debug=1` 로 상세 PWA 오버레이를 켤 수 있습니다.

## 캐시 정책 요약

- `/` · SPA 경로(`/market-analysis` 등) HTML: `no-store` (브라우저·CDN 장기 보관 방지)
- `/assets/*` 해시 파일: `immutable` (파일명이 바뀌면 새 URL)
- Service Worker: HTML/JS/CSS **NetworkOnly** (이전 HTML precache 제공 안 함)
- 배포 후 자동 감지: `build-version.json` 폴링 + chunk 404 복구 (무한 대기 방지)

Production 설정·DB·배포는 이 문서 범위 밖입니다.
