# Supabase CLI 스테이징 사전 점검

이번 점검은 저장소 파일만 읽었습니다. CLI 설치, 로그인, 프로젝트 연결, 원격 DB 접속, SQL 실행, 파일 수정은 하지 않았습니다. 아래는 Windows PC에서 나중에 그대로 따라 할 절차입니다. 라이브 스테이징 DB가 이미 어떤 상태인지는 이 점검으로 확인하지 못했습니다.

**`supabase db push`는 5번 중단 조건이 해소되기 전에는 실행하지 않습니다.** 비어 있는 데이터베이스에 16개 파일을 순서대로 넣으면 11번째 파일에서 실패하고, 1~10번은 이미 반영된 채로 남을 수 있습니다.

프로젝트 참조는 이것만 사용합니다.

| 역할 | project ref | 대시보드 주소에 보여야 하는 문자열 |
|------|-------------|--------------------------------------|
| 스테이징 (연결 대상) | `qzunuksxwwzusyivaznx` | `qzunuksxwwzusyivaznx` |
| 운영 (연결 금지) | `oausvweyocgynjpeguka` | 이 문자열이 보이면 그 화면에서는 SQL·CLI를 진행하지 않음 |

---

## 1. Windows에서 Supabase CLI 확인과 설치

작업 폴더는 이 저장소 루트입니다. `supabase` 폴더가 바로 보여야 합니다. PowerShell에서 진행하고, 관리자 권한 창은 쓰지 않습니다. 설치 파일은 [Supabase CLI 공식 문서](https://supabase.com/docs/guides/cli/getting-started)와 [GitHub supabase/cli 릴리스](https://github.com/supabase/cli/releases)에서만 받습니다. 채팅이나 메일로 받은 `supabase.exe`는 실행하지 않습니다.

**1-1. 이미 설치되어 있는지 확인**

```powershell
Get-Command supabase -ErrorAction SilentlyContinue
supabase --version
```

첫 명령이 경로를 보여주고 둘째 명령이 버전 번호를 출력하면 설치되어 있습니다. 그 버전 번호를 메모합니다. `supabase`를 인식하지 못하면 아직 없는 상태입니다. 이 확인만으로는 로그인되거나 프로젝트가 연결되지 않습니다.

**1-2. 설치 (없을 때만)**

공식 문서의 Windows 방법이 Scoop입니다. Scoop이 없다면 Scoop 공식 사이트의 설치 문장을 먼저 실행한 뒤, 아래만 실행합니다.

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
supabase --version
```

Scoop을 쓰지 않을 때는 GitHub Releases의 Windows 64비트 압축 파일을 풀고, `supabase.exe`가 들어 있는 폴더를 사용자 PATH에 넣은 뒤 새 PowerShell에서 `supabase --version`을 다시 실행합니다. 저장소 안(`yds-web`)에는 실행 파일을 두지 않습니다.

설치 뒤에 나오는 버전 번호를 적어 둡니다. 이후 로그인, `link`, `db push`는 이 단계에 포함하지 않습니다.

---

## 2. 스테이징 ref에만 연결하는 절차

로그인 토큰은 계정에 속한 프로젝트를 모두 볼 수 있습니다. 운영 프로젝트와 같은 계정이면 토큰만으로는 운영이 막히지 않습니다. 막는 장치는 **항상 staging ref를 직접 지정하고, 연결 직후 그 ref를 다시 읽는 것**입니다.

브라우저에서 스테이징만 엽니다.

`https://supabase.com/dashboard/project/qzunuksxwwzusyivaznx`

주소창에 `qzunuksxwwzusyivaznx`가 있는지 확인합니다. 프로젝트 이름을 화면에서 읽고, 스테이징이 맞는지 확인합니다. 주소창에 `oausvweyocgynjpeguka`가 있으면 탭을 닫습니다.

PowerShell은 저장소 루트에서 엽니다.

```powershell
cd "이 저장소 루트 경로"
supabase login
```

브라우저 로그인 뒤 액세스 토큰은 사용자 프로필의 `.supabase` 쪽에 저장됩니다. 토큰을 채팅, Git, Vercel, 메모장 파일에 붙여 넣지 않습니다. 명령 끝에 비밀번호를 붙이지 않습니다. CLI가 물어보면 그 창에만 입력합니다.

3번에서 `supabase/config.toml`을 만든 뒤에 연결합니다.

```powershell
supabase link --project-ref qzunuksxwwzusyivaznx
```

데이터베이스 비밀번호를 물으면, 방금 열어 둔 스테이징 대시보드의 **Project Settings → Database** 비밀번호만 사용합니다. 운영 프로젝트 설정 페이지는 열지 않습니다.

연결이 끝나면 아래 세 곳이 모두 `qzunuksxwwzusyivaznx`인지 확인합니다.

```powershell
Get-Content supabase\.temp\project-ref
Select-String -Path supabase\config.toml -Pattern "project_id"
supabase projects list
```

`projects list`에서 연결된 표시가 스테이징 ref에 있는지 봅니다. 하나라도 다르거나 출력이 비어 있으면 여기서 멈춥니다. `db push`, `db reset`, `db pull`은 실행하지 않습니다.

---

## 3. `config.toml`이 없을 때의 준비

현재 저장소에는 `supabase/config.toml`이 없습니다. CLI용 마이그레이션 16개는 `supabase/migrations/`에 이미 있습니다. 초안 SQL은 `supabase/drafts/`에 있고, 이 폴더는 `db push` 대상이 아닙니다. `.gitignore`는 `supabase/.temp/`를 무시합니다.

`config.toml`은 연결 전에 로컬에서만 만듭니다. 원격에는 아무것도 적용되지 않습니다.

```powershell
supabase init
```

프롬프트가 기존 `supabase` 폴더, `migrations`, `seed.sql`을 덮어쓸지 물으면 **거절**합니다. `--force`는 쓰지 않습니다. 실행 뒤 아래를 확인합니다.

- `supabase/migrations/` 안의 `.sql` 파일이 16개 그대로인지
- `supabase/drafts/`가 `migrations` 안으로 옮겨지지 않았는지
- 새로 생긴 `supabase/config.toml`이 있는지
- 예제로 생긴 `supabase/seed.sql`이 있다면, 그 파일은 로컬 `db reset`용입니다. `db push`는 이 파일을 실행하지 않습니다. 위험한 시드 INSERT는 마이그레이션 파일 안에 있습니다

`supabase init`이 만든 `project_id`는 자리표시자일 수 있습니다. 2번의 `supabase link --project-ref qzunuksxwwzusyivaznx`가 끝난 뒤에 `config.toml`의 `project_id`가 스테이징 ref와 같은지 다시 봅니다.

이 파일들을 만드는 작업은 이번 점검에서 하지 않았습니다. 만든 뒤에는 Git 커밋도 별도로 검토합니다. `.temp`와 액세스 토큰, 데이터베이스 비밀번호는 커밋하지 않습니다.

---

## 4. `db push` 전에 확인할 것과 중단 조건

`db push`는 연결된 **원격** 데이터베이스에 마이그레이션을 적용합니다. 로컬 전용 명령이 아닙니다. 파일마다 따로 커밋되므로, 중간 파일에서 실패하면 앞선 파일은 이미 반영된 상태입니다.

ref 확인이 끝난 뒤에만, 적용이 아닌 조회를 합니다.

```powershell
supabase migration list
supabase db push --dry-run
```

두 명령은 연결된 원격의 마이그레이션 이력을 읽습니다. SQL을 적용하지는 않습니다. 출력에 나오는 원격이 스테이징 ref인지 먼저 봅니다.

스테이징 SQL Editor를 열기 전에 주소창이 `qzunuksxwwzusyivaznx`인지 확인합니다. 그다음 읽기 전용으로 이력과 기존 데이터를 봅니다.

```sql
select version, name
from supabase_migrations.schema_migrations
order by version;
```

테이블이 없으면 CLI로 적용한 이력이 없는 상태입니다. 이어서 데이터가 이미 있는지도 봅니다.

```sql
select metric_key, source, updated_at
from public.panic_metrics
order by metric_key;

select date, source, vix, fear_greed
from public.panic_index_history
where date in ('2026-05-14', '2026-05-15', '2026-05-16');
```

**다음이면 `db push`를 실행하지 않고 중단합니다.**

1. 연결된 ref, `supabase\.temp\project-ref`, `config.toml`의 `project_id` 중 하나라도 `qzunuksxwwzusyivaznx`가 아닐 때
2. 주소창, 명령, 연결 문자열, 환경 변수에 `oausvweyocgynjpeguka`가 있을 때
3. `--db-url`, `DATABASE_URL`, `SUPABASE_DB_URL`로 접속 주소를 직접 넘기려 할 때
4. `supabase db reset`, `supabase/sql/RESET_AND_SETUP.sql`, `supabase/sql/YDS_FULL_SETUP.sql`을 같이 실행하려 할 때. `RESET_AND_SETUP.sql`은 `panic_metrics`, `panic_index_history`, `market_status`, `ai_reports`를 `DROP`합니다
5. `migration list`가 원격 이력을 보여 주는데, 로컬 16개와 버전이 다를 때
6. 이력 테이블은 비어 있는데 `panic_metrics` 등 테이블이 이미 있을 때. SQL Editor로 만들어 둔 스키마로 보면, 첫 파일의 `CREATE POLICY`가 이미 있는 정책과 충돌해 실패할 수 있습니다. 실패를 피하려고 `migration repair`로 앞 파일을 “적용됨”으로 표시하면, 3번째 파일의 시드가 나중에 실행될 수 있습니다. repair는 쓰지 않습니다
7. `panic_metrics`에 행이 있거나, 2026-05-14·15·16 히스토리의 `source`가 실데이터일 때. 3번째 마이그레이션이 그 행을 시드 값으로 덮어씁니다
8. `--dry-run` 목록에 `supabase/drafts/` 파일이 있을 때. 정상 상태라면 drafts는 목록에 없어야 합니다
9. 11번째 파일 `20250521120000_panic_index_history_v2.sql`을 고치기 전일 때. 아래 5번이 이유입니다
10. 적용 대상이 스테이징이 맞는지 한 사람이 더 확인하기 전일 때

`db push`를 실행하는 시점에도 ref를 한 번 더 읽고, 플래그 없이 아래만 사용합니다.

```powershell
Get-Content supabase\.temp\project-ref
supabase db push
```

---

## 5. 최초 적용 시 16개 마이그레이션의 위험

적용 순서는 파일 이름 시간순입니다.

| 순서 | 파일 | 최초 적용 시 영향 |
|------|------|-------------------|
| 1 | `20250514120000_panic_metrics.sql` | 테이블, 공개 SELECT 정책, `panic_metrics` Realtime 추가. 정책이 이미 있으면 이 파일에서 실패 |
| 2 | `20250515140000_panic_index_history.sql` | 일별 히스토리 테이블, 공개 SELECT. 같은 정책이 있으면 실패 |
| 3 | `20250516120000_yds_initial_schema_seed.sql` | 4개 허브 테이블 보강, **authenticated INSERT/UPDATE 정책**, 4개 테이블 Realtime, **시드 UPSERT** |
| 4 | `20250516130000_panic_history_put_call.sql` | `put_call` 컬럼 추가 |
| 5 | `20250517100000_panic_history_high_yield_gs_bb.sql` | `high_yield`, `gs_bb` 컬럼 추가 |
| 6 | `20250519120000_panic_hub_schema_compat.sql` | `market` 등 컬럼 추가 |
| 7 | `20250519140000_stock_signal_history.sql` | 테이블과 공개 SELECT. `DROP POLICY` 없이 `CREATE POLICY`라, 정책이 있으면 실패 |
| 8 | `20250519150000_panic_history_storage_stable.sql` | 스냅샷·사이클 테이블, 공개 SELECT, security definer 함수 3개 |
| 9 | `20250519160000_daily_ai_reports.sql` | AI 리포트·섹터 테이블, 공개 SELECT, security definer 함수 1개 |
| 10 | `20250520120000_panic_history_v2.sql` | `panic_history_v2`와 authenticated INSERT/UPDATE |
| 11 | `20250521120000_panic_index_history_v2.sql` | 신규 테이블 생성 뒤, 없는 컬럼을 읽는 복사. **빈 DB에서도 여기서 실패할 수 있음** |
| 12 | `20250523120000_panic_v2_practical_columns.sql` | `vvix` 등 5개 컬럼 추가. 11번이 기대하는 컬럼은 여기서도 만들지 않음 |
| 13 | `20250616120000_user_portfolio.sql` | 포트폴리오 테이블, RLS 켜짐, 브라우저용 정책 없음 |
| 14 | `20250926120000_user_trade_records.sql` | 매매 기록 테이블, RLS 켜짐, 브라우저용 정책 없음 |
| 15 | `20261020130000_user_portfolio_revision_lock.sql` | `user_portfolio.revision` 주석만 |
| 16 | `20261029140000_user_membership.sql` | 멤버십 테이블, RLS 켜짐, 브라우저용 정책 없음 |

### 정책

`supabase/README.md`는 anon과 authenticated의 INSERT/UPDATE가 거부된다고 적고 있습니다. 마이그레이션 SQL은 그 설명과 다릅니다.

3번, 10번, 11번 파일은 `authenticated`에 `WITH CHECK (true)`, `USING (true)` INSERT/UPDATE 정책을 만듭니다. 대상은 `panic_metrics`, `panic_index_history`, `market_status`, `ai_reports`, `panic_history_v2`, `panic_index_history_v2`입니다. Supabase Auth로 로그인한 사용자는 해당 테이블의 모든 행을 쓰고 바꿀 수 있습니다. DELETE 정책은 없습니다.

브라우저 클라이언트(`vite-project/src/lib/supabaseBrowser.js`)는 anon 키만 쓰고 세션을 저장하지 않습니다. 그래서 사이트의 평소 접속은 이 INSERT/UPDATE 정책을 타지 않습니다. 정책 자체는 원격 DB에 생깁니다.

1번 파일은 `panic_metrics`를 공개 SELECT만 허용합니다. 3번 파일이 그 정책을 지우고 SELECT와 authenticated 쓰기를 다시 만듭니다. 빈 DB에 끝까지 적용되면 최종 상태는 쓰기 허용 쪽입니다.

`user_portfolio`, `user_trade_records`, `user_membership`는 RLS만 켜고 정책이 없습니다. anon과 authenticated는 읽기·쓰기가 막히고, 서버의 service role만 우회합니다. 시드 행은 없습니다.

8번·9번 함수는 `security definer`이고 `GRANT EXECUTE`는 `service_role`에만 있습니다. 파일 안에 `PUBLIC` / `anon` / `authenticated` 실행 권한을 `REVOKE`하는 문장은 없습니다. PostgreSQL은 새 함수에 `PUBLIC` 실행 권한을 기본으로 주는 경우가 있습니다. 그 회수 문장은 `supabase/drafts/P2-24_03_privilege_verify_and_harden.sql`에만 있고, 이 초안은 마이그레이션이 아닙니다. 최초 push 전에 이 실행 권한을 좁힐지 결정합니다.

`supabase/sql/YDS_FULL_SETUP.sql`은 마이그레이션과 별개입니다. 그 파일은 `authenticated`에 당시 public 테이블 INSERT/UPDATE/DELETE를 `GRANT`합니다. CLI 16개 파일에는 그 GRANT 블록이 없습니다. SQL Editor로 이미 적용된 스테이징과, CLI로 새로 올리는 스테이징은 권한이 같을 것이라고 보면 안 됩니다.

### Realtime

1번 파일은 `panic_metrics`를 `supabase_realtime` publication에 넣습니다. 3번 파일은 이미 없을 때만 다음 네 테이블을 넣습니다.

- `panic_metrics`
- `panic_index_history`
- `market_status`
- `ai_reports`

빼는 문장은 없습니다. 공개 SELECT(`using (true)`)와 함께 켜지므로, anon 키로 이 네 테이블의 변경을 구독할 수 있습니다. 포트폴리오·매매 기록·멤버십·V2 히스토리는 publication에 넣지 않습니다. 호스팅 Supabase에 `supabase_realtime` publication이 없으면 1번 파일에서 실패합니다.

### 시드와 11번 파일

시드는 3번 파일에 있습니다. `ON CONFLICT DO UPDATE`라서, 같은 키가 있으면 기존 값을 시드로 바꿉니다.

- `panic_metrics` 10개 키(`vix`, `vxn`, `fearGreed`, `bofa`, `move`, `skew`, `putCall`, `highYield`, `gsBullBear`, `risk_regime`)의 값·등락·status·`source='yds-seed'`
- `panic_index_history`의 `2026-05-14`, `2026-05-15`, `2026-05-16` 행의 VIX·Fear&Greed 등 핵심 값과 `source='yds-seed'`
- `market_status`의 `cycle_stage`, `risk_regime`, `panic_board`
- `ai_reports`의 `macro_briefing_latest` 제목과 본문 (`YDS Macro Briefing (seed)`)

오늘 기준으로 5월 14~16일 행은 과거 실측일 수 있습니다. 이력 없이 이 파일이 실행되면 그 사흘과 현재 지표 행이 샘플로 바뀝니다. 빈 스테이징에 처음 넣는 경우에는 샘플 10개 지표, 3일 히스토리, 상태 3행, 브리핑 1건이 생깁니다.

11번 파일은 `panic_history_v2`가 있으면 `h.high_yield`와 `h.panic_index_v2`를 읽습니다. 10번 파일이 만드는 컬럼은 `hy`, `panic_v2`까지이고, 그 두 컬럼은 이후 파일에서도 추가되지 않습니다. 빈 데이터베이스에서는 10번이 테이블을 만든 직후 11번이 없는 컬럼을 참조해 실패합니다. 11번 파일 전체는 롤백되고, **1~10번은 적용된 채로** 남습니다. 그 상태에는 시드, Realtime, authenticated 쓰기 정책이 포함됩니다. 13~16번 사용자 테이블은 아직 없습니다.

스테이징의 `panic_history_v2`에 그 컬럼이 이미 손으로 추가되어 있으면 11번은 실패하지 않고, 같은 날짜의 `panic_index_v2`와 `high_yield`를 레거시 값으로 덮어쓸 수 있습니다. 어느 쪽인지는 원격 DB를 보기 전에는 알 수 없습니다. 그래서 11번을 수정하기 전에는 push를 시작하지 않습니다.

---

## 6. 운영 프로젝트에 연결·적용하지 않는 안전장치

운영 ref `oausvweyocgynjpeguka`는 명령, 대시보드 SQL, 연결 문자열 어디에도 넣지 않습니다.

따라 할 때의 순서는 아래만 사용합니다.

1. 로그인 계정으로 운영 프로젝트가 함께 보이면, 가능하면 스테이징 프로젝트만 멤버인 계정으로 CLI에 로그인합니다. 같은 계정을 쓸 수밖에 없으면 아래 2~6을 매번 지킵니다.
2. 대시보드에서 두 프로젝트 이름을 화면으로 구분합니다. 주소창이 `qzunuksxwwzusyivaznx`인 탭만 SQL Editor로 사용합니다.
3. 연결 명령에는 ref를 생략하지 않습니다. 목록에서 고르는 방식은 쓰지 않습니다. 허용하는 명령은 `supabase link --project-ref qzunuksxwwzusyivaznx` 하나입니다.
4. 연결 직후 `supabase\.temp\project-ref`와 `config.toml`의 `project_id`를 읽고, 글자가 스테이징 ref와 모두 같을 때만 다음으로 갑니다.
5. 데이터베이스 비밀번호와 DB URL은 스테이징 설정 화면에서만 복사합니다. `--db-url`과 운영 URL은 명령에 넣지 않습니다. 비밀번호를 PowerShell 한 줄에 붙여 넣지 않고, CLI 프롬프트에만 입력합니다.
6. `db push` 직전에 `Get-Content supabase\.temp\project-ref`를 다시 실행합니다. 출력이 `qzunuksxwwzusyivaznx`가 아니면 창을 닫습니다.
7. `supabase db reset`은 실행하지 않습니다. 연결된 원격에 대해 reset이 되면 데이터가 삭제됩니다.
8. Vercel의 `SUPABASE_URL`이 `https://qzunuksxwwzusyivaznx.supabase.co` 인지, 운영 URL과 다른지 화면에서 대조합니다. 이번 절차에서 Vercel 값은 바꾸지 않습니다.

이번 보고서 작성 과정에서는 위 명령을 실행하지 않았고, 두 프로젝트 중 어디에도 연결하지 않았습니다.
