# P2-24 Official 점수 마이그레이션 초안 (미적용)

**상태:** DRAFT ONLY — 운영/스테이징 DB에 실행하지 말 것.  
**근거 설계:** P2-22 (A+C 하이브리드), P2-23 (사전 안전성 검토)  
**P2-26:** P2-25 P1 반영 (status null 거부, long/recommendation 독립, INSERT=UPDATE 검증, 권한 VERIFY 초안)  
**P2-28:** 구버전 숫자 쓰기 → `stored_unverified` (기존 `ok`/`data_insufficient`와 모순 방지; Official 승격 금지)

### 점수 출처 계약 (요약)

| 쓰기 | `panic_score` | `panic_score_status` |
|------|---------------|----------------------|
| 키 모두 생략 | 유지 | 유지 |
| 명시 `ok` + 유한 0~100 | 갱신 | `ok` |
| 명시 `data_insufficient` | NULL | `data_insufficient` |
| 구버전 숫자만 (status 키 없음) | 갱신 | **`stored_unverified`** |
| 구버전 null 점수만 | 유지 (clear 안 함) | 유지 |
| 앱이 `stored_unverified` 명시 | — | **거부** |

**기존 RPC 확인 출처:**

- `supabase/migrations/20250519150000_panic_history_storage_stable.sql`  
  (`upsert_panic_index_history_fill`, `sync_latest_panic_metrics`, `upsert_market_cycle_history_fill`)
- `supabase/migrations/20250519160000_daily_ai_reports.sql`  
  (`upsert_daily_ai_report_fill`)

## 파일

| 파일 | 목적 |
|------|------|
| `P2-24_01_schema_panic_score_status.sql` | 컬럼 ADD + CHECK + 숫자 행 백필 |
| `P2-24_02_rpc_official_score_contract.sql` | RPC REPLACE (omit 유지 / clear on insufficient / P2-26 검증) |
| `P2-24_03_privilege_verify_and_harden.sql` | 권한 VERIFY(읽기) + HARDEN 초안(주석, 미실행) |
| `P2-24_TEST_PLAN.md` | 스테이징 통합 테스트 (T1–T30) |

## 적용 순서 (실제 배포 시 — 이번 단계 아님)

1. `01` 스키마·백필  
2. 조회 매퍼/API (앱) status 인식  
3. `02` RPC  
4. JS 호출자 status 전송  
5. `03` VERIFY → (검토 후) HARDEN  
6. 테스트 플랜 검증  

## 금지

- `supabase/migrations/` 기존 파일 수정·삭제  
- 이 초안을 확인 없이 `supabase db push` / 프로덕션 실행  
- 과거 `panic_score` 일괄 NULL/삭제  
- 라이브 PUBLIC 권한을 마이그레이션 GRANT만으로 단정  
