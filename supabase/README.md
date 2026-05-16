# Supabase — YDS 패닉 허브

## 1. 마이그레이션 적용 (신규 프로젝트)

Supabase Dashboard → **SQL Editor** → 아래 파일 내용을 **순서대로** 실행:

1. `migrations/20250514120000_panic_metrics.sql` (이미 적용했다면 생략 가능)
2. `migrations/20250515140000_panic_index_history.sql` (동일)
3. `migrations/20250516120000_yds_initial_schema_seed.sql` (**RLS + market_status + ai_reports + seed + realtime**)

또는 CLI: `supabase db push`

## 2. Realtime

마이그레이션에 `supabase_realtime` publication 등록 포함.  
Dashboard → **Database → Replication** 에서 4개 테이블이 켜져 있는지 확인:

- `panic_metrics`
- `panic_index_history`
- `market_status`
- `ai_reports`

## 3. RLS

| 역할 | SELECT | INSERT/UPDATE |
|------|--------|----------------|
| `anon` / `authenticated` | 허용 (public read) | 거부 |
| `service_role` (Vercel API) | 전체 | 전체 (RLS bypass) |

쓰기는 `/api/panic/update` (POST) 만 사용.

## 4. Vercel 환경변수

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PANIC_HUB=1`

설정 후 **Production Redeploy** 필수.

## 5. 로컬 시드 재적용 (선택)

```bash
node scripts/push-supabase-seed.mjs
```

`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` 필요.

## 6. 확인

- 웹/모바일: `/debug-data` 또는 하단 **RAW DB**
- `GET /api/supabase/health` — 테이블별 row count
