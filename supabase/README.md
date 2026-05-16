# Supabase — YDS 패닉 허브

## 1. 긴급: SQL Editor 한 번에 적용 (권장)

Supabase Dashboard → **SQL Editor** → **New query**

1. `sql/YDS_FULL_SETUP.sql` 전체 복사 → **Run**
2. 하단 결과에서 row count 확인:
   - `panic_metrics` ≥ 10
   - `panic_index_history` ≥ 3
   - `market_status` ≥ 3
   - `ai_reports` ≥ 1

테이블이 깨졌거나 잘못 만들어진 경우:

1. `sql/RESET_AND_SETUP.sql` Run
2. `sql/YDS_FULL_SETUP.sql` Run

### 앱과 맞는 컬럼명 (중요)

| 사용자 예시 | 실제 DB (앱 query) |
|------------|-------------------|
| `metric_name` | **`metric_key`** (`vix`, `fearGreed`, …) |
| `value` | **`metric_value`** |
| `put_call` (history) | `put_call` + `hy_oas` (highYield) |

## 2. 마이그레이션 파일 (CLI용)

1. `migrations/20250516120000_yds_initial_schema_seed.sql`

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
