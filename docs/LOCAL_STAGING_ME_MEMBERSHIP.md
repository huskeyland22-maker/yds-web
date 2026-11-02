# 로컬 Staging — `/api/me-membership` 테스트 안내

운영 Vercel·Production Supabase는 **수정하지 않습니다.**  
이 문서는 **본인 PC**에서 Staging(`qzunuksxwwzusyivaznx`)만 쓰는 방법입니다.

## 1. 로컬에서 env가 쓰이는 방식 (요약)

| 구분 | 방식 |
|------|------|
| Vite 프론트 | `vite-project/.env.local` 등 (`VITE_*`) — 빌드/개발 서버 |
| Vercel API (`api/*.js`) | Node `process.env` — 로컬에서는 **직접 넣거나** 아래 Staging 파일을 스크립트가 읽음 |
| Flask `server.py` | `/api/me-membership` **없음** (시세용). 회원 API는 `api/me-membership.js` |

`.gitignore`에 `.env*`가 있어, 루트의 `.env.staging.local`은 Git에 안 올라갑니다.

## 2. Staging 키 파일 준비 (사용자)

1. 템플릿을 복사합니다.

```text
docs/templates/staging-me-membership.env.example
  →  (저장소 루트)  .env.staging.local
```

PowerShell 예:

```powershell
Copy-Item "docs\templates\staging-me-membership.env.example" ".env.staging.local"
```

2. `.env.staging.local`을 열어 `PLACEHOLDER_...`만 **Staging** 값으로 바꿉니다.

| 변수 | 어디서 구하나 |
|------|----------------|
| `SUPABASE_URL` | 이미 `https://qzunuksxwwzusyivaznx.supabase.co` (템플릿에 있음) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase **yds-web-staging** → Settings → API → `service_role` |
| `FIREBASE_API_KEY` | Firebase 콘솔 웹 앱 API 키 (로그인 검증용) |

3. URL에 **`qzunuksxwwzusyivaznx`** 가 있는지 확인합니다.  
   **`oausvweyocgynjpeguka`(운영)가 보이면 저장하지 마세요.**

4. 이 파일·키를 채팅·Git·스크린샷에 넣지 마세요.

## 3. 테스트 절차

### A. 키 없이 가능한 확인 (이미 완료된 것과 동일)

- 무토큰 GET → `401` / `missing_token`
- POST → `405` / `method_not_allowed`  
→ Staging DB 접속 전에 인증·메서드에서 막힘.

### B. Staging 키가 채워진 뒤 (사용자가 로컬에서)

저장소 루트에서:

```powershell
node scripts/smoke-me-membership-local.mjs
```

기본 동작:

1. `.env.staging.local` 로드 (값 출력 안 함)
2. URL에 운영 ref가 있으면 **즉시 중단**
3. 무토큰 GET / POST 스모크
4. `ME_MEMBERSHIP_ID_TOKEN`이 있으면 (선택) 로그인 GET 1회  
   - 행 없을 때 기대: `200`, `plan: "free"`, `reason: "missing_row"`

토큰 넣는 법 (선택):

1. 사이트에서 Google 로그인
2. 브라우저에서 Firebase ID 토큰을 **짧게** 복사
3. `.env.staging.local`의 `ME_MEMBERSHIP_ID_TOKEN=`에만 임시 입력
4. 스크립트 실행 후 토큰 줄 삭제·재로그인 권장

### C. 하지 말 것

- Production Vercel env 수정
- 운영 Supabase SQL / 대시보드 변경
- 키·토큰을 Cursor 채팅에 붙여 넣기
- `git add .env.staging.local`

## 4. 성공 기준

| 단계 | 성공 |
|------|------|
| 무토큰 GET | HTTP 401, error `missing_token` |
| POST | HTTP 405, error `method_not_allowed` |
| 유효 토큰 + 장부 빈 행 | HTTP 200, `plan`=`free`, `reason`=`missing_row` |
| 운영 URL 감지 | 스크립트가 실행 거부 |

## 5. 관련 파일

| 경로 | 역할 |
|------|------|
| `docs/templates/staging-me-membership.env.example` | PLACEHOLDER 템플릿 |
| `.env.staging.local` | 사용자가 만드는 실제 키 파일 (Git 제외) |
| `scripts/smoke-me-membership-local.mjs` | 로컬 스모크 스크립트 |
| `api/me-membership.js` | API 핸들러 |
| `api/_lib/userMembership.js` | FREE/PRO 조회 |
